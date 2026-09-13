import { MediaDeviceSettings, VideoQuality, QualityMode } from '../../types';
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
    stereoAudio: true,
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

        // Check if an unplugged device has been restored
        if (!this.microphoneTrack && this.lastUnpluggedKind === 'audio') {
          try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const mics = devs.filter((d) => d.kind === 'audioinput');
            if (mics.length > 0) {
              const label = mics[0].label || 'Microphone';
              this.lastUnpluggedKind = null;
              this.events.onDeviceReconnected?.('audio', label);
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
      this.stopMicrophone();
    }

    const targetDeviceId = deviceId !== undefined ? deviceId : this.settings.audioInputId;

    const audioConstraints: MediaTrackConstraints = {
      deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
      echoCancellation: this.settings.echoCancellation,
      noiseSuppression: this.settings.noiseSuppression,
      autoGainControl: this.settings.autoGainControl,
      channelCount: { ideal: 2 },
      sampleRate: { ideal: 48000 },
      sampleSize: { ideal: 16 },
    };

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      const rawTrack = micStream.getAudioTracks()[0];
      this.rawMicrophoneTrack = rawTrack;
      this.microphoneTrack = rawTrack; // DIRECT HARDWARE TRACK for 100% native AEC and zero latency

      // Update local composite stream
      this.localStream.getAudioTracks().forEach((t) => this.localStream.removeTrack(t));
      this.localStream.addTrack(rawTrack);

      // Passively tap into DSP for accurate VAD and audio level telemetry without altering broadcast audio
      this.dspManager.attachStream(
        micStream,
        this.settings.inputVolume / 100,
        this.settings
      );

      // Handle external unplug / mute
      rawTrack.onended = () => {
        console.warn('[MediaSession] Microphone track ended (device disconnected/unplugged)');
        this.lastUnpluggedKind = 'audio';
        this.stopMicrophone();
        logger.log('device_disconnected', { kind: 'audio' });
        if (this.events.onDeviceUnplugged) {
          this.events.onDeviceUnplugged('audio');
        }
      };

      if (this.events.onTrackChanged) {
        this.events.onTrackChanged('audio', rawTrack);
      }

      logger.log('device_changed', { kind: 'audio', deviceId: targetDeviceId });
      return rawTrack;
    } catch (err) {
      console.warn('[MediaSession] Microphone with constraints failed, falling back:', err);
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 2 },
          sampleRate: { ideal: 48000 },
        },
      });
      const fallbackRawTrack = fallbackStream.getAudioTracks()[0];
      this.rawMicrophoneTrack = fallbackRawTrack;
      this.microphoneTrack = fallbackRawTrack;

      this.localStream.getAudioTracks().forEach((t) => this.localStream.removeTrack(t));
      this.localStream.addTrack(fallbackRawTrack);

      this.dspManager.attachStream(
        fallbackStream,
        this.settings.inputVolume / 100,
        this.settings
      );

      fallbackRawTrack.onended = () => {
        console.warn('[MediaSession] Fallback microphone track ended');
        this.lastUnpluggedKind = 'audio';
        this.stopMicrophone();
        logger.log('device_disconnected', { kind: 'audio' });
        if (this.events.onDeviceUnplugged) {
          this.events.onDeviceUnplugged('audio');
        }
      };

      if (this.events.onTrackChanged) {
        this.events.onTrackChanged('audio', fallbackRawTrack);
      }

      return fallbackRawTrack;
    }
  }

  public stopMicrophone() {
    if (this.microphoneTrack) {
      try {
        this.microphoneTrack.stop();
      } catch {}
      this.localStream.removeTrack(this.microphoneTrack);
      this.microphoneTrack = null;
    }
    if (this.rawMicrophoneTrack && this.rawMicrophoneTrack !== this.microphoneTrack) {
      try {
        this.rawMicrophoneTrack.stop();
      } catch {}
    }
    this.rawMicrophoneTrack = null;

    this.dspManager.cleanup();
    if (this.events.onTrackChanged) {
      this.events.onTrackChanged('audio', null);
    }
  }

  public async switchMicrophone(deviceId: string): Promise<MediaStreamTrack> {
    this.settings.audioInputId = deviceId;
    this.savePreferences();
    return await this.startMicrophone(deviceId);
  }

  public setMicrophoneMute(muted: boolean) {
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
        await activeTrack.applyConstraints({
          echoCancellation: this.settings.echoCancellation,
          noiseSuppression: this.settings.noiseSuppression,
          autoGainControl: this.settings.autoGainControl,
          channelCount: { ideal: 2 },
          sampleRate: { ideal: 48000 },
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
      this.cameraTrack.stop();
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
      this.screenShareTrack.stop();
      this.screenStream.removeTrack(this.screenShareTrack);
      this.screenShareTrack = null;
      logger.log('screen_share_stopped');
    }
    if (this.screenAudioTrack) {
      this.screenAudioTrack.stop();
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
    const promises: Promise<any>[] = [];

    if (audio) {
      promises.push(this.startMicrophone());
    } else {
      this.stopMicrophone();
    }

    if (video) {
      promises.push(this.startCamera(undefined, quality));
    } else {
      this.stopCamera();
    }

    await Promise.all(promises);
    return this.localStream;
  }

  public stopLocalMedia() {
    this.stopMicrophone();
    this.stopCamera();
    this.stopScreenShare();
    this.dspManager.cleanup();
  }

  // Accessors
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
