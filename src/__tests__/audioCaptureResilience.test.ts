import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioDSPManager, mungeOpusSDP, getOpusOptionsForProfile } from '../lib/webrtc/audioProcessing';
import { MediaSession } from '../lib/webrtc/mediaSession';

// Mock WebRTC / DOM primitives for headless test runner
class MockMediaStream {
  private tracks: any[];
  constructor(tracks: any[] = []) {
    this.tracks = tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  getTracks() {
    return [...this.tracks];
  }
  addTrack(track: any) {
    this.tracks.push(track);
  }
  removeTrack(track: any) {
    this.tracks = this.tracks.filter((t) => t !== track);
  }
}

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof (globalThis as any).MediaStream === 'undefined') {
  (globalThis as any).MediaStream = MockMediaStream;
}
if (typeof (globalThis as any).requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 16);
  (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
}

describe('Audio Capture & DSP Resilience Suite', () => {
  describe('AudioDSPManager - Chromium WebAudio Pipeline & Metering', () => {
    let mockDestination: any;
    let mockGainNodes: any[];
    let mockBiquadFilterNode: any;
    let mockAnalyserNode: any;
    let mockSourceNode: any;
    let mockAudioContext: any;
    let originalAudioContext: any;

    beforeEach(() => {
      mockGainNodes = [];
      mockDestination = { id: 'destination' };

      mockBiquadFilterNode = {
        type: 'highpass',
        frequency: {
          setValueAtTime: vi.fn(),
          setTargetAtTime: vi.fn(),
        },
        Q: {
          setValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };

      mockAnalyserNode = {
        fftSize: 512,
        smoothingTimeConstant: 0.25,
        frequencyBinCount: 256,
        connect: vi.fn(),
        getFloatTimeDomainData: vi.fn((arr: Float32Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = 0.05 * Math.sin(i);
          }
        }),
        getByteFrequencyData: vi.fn((arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = i >= 2 && i <= 36 ? 30 : 5;
          }
        }),
      };

      mockSourceNode = {
        connect: vi.fn(),
      };

      mockAudioContext = {
        state: 'suspended',
        currentTime: 0,
        destination: mockDestination,
        resume: vi.fn().mockResolvedValue(undefined),
        createMediaStreamSource: vi.fn(() => mockSourceNode),
        createBiquadFilter: vi.fn(() => mockBiquadFilterNode),
        createGain: vi.fn(() => {
          const gainNode = {
            gain: {
              value: 1,
              setValueAtTime: vi.fn(),
              setTargetAtTime: vi.fn(),
            },
            connect: vi.fn(),
          };
          mockGainNodes.push(gainNode);
          return gainNode;
        }),
        createAnalyser: vi.fn(() => mockAnalyserNode),
        close: vi.fn().mockResolvedValue(undefined),
      };

      originalAudioContext = (window as any).AudioContext;
      // Use standard function instead of arrow function so 'new AudioContext()' succeeds
      (window as any).AudioContext = vi.fn().mockImplementation(function (this: any) {
        return mockAudioContext;
      });

      if (!(window as any).addEventListener) {
        (window as any).addEventListener = vi.fn();
        (window as any).removeEventListener = vi.fn();
      }
    });

    afterEach(() => {
      (window as any).AudioContext = originalAudioContext;
      vi.restoreAllMocks();
    });

    it('connects analyser node through silent sink (gain = 0) to audioContext.destination to avoid Chromium buffer discard', () => {
      const dsp = new AudioDSPManager();
      const mockTrack = {
        kind: 'audio',
        enabled: true,
        stop: vi.fn(),
      };
      const mockStream = new MockMediaStream([mockTrack]) as unknown as MediaStream;

      const track = dsp.attachStream(mockStream, 1.0, {
        highPassFilter: true,
        noiseGate: true,
        noiseGateMode: 'balanced',
      });

      expect(track).toBe(mockTrack);
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(3); // gainNode + silentSinkNode + loopbackGainNode

      // The second gain node is silentSinkNode
      const silentSink = mockGainNodes[1];
      expect(silentSink.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);

      // The third gain node is loopbackGainNode (defaults to 0)
      const loopbackNode = mockGainNodes[2];
      expect(loopbackNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 0);

      // Verify the full graph connections
      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockBiquadFilterNode);
      expect(mockBiquadFilterNode.connect).toHaveBeenCalledWith(mockGainNodes[0]);
      expect(mockGainNodes[0].connect).toHaveBeenCalledWith(mockAnalyserNode);
      expect(mockGainNodes[0].connect).toHaveBeenCalledWith(loopbackNode);
      expect(loopbackNode.connect).toHaveBeenCalledWith(mockDestination);
      expect(mockAnalyserNode.connect).toHaveBeenCalledWith(silentSink);
      expect(silentSink.connect).toHaveBeenCalledWith(mockDestination);

      // Verify loopback activation
      dsp.setLoopback(true, 80);
      expect(loopbackNode.gain.setTargetAtTime).toHaveBeenCalledWith(0.8, 0, 0.02);

      dsp.cleanup();
    });

    it('resumes suspended AudioContext on instantiation and sets unlock listeners', () => {
      const dsp = new AudioDSPManager();
      const mockTrack = { kind: 'audio', enabled: true, stop: vi.fn() };
      const mockStream = new MockMediaStream([mockTrack]) as unknown as MediaStream;

      dsp.attachStream(mockStream);

      expect(mockAudioContext.resume).toHaveBeenCalled();

      dsp.cleanup();
    });

    it('smoothly adjusts input gain and highpass parameters in real-time', () => {
      const dsp = new AudioDSPManager();
      const mockTrack = { kind: 'audio', enabled: true, stop: vi.fn() };
      const mockStream = new MockMediaStream([mockTrack]) as unknown as MediaStream;

      dsp.attachStream(mockStream);

      // Update input volume to 150%
      dsp.setInputGain(150);
      expect(mockGainNodes[0].gain.setTargetAtTime).toHaveBeenCalledWith(1.5, 0, 0.05);

      // Update DSP parameters
      dsp.updateDSPParameters({ highPassFilter: false, inputVolume: 80 });
      expect(mockBiquadFilterNode.frequency.setTargetAtTime).toHaveBeenCalledWith(20, 0, 0.03);
      expect(mockGainNodes[0].gain.setTargetAtTime).toHaveBeenCalledWith(0.8, 0, 0.03);

      dsp.cleanup();
    });

    it('mutes and unmutes track accurately without destroying pipeline', () => {
      const dsp = new AudioDSPManager();
      const mockTrack = { kind: 'audio', enabled: true, stop: vi.fn() };
      const mockStream = new MockMediaStream([mockTrack]) as unknown as MediaStream;

      dsp.attachStream(mockStream);

      dsp.setMuted(true);
      expect(mockTrack.enabled).toBe(false);

      dsp.setMuted(false);
      expect(mockTrack.enabled).toBe(true);

      dsp.cleanup();
    });
  });

  describe('MediaSession - 3-Tier Resilient Microphone Hardware Acquisition', () => {
    let originalMediaDevices: any;

    beforeEach(() => {
      originalMediaDevices = navigator.mediaDevices;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        writable: true,
        configurable: true,
      });
    });

    it('uses ideal deviceId constraint instead of exact constraint to avoid OverconstrainedError', async () => {
      let capturedConstraints: MediaStreamConstraints | undefined;

      const mockTrack = {
        kind: 'audio',
        enabled: false,
        stop: vi.fn(),
        getSettings: () => ({ deviceId: 'mic-device-123' }),
      };

      const mockStream = new MockMediaStream([mockTrack]);

      const getUserMediaMock = vi.fn().mockImplementation(async (constraints: MediaStreamConstraints) => {
        capturedConstraints = constraints;
        return mockStream;
      });

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: getUserMediaMock,
          enumerateDevices: vi.fn().mockResolvedValue([]),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      const mediaSession = new MediaSession();
      const track = await mediaSession.startMicrophone('mic-device-123');

      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      const audioConstraints = capturedConstraints?.audio as MediaTrackConstraints;
      expect(audioConstraints.deviceId).toEqual({ ideal: 'mic-device-123' });
      expect(track.enabled).toBe(true);

      mediaSession.stopMicrophone();
    });

    it('falls back through 3 tiers if studio 48kHz constraints fail on restrictive hardware', async () => {
      const mockTrack = {
        kind: 'audio',
        enabled: false,
        stop: vi.fn(),
        getSettings: () => ({}),
      };
      const mockStream = new MockMediaStream([mockTrack]);

      let attemptCount = 0;
      const getUserMediaMock = vi.fn().mockImplementation(async (constraints: MediaStreamConstraints) => {
        attemptCount++;
        if (attemptCount === 1) {
          // Tier 1 (Studio 48kHz) fails due to hardware restriction
          throw new DOMException('Sample rate not supported', 'NotSupportedError');
        }
        // Tier 2 succeeds
        return mockStream;
      });

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: getUserMediaMock,
          enumerateDevices: vi.fn().mockResolvedValue([]),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      const mediaSession = new MediaSession();
      const track = await mediaSession.startMicrophone();

      expect(attemptCount).toBe(2);
      expect(track).toBe(mockTrack);
      expect(track.enabled).toBe(true);

      mediaSession.stopMicrophone();
    });

    it('falls back to bare { audio: true } tier 3 if both studio and standard constraints fail', async () => {
      const mockTrack = {
        kind: 'audio',
        enabled: false,
        stop: vi.fn(),
        getSettings: () => ({}),
      };
      const mockStream = new MockMediaStream([mockTrack]);

      let attemptCount = 0;
      const getUserMediaMock = vi.fn().mockImplementation(async (constraints: MediaStreamConstraints) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new DOMException('Studio constraints rejected', 'OverconstrainedError');
        }
        if (attemptCount === 2) {
          throw new DOMException('Standard constraints rejected', 'OverconstrainedError');
        }
        // Tier 3 bare audio succeeds
        return mockStream;
      });

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: getUserMediaMock,
          enumerateDevices: vi.fn().mockResolvedValue([]),
          addEventListener: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      const mediaSession = new MediaSession();
      const track = await mediaSession.startMicrophone();

      expect(attemptCount).toBe(3);
      expect(track).toBe(mockTrack);
      expect(track.enabled).toBe(true);

      mediaSession.stopMicrophone();
    });
  });

  describe('Audio SDP & Quality Presets', () => {
    it('generates optimal mono parameters by default for vocal clarity', () => {
      const preset = getOpusOptionsForProfile('balanced', false);
      expect(preset.stereo).toBe(false);
      expect(preset.inbandFec).toBe(true);
      expect(preset.dtx).toBe(true);
      expect(preset.maxBitrate).toBe(128000);
    });

    it('munges Opus SDP preserving mono speech encoding without forced stereo', () => {
      const sampleSdp = [
        'v=0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'a=rtpmap:111 opus/48000/2',
        'a=fmtp:111 minptime=10;useinbandfec=1',
      ].join('\r\n');

      const munged = mungeOpusSDP(sampleSdp, {
        stereo: false,
        maxBitrate: 128000,
        inbandFec: true,
        dtx: true,
      });

      expect(munged).toContain('stereo=0');
      expect(munged).toContain('sprop-stereo=0');
      expect(munged).toContain('useinbandfec=1');
      expect(munged).toContain('usedtx=1');
    });
  });
});
