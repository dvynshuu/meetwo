import { MediaDeviceSettings, VideoQuality } from '../../types';
import { AudioDSPManager } from './audioProcessing';
import { logger } from './observability';

export type TrackKind = 'audio' | 'video' | 'screen' | 'screen-audio';

export interface MediaSessionEvents {
  onTrackChanged?: (kind: TrackKind, track: MediaStreamTrack | null) => void;
  onAudioLevel?: (level: number, isSpeaking: boolean, gateState?: 'open' | 'attenuated') => void;
  onDeviceListChanged?: () => void;
  onDeviceUnplugged?: (kind: 'audio' | 'video') => void;
  onDeviceReconnected?: (kind: 'audio' | 'video', label: string) => void;
}

export class MediaSession {
  // Separated Track Model
  private rawMicrophoneTrack: MediaStreamTrack | null = null;
  private microphoneTrack: MediaStreamTrack | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenShareTrack: MediaStreamTrack | null = null;
  private screenAudioTrack: MediaStreamTrack | null = null;
  private isScreenShareStarting: boolean = false;
  private lastUnpluggedKind: 'audio' | 'video' | null = null;
  private activeMicStream: MediaStream | null = null; // Retained to prevent Chromium V8 GC audio drop (Issue 349734)
  private isMuted: boolean = false;
  private audioWatchdogTimer: any = null;
  private muteDebounceTimer: any = null;
  private isRecoveringMic: boolean = false;

  // Composite MediaStreams
  private localStream: MediaStream = new MediaStream();
  private screenStream: MediaStream = new MediaStream();

  // DSP & Audio Analytics
  public dspManager: AudioDSPManager = new AudioDSPManager();
  private events: MediaSessionEvents = {};

  public settings: MediaDeviceSettings = {
    audioInputId: '',
    audioOutputId: '',
    videoInputId: '',
    videoQuality: '1080p',
    qualityMode: 'auto',
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    voiceIsolation: true,
    noiseGate: true,
    noiseGateMode: 'balanced',
    highPassFilter: true,
    dynamicsCompressor: true,
    audioCompressionProfile: 'balanced',
    stereoAudio: false,
    inputVolume: 100,
    outputVolume: 100,
  };

