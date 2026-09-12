import { MediaDeviceSettings, VideoQuality, QualityMode } from '../../types';
import { AudioDSPManager } from './audioProcessing';

export type TrackKind = 'audio' | 'video' | 'screen' | 'screen-audio';

export interface MediaSessionEvents {
  onTrackChanged?: (kind: TrackKind, track: MediaStreamTrack | null) => void;
  onAudioLevel?: (level: number, isSpeaking: boolean) => void;
  onDeviceListChanged?: () => void;
}

export class MediaSession {
  // Separated Track Model
  private microphoneTrack: MediaStreamTrack | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenShareTrack: MediaStreamTrack | null = null;
  private screenAudioTrack: MediaStreamTrack | null = null;

  // Composite MediaStreams
  private localStream: MediaStream = new MediaStream();
  private screenStream: MediaStream = new MediaStream();

  // DSP & Audio Analytics
  private dspManager: AudioDSPManager = new AudioDSPManager();
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
    inputVolume: 100,
    outputVolume: 100,
  };

  constructor(events?: MediaSessionEvents) {
    if (events) {
      this.events = events;
    }

    // Bind DSP level updates
    this.dspManager.onLevel((level, isSpeaking) => {
      if (this.events.onAudioLevel) {
        this.events.onAudioLevel(level, isSpeaking);
      }
    });

    // Device change listener
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        if (this.events.onDeviceListChanged) {
          this.events.onDeviceListChanged();
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
    if (this.microphoneTrack) {
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
    };

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      const track = micStream.getAudioTracks()[0];
      this.microphoneTrack = track;

      // Update local composite stream
      this.localStream.getAudioTracks().forEach((t) => this.localStream.removeTrack(t));
      this.localStream.addTrack(track);

      // Attach to DSP for VAD and Volume
      this.dspManager.attachStream(micStream, this.settings.inputVolume / 100);

      // Handle external unplug / mute
      track.onended = () => {
        this.stopMicrophone();
      };

      if (this.events.onTrackChanged) {
        this.events.onTrackChanged('audio', track);
      }

      return track;
    } catch (err) {
      console.warn('[MediaSession] Microphone with constraints failed, falling back:', err);
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const fallbackTrack = fallbackStream.getAudioTracks()[0];
      this.microphoneTrack = fallbackTrack;

      this.localStream.getAudioTracks().forEach((t) => this.localStream.removeTrack(t));
      this.localStream.addTrack(fallbackTrack);
      this.dspManager.attachStream(fallbackStream, this.settings.inputVolume / 100);

      if (this.events.onTrackChanged) {
        this.events.onTrackChanged('audio', fallbackTrack);
      }

      return fallbackTrack;
    }
  }

  public stopMicrophone() {
    if (this.microphoneTrack) {
      this.microphoneTrack.stop();
      this.localStream.removeTrack(this.microphoneTrack);
      this.microphoneTrack = null;
    }
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
  }

  public setInputVolume(volumePercent: number) {
    this.settings.inputVolume = volumePercent;
    this.dspManager.setInputGain(volumePercent);
    this.savePreferences();
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

    const resolutionMap = {
      '1080p': { width: 1920, height: 1080, fps: 30 },
      '720p': { width: 1280, height: 720, fps: 30 },
      '480p': { width: 640, height: 480, fps: 30 },
      '360p': { width: 480, height: 360, fps: 24 },
    };

    const targetRes = resolutionMap[targetQuality] || resolutionMap['1080p'];

    const videoConstraints: MediaTrackConstraints = {
      deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
      width: { ideal: targetRes.width, min: 480 },
      height: { ideal: targetRes.height, min: 360 },
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
        this.stopCamera();
      };

      if (this.events.onTrackChanged) {
        this.events.onTrackChanged('video', track);
      }

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
    this.stopScreenShare();

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 30, max: 60 },
        },
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

      return {
        videoTrack,
        audioTrack: this.screenAudioTrack || undefined,
      };
    } catch (err) {
      console.warn('[MediaSession] Screen sharing was cancelled or denied:', err);
      throw err;
    }
  }

  public stopScreenShare() {
    if (this.screenShareTrack) {
      this.screenShareTrack.stop();
      this.screenStream.removeTrack(this.screenShareTrack);
      this.screenShareTrack = null;
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
