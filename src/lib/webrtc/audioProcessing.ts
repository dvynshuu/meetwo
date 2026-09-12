/**
 * Meetwo V3 - High-Fidelity Audio DSP & SDP Optimization Pipeline
 * Provides:
 * - Opus SDP munging for 48kHz stereo, DTX, in-band FEC, and 128kbps voice
 * - Web Audio API pipeline with GainNode input calibration and AnalyserNode VAD
 * - Clean stereo chime generation for speaker hardware testing
 * - Audio output routing via setSinkId
 */

export interface OpusSDPOptions {
  maxBitrate?: number; // default 96000 (96 kbps for conversational speech)
  stereo?: boolean; // default false (mono voice optimized for speech intelligibility)
  inbandFec?: boolean; // default true (resilience against packet loss)
  dtx?: boolean; // default true (discontinuous transmission saves bandwidth when silent)
  minPtime?: number; // default 10ms for low latency
}

/**
 * Optimizes an SDP session description specifically for studio voice transmission
 * with Opus codec enhancement, packet loss resilience (FEC), and DTX.
 */
export function mungeOpusSDP(sdp: string, options: OpusSDPOptions = {}): string {
  const {
    maxBitrate = 96000,
    stereo = false,
    inbandFec = true,
    dtx = true,
    minPtime = 10,
  } = options;

  const lines = sdp.split('\r\n');
  const opusPayloadMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!opusPayloadMatch) {
    return sdp;
  }
  const opusPt = opusPayloadMatch[1];

  let fmtpFound = false;
  const newLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith(`a=fmtp:${opusPt}`)) {
      fmtpFound = true;
      const params = new Map<string, string>();
      const rawParams = line.substring(`a=fmtp:${opusPt} `.length).split(';');
      rawParams.forEach((p) => {
        const [k, v] = p.trim().split('=');
        if (k) params.set(k, v || '1');
      });

      // Set our conversational voice defaults
      params.set('minptime', minPtime.toString());
      params.set('useinbandfec', inbandFec ? '1' : '0');
      params.set('usedtx', dtx ? '1' : '0');
      params.set('maxaveragebitrate', maxBitrate.toString());
      if (stereo) {
        params.set('stereo', '1');
        params.set('sprop-stereo', '1');
      } else {
        params.set('stereo', '0');
        params.set('sprop-stereo', '0');
      }
      params.set('cbr', '0'); // Variable bitrate adapts intelligently

      const paramStr = Array.from(params.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join(';');
      newLines.push(`a=fmtp:${opusPt} ${paramStr}`);
    } else {
      newLines.push(line);
      // If we are at the opus rtpmap and fmtp wasn't right after, ensure fmtp is inserted
      if (line.startsWith(`a=rtpmap:${opusPt} `) && !sdp.includes(`a=fmtp:${opusPt}`)) {
        const paramStr = `minptime=${minPtime};useinbandfec=${inbandFec ? '1' : '0'};usedtx=${dtx ? '1' : '0'};maxaveragebitrate=${maxBitrate};stereo=${stereo ? '1' : '0'};sprop-stereo=${stereo ? '1' : '0'};cbr=0`;
        newLines.push(`a=fmtp:${opusPt} ${paramStr}`);
        fmtpFound = true;
      }
    }
  }

  return newLines.join('\r\n');
}

/**
 * Web Audio DSP Manager for Realtime Voice Activity, Gain Calibration, and Monitoring.
 * Employs passive analysis (no self-echo) and VAD with speech hangover hysteresis.
 */
export class AudioDSPManager {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private onLevelCallback?: (level: number, isSpeaking: boolean) => void;
  private smoothedLevel: number = 0;
  private isProcessing: boolean = false;

  // VAD Hysteresis & Hangover with Adaptive Noise Floor
  private readonly baseSpeakThreshold: number = 14;
  private readonly baseSilenceThreshold: number = 8;
  private readonly hangoverTimeMs: number = 450;
  private noiseFloor: number = 4;
  private lastAboveThresholdTime: number = 0;
  private isCurrentlySpeaking: boolean = false;
  private lastEmitTime: number = 0;
  private lastEmittedLevel: number = -1;
  private lastEmittedSpeaking: boolean = false;

  constructor() {}

  /**
   * Initializes real Web Audio pipeline on a MediaStream track
   */
  public attachStream(stream: MediaStream, initialGain: number = 1.0): void {
    this.cleanup();

    if (stream.getAudioTracks().length === 0) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(initialGain, this.audioContext.currentTime);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.35;

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyserNode);
      // Analyser is passive; we strictly do NOT connect to destination to avoid self-echo