  constructor(events?: MediaSessionEvents) {
    if (events) {
      this.events = events;
    }

    // Bind DSP level updates
    this.dspManager.onLevel((level, isSpeaking, gateState) => {
      if (this.events.onAudioLevel) {
        this.events.onAudioLevel(level, isSpeaking, gateState);
      }
    });

    // Device change listener
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        if (this.events.onDeviceListChanged) {
          this.events.onDeviceListChanged();
        }

        // 1. Check if an unplugged audio device was restored or if active mic track died
        const isMicDead = !this.microphoneTrack || this.microphoneTrack.readyState === 'ended';
        if (isMicDead || this.lastUnpluggedKind === 'audio') {
          try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const mics = devs.filter((d) => d.kind === 'audioinput');
            if (mics.length > 0) {
              const label = mics[0].label || 'Microphone';
              this.lastUnpluggedKind = null;
              this.events.onDeviceReconnected?.('audio', label);
            }
          } catch {}
        } else if (this.microphoneTrack && this.microphoneTrack.readyState === 'live') {
          // 2. Active mic is live: verify if its physical hardware was disconnected (e.g. USB/Bluetooth unplug)
          try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const mics = devs.filter((d) => d.kind === 'audioinput');
            const trackSettings = this.microphoneTrack.getSettings?.();
            const currentDevId = trackSettings?.deviceId || this.settings.audioInputId;
            if (currentDevId && mics.length > 0) {
              const stillExists = mics.some((m) => m.deviceId === currentDevId);
              if (!stillExists) {
                console.warn('[MediaSession] Active microphone disconnected during devicechange, auto-recovering...');
                this.recoverMicrophone('device_unplugged').catch(() => {});
              }
            }
          } catch {}
        }

        if (!this.cameraTrack && this.lastUnpluggedKind === 'video') {
          try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const cams = devs.filter((d) => d.kind === 'videoinput');
            if (cams.length > 0) {
              const label = cams[0].label || 'Camera';
              this.lastUnpluggedKind = null;
              this.events.onDeviceReconnected?.('video', label);
            }
          } catch {}
        }
      });
    }

    // Load saved preferences if available
    this.loadSavedPreferences();
  }

  public setEvents(events: MediaSessionEvents) {
    this.events = { ...this.events, ...events };
  }

  private loadSavedPreferences() {
    try {
      const saved = localStorage.getItem('meetwo_device_settings_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
      }
    } catch {}
  }

  public savePreferences() {
    try {
      localStorage.setItem('meetwo_device_settings_v3', JSON.stringify(this.settings));
    } catch {}
  }

  // ==========================================
  // MICROPHONE TRACK LIFECYCLE
  // ==========================================

  public async startMicrophone(deviceId?: string): Promise<MediaStreamTrack> {
    if (this.microphoneTrack || this.rawMicrophoneTrack) {
      this.stopMicrophone(false);
    }

    const targetDeviceId = deviceId !== undefined ? deviceId : this.settings.audioInputId;
    const isStereo = Boolean(this.settings.stereoAudio);

    // Using 'ideal' prevents OverconstrainedError when target device ID is stale, default, or rehashed
    const deviceConstraint =
      targetDeviceId && targetDeviceId !== 'default' && targetDeviceId !== ''
        ? { ideal: targetDeviceId }
        : undefined;

    const audioConstraints: MediaTrackConstraints = {
      deviceId: deviceConstraint,
      echoCancellation: this.settings.echoCancellation,
      noiseSuppression: this.settings.noiseSuppression,
      autoGainControl: this.settings.autoGainControl,
      channelCount: isStereo ? { ideal: 2 } : { ideal: 1 },
      sampleRate: { ideal: 48000 },
      sampleSize: { ideal: 16 },
      // Advanced vendor hardware DSP constraints
      // @ts-ignore
      googEchoCancellation: this.settings.echoCancellation,
      googAutoGainControl: this.settings.autoGainControl,
      googNoiseSuppression: this.settings.noiseSuppression,
      googHighpassFilter: this.settings.highPassFilter,
      googTypingNoiseDetection: this.settings.noiseSuppression,
      googNoiseReduction: this.settings.noiseSuppression,
    };

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });
    } catch (err) {
      console.warn('[MediaSession] Microphone with optimal constraints failed, attempting standard fallback:', err);
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceConstraint,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: isStereo ? { ideal: 2 } : { ideal: 1 },
          },
          video: false,
        });
      } catch (err2) {
        console.warn('[MediaSession] Standard microphone fallback failed, attempting ultimate bare audio:', err2);
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
      }
    }

    const rawTrack = micStream.getAudioTracks()[0];
    if (!rawTrack) {
      throw new Error('Microphone stream returned no audio tracks');
    }

    rawTrack.enabled = !this.isMuted;
    if ('contentHint' in rawTrack) {
      rawTrack.contentHint = 'speech';
    }
    this.activeMicStream = micStream;
    this.rawMicrophoneTrack = rawTrack;
    this.microphoneTrack = rawTrack; // DIRECT HARDWARE TRACK for 100% native AEC and zero latency

    // Save actual hardware device ID if none was previously set
    try {
      const trackSettings = rawTrack.getSettings();
      if (trackSettings.deviceId && !this.settings.audioInputId) {
        this.settings.audioInputId = trackSettings.deviceId;
      }
    } catch {}

    // Update local composite stream
    this.localStream.getAudioTracks().forEach((t) => this.localStream.removeTrack(t));
    this.localStream.addTrack(rawTrack);

    // Passively tap into DSP for accurate VAD and audio level telemetry without altering broadcast audio
    this.dspManager.attachStream(
      micStream,
      (this.settings.inputVolume || 100) / 100,
      this.settings
    );

    // Hardware / OS mute handling with auto-recovery debounce
    rawTrack.onmute = () => {
      console.warn('[MediaSession] Hardware/OS mute detected on microphone track');
      if (this.muteDebounceTimer) clearTimeout(this.muteDebounceTimer);
      // If hardware mute persists for >1500ms while user has not muted in UI, trigger auto-recovery
      this.muteDebounceTimer = setTimeout(() => {
        if (this.microphoneTrack && this.microphoneTrack.muted && !this.isMuted) {
          console.warn('[MediaSession] Hardware mute persisted >1.5s, auto-recovering microphone...');
          this.recoverMicrophone('hardware_mute_timeout').catch(() => {});
        }
      }, 1500);
    };

    rawTrack.onunmute = () => {
      console.info('[MediaSession] Hardware/OS unmute detected on microphone track');
      if (this.muteDebounceTimer) {
        clearTimeout(this.muteDebounceTimer);
        this.muteDebounceTimer = null;
      }
    };

    // External unplug or stream death handling with seamless hot-recovery
    rawTrack.onended = () => {
      console.warn('[MediaSession] Microphone track ended (device disconnected/unplugged/glitched)');
      if (!this.isMuted) {
        // Active unmuted call: immediately attempt seamless recovery without dropping the user from call
        this.recoverMicrophone('track_ended').catch(() => {});
      } else {
        this.lastUnpluggedKind = 'audio';
        this.stopMicrophone();
        logger.log('device_disconnected', { kind: 'audio' });
        if (this.events.onDeviceUnplugged) {
          this.events.onDeviceUnplugged('audio');
        }
      }
    };

    // Launch continuous background watchdog for stuck mute or dropped buffers
    this.startAudioWatchdog();

    if (this.events.onTrackChanged) {
      this.events.onTrackChanged('audio', rawTrack);
    }

    logger.log('device_changed', { kind: 'audio', deviceId: targetDeviceId });
    return rawTrack;
  }

  /**
   * Transparently reacquires the microphone stream and hot-swaps it into active calls
   * when hardware glitches, Bluetooth profiles switch, or OS audio services reset.
   */
  public async recoverMicrophone(reason: string): Promise<boolean> {
    if (this.isRecoveringMic) return false;
    this.isRecoveringMic = true;
    console.info(`[MediaSession] Initiating seamless microphone auto-recovery (reason: ${reason})`);

    try {
      if (this.microphoneTrack) {
        this.microphoneTrack.onended = null;
        this.microphoneTrack.onmute = null;
        this.microphoneTrack.onunmute = null;
        try { this.microphoneTrack.stop(); } catch {}
      }

      const newTrack = await this.startMicrophone(this.settings.audioInputId);
      if (this.isMuted) {
        newTrack.enabled = false;
      }

      console.info(`[MediaSession] Microphone successfully auto-recovered: ${newTrack.label || 'Microphone'}`);
      this.events.onDeviceReconnected?.('audio', newTrack.label || 'Microphone');
      return true;
    } catch (err) {
      console.warn('[MediaSession] Microphone auto-recovery failed:', err);
      this.lastUnpluggedKind = 'audio';
      this.stopMicrophone();
      if (this.events.onDeviceUnplugged) {
        this.events.onDeviceUnplugged('audio');
      }
      return false;
    } finally {
      this.isRecoveringMic = false;
    }
  }

  private startAudioWatchdog(): void {
    this.stopAudioWatchdog();
    this.audioWatchdogTimer = setInterval(async () => {
      if (!this.microphoneTrack || this.isMuted || this.isRecoveringMic) return;

      // 1. Check if track ended silently without firing onended
      if (this.microphoneTrack.readyState === 'ended') {
        console.warn('[MediaSession] Watchdog detected ended microphone track, auto-recovering...');
        await this.recoverMicrophone('watchdog_track_ended');
        return;
      }

      // 2. Check if track is stuck in hardware mute
      if (this.microphoneTrack.muted) {
        console.warn('[MediaSession] Watchdog detected hardware-muted microphone track, auto-recovering...');
        await this.recoverMicrophone('watchdog_track_muted');
        return;
      }

      // 3. Resume AudioContext if suspended
      if (this.dspManager.isAudioContextSuspended()) {
        await this.dspManager.resumeContext();
      }
    }, 2500);
  }

  private stopAudioWatchdog(): void {
    if (this.audioWatchdogTimer) {
      clearInterval(this.audioWatchdogTimer);
      this.audioWatchdogTimer = null;
    }
    if (this.muteDebounceTimer) {
      clearTimeout(this.muteDebounceTimer);
      this.muteDebounceTimer = null;
    }
  }

  public stopMicrophone(notify: boolean = true) {
    this.stopAudioWatchdog();
    if (this.microphoneTrack) {
      this.microphoneTrack.onended = null;
      this.microphoneTrack.onmute = null;
      this.microphoneTrack.onunmute = null;
      try {
        this.microphoneTrack.stop();
      } catch {}
      this.localStream.removeTrack(this.microphoneTrack);
      this.microphoneTrack = null;
    }
    if (this.rawMicrophoneTrack && this.rawMicrophoneTrack !== this.microphoneTrack) {
      this.rawMicrophoneTrack.onended = null;
      this.rawMicrophoneTrack.onmute = null;
      this.rawMicrophoneTrack.onunmute = null;
      try {
        this.rawMicrophoneTrack.stop();
      } catch {}
    }
    this.rawMicrophoneTrack = null;

    if (this.activeMicStream) {
      try {
        this.activeMicStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.activeMicStream = null;
    }

    this.dspManager.cleanup();
    if (notify && this.events.onTrackChanged) {
      this.events.onTrackChanged('audio', null);
    }
  }

  public async switchMicrophone(deviceId: string): Promise<MediaStreamTrack> {
    this.settings.audioInputId = deviceId;
    this.savePreferences();
    return await this.startMicrophone(deviceId);
  }

  public setMicrophoneMute(muted: boolean) {
    this.isMuted = muted;
    if (this.microphoneTrack) {
      this.microphoneTrack.enabled = !muted;
    }
    if (this.rawMicrophoneTrack && this.rawMicrophoneTrack !== this.microphoneTrack) {
      this.rawMicrophoneTrack.enabled = !muted;
    }
    this.dspManager.setMuted(muted);
  }

  public setInputVolume(volumePercent: number) {
    this.settings.inputVolume = volumePercent;
    this.dspManager.setInputGain(volumePercent);
    this.savePreferences();
  }

  public async applyLiveAudioSettings(newSettings: Partial<MediaDeviceSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    this.savePreferences();

    // 1. Update passive telemetry DSP parameters in real time
    this.dspManager.updateDSPParameters(this.settings);

    // 2. If raw hardware track is active, update hardware constraints seamlessly
    const activeTrack = this.microphoneTrack || this.rawMicrophoneTrack;
    if (activeTrack && typeof activeTrack.applyConstraints === 'function') {
      try {
        const isStereo = Boolean(this.settings.stereoAudio);
        await activeTrack.applyConstraints({
          echoCancellation: this.settings.echoCancellation,
          noiseSuppression: this.settings.noiseSuppression,
          autoGainControl: this.settings.autoGainControl,
          channelCount: isStereo ? { ideal: 2 } : { ideal: 1 },
          sampleRate: { ideal: 48000 },
          // @ts-ignore
          googEchoCancellation: this.settings.echoCancellation,
          googAutoGainControl: this.settings.autoGainControl,
          googNoiseSuppression: this.settings.noiseSuppression,
          googHighpassFilter: this.settings.highPassFilter,
          googTypingNoiseDetection: this.settings.noiseSuppression,
          googNoiseReduction: this.settings.noiseSuppression,
        });
      } catch (e) {
        console.warn('[MediaSession] Hardware constraint update warning:', e);
      }
    }
  }

  // ==========================================
  // CAMERA TRACK LIFECYCLE
  // ==========================================

  public async startCamera(deviceId?: string, quality?: VideoQuality): Promise<MediaStreamTrack> {
    if (this.cameraTrack) {
      this.stopCamera();
    }

    const targetDeviceId = deviceId !== undefined ? deviceId : this.settings.videoInputId;
    const targetQuality = quality || this.settings.videoQuality;

    const resolutionMap: Record<VideoQuality, { width: number; height: number; fps: number }> = {
      '4K': { width: 3840, height: 2160, fps: 30 },
      '1440p': { width: 2560, height: 1440, fps: 30 },
      '1080p': { width: 1920, height: 1080, fps: 60 },
      '720p': { width: 1280, height: 720, fps: 60 },
      '480p': { width: 640, height: 480, fps: 30 },
      '360p': { width: 480, height: 360, fps: 24 },
    };

    const targetRes = resolutionMap[targetQuality] || resolutionMap['1080p'];

    const videoConstraints: MediaTrackConstraints = {
      deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
      width: { ideal: targetRes.width, min: 320 },
      height: { ideal: targetRes.height, min: 240 },
      frameRate: { ideal: targetRes.fps, max: 60 },
    };

    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      const track = camStream.getVideoTracks()[0];
      this.cameraTrack = track;

      this.localStream.getVideoTracks().forEach((t) => this.localStream.removeTrack(t));
      this.localStream.addTrack(track);

      track.onended = () => {
        console.warn('[MediaSession] Camera track ended (device disconnected/unplugged)');
        this.lastUnpluggedKind = 'video';
        this.stopCamera();
        logger.log('device_disconnected', { kind: 'video' });
        if (this.events.onDeviceUnplugged) {
          this.events.onDeviceUnplugged('video');
        }
      };

      if (this.events.onTrackChanged) {
        this.events.onTrackChanged('video', track);
      }

      logger.log('device_changed', { kind: 'video', deviceId: targetDeviceId });
      return track;
    } catch (err) {
      console.warn(`[MediaSession] Camera at ${targetQuality} failed, falling back:`, err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true,
          audio: false,
        });
        const fallbackTrack = fallbackStream.getVideoTracks()[0];
        this.cameraTrack = fallbackTrack;

        this.localStream.getVideoTracks().forEach((t) => this.localStream.removeTrack(t));
        this.localStream.addTrack(fallbackTrack);

        fallbackTrack.onended = () => {
          console.warn('[MediaSession] Fallback camera track ended');
          this.lastUnpluggedKind = 'video';
          this.stopCamera();
          logger.log('device_disconnected', { kind: 'video' });
          if (this.events.onDeviceUnplugged) {
            this.events.onDeviceUnplugged('video');
          }
        };

        if (this.events.onTrackChanged) {
          this.events.onTrackChanged('video', fallbackTrack);
        }

        return fallbackTrack;
      } catch (fatalErr) {
        console.error('[MediaSession] Fatal camera acquisition error:', fatalErr);
        throw fatalErr;
      }
    }
  }

  public stopCamera() {
    if (this.cameraTrack) {
      this.cameraTrack.onended = null;
      try {
        this.cameraTrack.stop();
      } catch {}
      this.localStream.removeTrack(this.cameraTrack);
      this.cameraTrack = null;
    }
    if (this.events.onTrackChanged) {
      this.events.onTrackChanged('video', null);
    }
  }

  public async switchCamera(deviceId: string): Promise<MediaStreamTrack> {
    this.settings.videoInputId = deviceId;
    this.savePreferences();
    return await this.startCamera(deviceId);
  }

  public setCameraMute(muted: boolean) {
    if (this.cameraTrack) {
      this.cameraTrack.enabled = !muted;
    }
  }

  // ==========================================
  // SCREEN SHARING LIFECYCLE
  // ==========================================

  public async startScreenShare(captureAudio: boolean = true): Promise<{
    videoTrack: MediaStreamTrack;
    audioTrack?: MediaStreamTrack;
  }> {
    if (this.isScreenShareStarting) {
      if (this.screenShareTrack) {
        return { videoTrack: this.screenShareTrack, audioTrack: this.screenAudioTrack || undefined };
      }
      throw new Error('Screen share acquisition already in progress');
    }

    this.isScreenShareStarting = true;
    this.stopScreenShare();

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 60, max: 60 },
        } as any,
        audio: captureAudio,
      });

      const videoTrack = displayStream.getVideoTracks()[0];
      this.screenShareTrack = videoTrack;

      // Clean old tracks from screenStream
      this.screenStream.getTracks().forEach((t) => this.screenStream.removeTrack(t));
      this.screenStream.addTrack(videoTrack);

      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length > 0) {
        this.screenAudioTrack = audioTracks[0];
        this.screenStream.addTrack(this.screenAudioTrack);
        if (this.events.onTrackChanged) {
          this.events.onTrackChanged('screen-audio', this.screenAudioTrack);
        }
      }

      // Handle user stopping share via native browser floating UI
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      if (this.events.onTrackChanged) {
        this.events.onTrackChanged('screen', videoTrack);
      }

      logger.log('screen_share_started', { hasAudio: Boolean(this.screenAudioTrack) });

      return {
        videoTrack,
        audioTrack: this.screenAudioTrack || undefined,
      };
    } catch (err) {
      console.warn('[MediaSession] Screen sharing was cancelled or denied:', err);
      throw err;
    } finally {
      this.isScreenShareStarting = false;
    }
  }

  public stopScreenShare() {
    if (this.screenShareTrack) {
      this.screenShareTrack.onended = null;
      try {
        this.screenShareTrack.stop();
      } catch {}
      this.screenStream.removeTrack(this.screenShareTrack);
      this.screenShareTrack = null;
      logger.log('screen_share_stopped');
    }
    if (this.screenAudioTrack) {
      this.screenAudioTrack.onended = null;
      try {
        this.screenAudioTrack.stop();
      } catch {}
      this.screenStream.removeTrack(this.screenAudioTrack);
      this.screenAudioTrack = null;
    }
    if (this.events.onTrackChanged) {
      this.events.onTrackChanged('screen', null);
      this.events.onTrackChanged('screen-audio', null);
    }
  }

  // ==========================================
  // COMPOSITE INITIALIZATION & CLEANUP
  // ==========================================

  public async startLocalMedia(
    audio: boolean = true,
    video: boolean = true,
    quality?: VideoQuality
  ): Promise<MediaStream> {
    if (audio) {
      try {
        await this.startMicrophone();
      } catch (err) {
        console.warn('[MediaSession] Microphone acquisition failed on join:', err);
      }
    } else {
      this.stopMicrophone();
    }

    if (video) {
      try {
        await this.startCamera(undefined, quality);
      } catch (err) {
        console.warn('[MediaSession] Camera acquisition failed on join:', err);
      }
    } else {
      this.stopCamera();
    }

    return this.localStream;
  }

  public stopLocalMedia() {
    this.stopMicrophone();
    this.stopCamera();
    this.stopScreenShare();
    this.dspManager.cleanup();
  }

  // Accessors
  public isMicrophoneActive(): boolean {
    return Boolean(this.microphoneTrack && this.microphoneTrack.readyState === 'live');
  }

  public isCameraActive(): boolean {
    return Boolean(this.cameraTrack && this.cameraTrack.readyState === 'live');
  }

  public getMicrophoneTrack(): MediaStreamTrack | null {
    return this.microphoneTrack;
  }

  public getCameraTrack(): MediaStreamTrack | null {
    return this.cameraTrack;
  }

  public getScreenShareTrack(): MediaStreamTrack | null {
    return this.screenShareTrack;
  }

  public getScreenAudioTrack(): MediaStreamTrack | null {
    return this.screenAudioTrack;
  }

  public getLocalStream(): MediaStream {
    return this.localStream;
  }

  public getScreenStream(): MediaStream {
    return this.screenStream;
  }

  // Hardware devices enumeration
  public static async getAvailableDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        audioInputs: devices.filter((d) => d.kind === 'audioinput'),
        audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
        videoInputs: devices.filter((d) => d.kind === 'videoinput'),
      };
    } catch {
      return { audioInputs: [], audioOutputs: [], videoInputs: [] };
    }
  }
}
