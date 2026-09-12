import { MediaDeviceSettings, VideoQuality } from '../../types';

export class MediaSession {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private onAudioLevelCallback?: (level: number) => void;

  public settings: MediaDeviceSettings = {
    audioInputId: '',
    audioOutputId: '',
    videoInputId: '',
    videoQuality: '1080p',
    echoCancellation: true,
    noiseSuppression: true,
  };

  constructor() {}

  // Request user camera and microphone with 1080p fallback logic
  public async startLocalMedia(
    audio: boolean = true,
    video: boolean = true,
    quality: VideoQuality = '1080p'
  ): Promise<MediaStream> {
    this.stopLocalMedia();

    const videoConstraints: MediaTrackConstraints | boolean = video
      ? {
          deviceId: this.settings.videoInputId ? { exact: this.settings.videoInputId } : undefined,
          width: quality === '1080p' ? { ideal: 1920, min: 640 } : quality === '720p' ? { ideal: 1280, min: 480 } : { ideal: 640 },
          height: quality === '1080p' ? { ideal: 1080, min: 480 } : quality === '720p' ? { ideal: 720, min: 360 } : { ideal: 480 },
          frameRate: { ideal: 30, max: 60 },
        }
      : false;

    const audioConstraints: MediaTrackConstraints | boolean = audio
      ? {
          deviceId: this.settings.audioInputId ? { exact: this.settings.audioInputId } : undefined,
          echoCancellation: this.settings.echoCancellation,
          noiseSuppression: this.settings.noiseSuppression,
          autoGainControl: true,
        }
      : false;

    try {
      // Attempt with ideal resolution
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });
    } catch (err: any) {
      console.warn('High quality constraints failed, attempting graceful fallback:', err);
      // Graceful fallback to basic constraints
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: video ? true : false,
          audio: audio ? true : false,
        });
      } catch (fallbackErr) {
        console.error('Fatal media devices error:', fallbackErr);
        throw fallbackErr;
      }
    }

    if (audio && this.localStream.getAudioTracks().length > 0) {
      this.initVoiceActivityDetection(this.localStream);
    }

    return this.localStream;
  }

  // Screen sharing via getDisplayMedia
  public async startScreenShare(): Promise<MediaStream> {
    if (this.screenStream) {
      this.stopScreenShare();
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      return this.screenStream;
    } catch (err) {
      console.error('Failed to capture screen:', err);
      throw err;
    }
  }

  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }
  }

  // Voice Activity Detection using Web Audio API
  private initVoiceActivityDetection(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));

        if (this.onAudioLevelCallback) {
          this.onAudioLevelCallback(normalized);
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      this.animFrameId = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn('Voice activity detection setup failed:', e);
    }
  }

  public onAudioLevel(callback: (level: number) => void) {
    this.onAudioLevelCallback = callback;
  }

  public stopLocalMedia() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.stopScreenShare();
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  // Available devices list
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