      this.isProcessing = true;
      this.startMeteringLoop();
    } catch (err) {
      console.warn('[AudioDSP] Web Audio initialization warning:', err);
    }
  }

  /**
   * Sets the input gain (0 to 200%)
   */
  public setInputGain(volumePercent: number): void {
    if (this.gainNode && this.audioContext) {
      const normalizedGain = Math.max(0, Math.min(2.0, volumePercent / 100));
      this.gainNode.gain.setTargetAtTime(normalizedGain, this.audioContext.currentTime, 0.05);
    }
  }

  public onLevel(callback: (level: number, isSpeaking: boolean) => void): void {
    this.onLevelCallback = callback;
  }

  private startMeteringLoop(): void {
    if (!this.analyserNode) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    const step = () => {
      if (!this.analyserNode || !this.isProcessing) return;

      this.analyserNode.getByteFrequencyData(dataArray);

      // Focus on typical human speech frequency bands (85Hz - 3500Hz)
      // Bin resolution = sampleRate / fftSize (~48000 / 512 ~= 93.75 Hz per bin)
      // We inspect bins 1 through 38
      let sum = 0;
      const count = Math.min(dataArray.length, 38);
      for (let i = 1; i < count; i++) {
        sum += dataArray[i];
      }

      const avg = count > 1 ? sum / (count - 1) : 0;
      // Convert to normalized percentage 0 - 100
      const instantLevel = Math.min(100, Math.round((avg / 128) * 100));

      // Apply low-pass smoothing filter
      this.smoothedLevel = this.smoothedLevel * 0.65 + instantLevel * 0.35;
      const roundedLevel = Math.round(this.smoothedLevel);
      const now = performance.now();

      // Adapt ambient noise floor during silence
      if (!this.isCurrentlySpeaking) {
        this.noiseFloor = this.noiseFloor * 0.96 + roundedLevel * 0.04;
      }

      const speakThreshold = Math.max(this.baseSpeakThreshold, Math.round(this.noiseFloor + 8));
      const silenceThreshold = Math.max(this.baseSilenceThreshold, Math.round(this.noiseFloor + 3));

      // VAD with speech hangover hysteresis
      if (roundedLevel >= speakThreshold) {
        this.lastAboveThresholdTime = now;
        this.isCurrentlySpeaking = true;
      } else if (this.isCurrentlySpeaking) {
        if (now - this.lastAboveThresholdTime > this.hangoverTimeMs && roundedLevel <= silenceThreshold) {
          this.isCurrentlySpeaking = false;
        }
      }

      // Throttle notification: emit immediately on speaking state change,
      // or every ~35ms if level changed by >= 2% to protect React performance
      const speakingChanged = this.isCurrentlySpeaking !== this.lastEmittedSpeaking;
      const levelDiff = Math.abs(roundedLevel - this.lastEmittedLevel);
      const timeElapsed = now - this.lastEmitTime >= 35;

      if (this.onLevelCallback && (speakingChanged || (timeElapsed && levelDiff >= 2))) {
        this.lastEmitTime = now;
        this.lastEmittedLevel = roundedLevel;
        this.lastEmittedSpeaking = this.isCurrentlySpeaking;
        this.onLevelCallback(roundedLevel, this.isCurrentlySpeaking);
      }

      this.animFrameId = requestAnimationFrame(step);
    };

    this.animFrameId = requestAnimationFrame(step);
  }

  public cleanup(): void {
    this.isProcessing = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {}
      this.gainNode = null;
    }
    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {}
      this.analyserNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.smoothedLevel = 0;
  }
}

/**
 * Plays a pleasant high-definition test chime across stereo channels
 * to confirm headphone/speaker output and volume.
 */
export function playSpeakerTestChime(outputDeviceId?: string, volume: number = 100): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        resolve();
        return;
      }

      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      const masterVol = Math.max(0.01, Math.min(1.0, volume / 100)) * 0.35;

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.connect(ctx.destination);

      // Two harmonic chime notes: C5 (523.25 Hz) then E5 (659.25 Hz)
      const now = ctx.currentTime;

      // First note
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.connect(gain);

      // Volume envelope
      gain.gain.exponentialRampToValueAtTime(masterVol, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(masterVol * 0.6, now + 0.2);

      // Second note at +0.18s
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.18);
      osc2.connect(gain);

      gain.gain.exponentialRampToValueAtTime(masterVol, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.75);

      setTimeout(() => {
        try {
          ctx.close().catch(() => {});
        } catch {}
        resolve();
      }, 800);
    } catch (e) {
      console.warn('[AudioDSP] Speaker test chime failed:', e);
      resolve();
    }
  });
}

/**
 * Safely routes an HTMLMediaElement to a specified output device if supported.
 */
export async function routeAudioOutput(
  element: HTMLMediaElement,
  sinkId: string
): Promise<boolean> {
  if (typeof (element as any).setSinkId === 'function' && sinkId) {
    try {
      await (element as any).setSinkId(sinkId);
      return true;
    } catch (err) {
      console.warn('[AudioDSP] Failed to set sink ID:', err);
      return false;
    }
  }
  return false;
}
