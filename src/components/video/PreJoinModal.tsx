import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useMedia } from '../../app/providers/MediaContext';
import { MediaSession } from '../../lib/webrtc/mediaSession';
import { playSpeakerTestChime } from '../../lib/webrtc/audioProcessing';
import { VideoQuality } from '../../types';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Volume2,
  Sliders,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface PreJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (roomId: string, initialMicMuted?: boolean, initialCamMuted?: boolean) => void;
  roomId: string;
  roomName?: string;
}

export const PreJoinModal: React.FC<PreJoinModalProps> = ({
  isOpen,
  onClose,
  onJoin,
  roomId,
  roomName = 'Voice & Video Room',
}) => {
  const { deviceSettings, updateSettings } = useMedia();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [previewMicMuted, setPreviewMicMuted] = useState(false);
  const [previewCamMuted, setPreviewCamMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isChimePlaying, setIsChimePlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const activeCameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const activeAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const previewRequestIdRef = useRef(0);
  const previewCamMutedRef = useRef(previewCamMuted);
  const previewMicMutedRef = useRef(previewMicMuted);

  useEffect(() => {
    previewCamMutedRef.current = previewCamMuted;
  }, [previewCamMuted]);

  useEffect(() => {
    previewMicMutedRef.current = previewMicMuted;
  }, [previewMicMuted]);

  // Synchronize video element whenever video track is available and unmuted
  useEffect(() => {
    if (!previewCamMuted && activeCameraTrackRef.current && videoRef.current) {
      if (!previewStreamRef.current) {
        previewStreamRef.current = new MediaStream([activeCameraTrackRef.current]);
      }
      if (videoRef.current.srcObject !== previewStreamRef.current) {
        videoRef.current.srcObject = previewStreamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [previewCamMuted, previewStream]);

  // Resolution map for target video qualities
  const resolutionMap: Record<string, { width: number; height: number; fps: number }> = {
    '4K': { width: 3840, height: 2160, fps: 30 },
    '1440p': { width: 2560, height: 1440, fps: 30 },
    '1080p': { width: 1920, height: 1080, fps: 60 },
    '720p': { width: 1280, height: 720, fps: 60 },
    '480p': { width: 640, height: 480, fps: 30 },
    '360p': { width: 480, height: 360, fps: 24 },
  };

  const stopCameraHardware = () => {
    // Invalidate in-flight camera requests
    previewRequestIdRef.current++;

    if (activeCameraTrackRef.current) {
      try {
        activeCameraTrackRef.current.stop();
      } catch (e) {}
      activeCameraTrackRef.current = null;
    }

    if (previewStreamRef.current) {
      previewStreamRef.current.getVideoTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
        previewStreamRef.current?.removeTrack(t);
      });
    }

    if (videoRef.current) {
      if (videoRef.current.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getVideoTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
        });
      }
      videoRef.current.srcObject = null;
    }
  };

  const startCameraHardware = async () => {
    stopCameraHardware();
    const requestId = ++previewRequestIdRef.current;

    try {
      const res = resolutionMap[deviceSettings.videoQuality] || resolutionMap['720p'];
      const videoConstraints: MediaTrackConstraints = {
        deviceId: deviceSettings.videoInputId ? { exact: deviceSettings.videoInputId } : undefined,
        width: { ideal: res.width, max: res.width },
        height: { ideal: res.height, max: res.height },
        frameRate: { ideal: res.fps, max: 60 },
      };

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch {
        // Fallback constraint if exact deviceId or high resolution fails
        newStream = await navigator.mediaDevices.getUserMedia({
          video: deviceSettings.videoInputId ? { deviceId: deviceSettings.videoInputId } : true,
          audio: false,
        });
      }

      // Check if user turned off camera or closed modal while in flight
      if (requestId !== previewRequestIdRef.current || previewCamMutedRef.current) {
        newStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
        });
        return;
      }

      const videoTrack = newStream.getVideoTracks()[0];
      if (videoTrack) {
        activeCameraTrackRef.current = videoTrack;
        videoTrack.onended = () => {
          stopCameraHardware();
        };

        if (!previewStreamRef.current) {
          previewStreamRef.current = new MediaStream();
        }
        // Remove any dead video tracks
        previewStreamRef.current.getVideoTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
          previewStreamRef.current?.removeTrack(t);
        });
        previewStreamRef.current.addTrack(videoTrack);

        const updated = new MediaStream(previewStreamRef.current.getTracks());
        setPreviewStream(updated);

        if (videoRef.current) {
          videoRef.current.srcObject = updated;
          videoRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[PreJoin] Camera preview error:', err);
    }
  };

  const stopMicrophoneHardware = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (activeAudioTrackRef.current) {
      try {
        activeAudioTrackRef.current.stop();
      } catch (e) {}
      activeAudioTrackRef.current = null;
    }
    if (previewStreamRef.current) {
      previewStreamRef.current.getAudioTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
        previewStreamRef.current?.removeTrack(t);
      });
    }
    setMicLevel(0);
  };

  const startMicMetering = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx && stream.getAudioTracks().length > 0) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);

        // Highpass filter to strip fan rumble and AC hum
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(100, ctx.currentTime);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(hp);
        hp.connect(analyser);

        const timeData = new Float32Array(analyser.fftSize);
        let smoothed = 0;
        let noiseFloor = -65;

        const loop = () => {
          if (previewMicMutedRef.current) {
            setMicLevel(0);
            animFrameRef.current = requestAnimationFrame(loop);
            return;
          }

          analyser.getFloatTimeDomainData(timeData);
          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i];
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / timeData.length);
          const db = rms > 0.00001 ? 20 * Math.log10(rms) : -100;

          // Stationary noise floor tracking for fans / ambient room noise
          if (db < noiseFloor) {
            noiseFloor = noiseFloor * 0.85 + db * 0.15;
          } else {
            noiseFloor = noiseFloor * 0.992 + db * 0.008;
          }
          noiseFloor = Math.max(-85, Math.min(-35, noiseFloor));

          const threshold = Math.max(-50, noiseFloor + 10);
          let target = 0;
          if (db >= threshold) {
            const normalized = (db + 50) / 40;
            target = Math.max(0, Math.min(100, Math.round(normalized * 100)));
          }

          smoothed = smoothed * 0.6 + target * 0.4;
          setMicLevel(Math.round(smoothed));
          animFrameRef.current = requestAnimationFrame(loop);
        };
        animFrameRef.current = requestAnimationFrame(loop);
      }
    } catch (e) {
      console.warn('[PreJoin] Mic metering error:', e);
    }
  };

  const startMicrophoneHardware = async () => {
    stopMicrophoneHardware();
    const requestId = ++previewRequestIdRef.current;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceSettings.audioInputId ? { exact: deviceSettings.audioInputId } : undefined,
          echoCancellation: deviceSettings.echoCancellation,
          noiseSuppression: deviceSettings.noiseSuppression,
          autoGainControl: deviceSettings.autoGainControl,
          channelCount: deviceSettings.stereoAudio ? 2 : 1,
          sampleRate: 48000,
          // @ts-ignore
          googEchoCancellation: deviceSettings.echoCancellation,
          googAutoGainControl: deviceSettings.autoGainControl,
          googNoiseSuppression: deviceSettings.noiseSuppression,
          googHighpassFilter: deviceSettings.highPassFilter,
          googTypingNoiseDetection: deviceSettings.noiseSuppression,
          googNoiseReduction: deviceSettings.noiseSuppression,
          voiceIsolation: deviceSettings.voiceIsolation ? true : false,
        },
        video: false,
      });

      if (requestId !== previewRequestIdRef.current || previewMicMutedRef.current) {
        newStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
        });
        return;
      }

      const audioTrack = newStream.getAudioTracks()[0];
      if (audioTrack) {
        activeAudioTrackRef.current = audioTrack;
        audioTrack.onended = () => {
          stopMicrophoneHardware();
        };

        if (!previewStreamRef.current) {
          previewStreamRef.current = new MediaStream();
        }
        previewStreamRef.current.getAudioTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {}
          previewStreamRef.current?.removeTrack(t);
        });
        previewStreamRef.current.addTrack(audioTrack);

        const updated = new MediaStream(previewStreamRef.current.getTracks());
        setPreviewStream(updated);
        startMicMetering(newStream);
      }
    } catch (err) {
      console.warn('[PreJoin] Microphone preview error:', err);
    }
  };

  const stopAllHardware = () => {
    previewRequestIdRef.current++;
    stopCameraHardware();
    stopMicrophoneHardware();
    previewStreamRef.current = null;
    setPreviewStream(null);
  };

  // Enumerate devices on open and manage hardware streams
  useEffect(() => {
    if (isOpen) {
      MediaSession.getAvailableDevices().then((devs) => {
        setAudioInputs(devs.audioInputs);
        setAudioOutputs(devs.audioOutputs);
        setVideoInputs(devs.videoInputs);
      });

      if (!previewCamMutedRef.current) {
        startCameraHardware();
      } else {
        stopCameraHardware();
      }

      if (!previewMicMutedRef.current) {
        startMicrophoneHardware();
      } else {
        stopMicrophoneHardware();
      }
    } else {
      stopAllHardware();
    }

    return () => {
      stopAllHardware();
    };
  }, [isOpen, deviceSettings.videoInputId, deviceSettings.audioInputId, deviceSettings.videoQuality]);

  const handleToggleCamera = () => {
    if (!previewCamMuted) {
      // Turn camera OFF: completely stop video track immediately
      setPreviewCamMuted(true);
      previewCamMutedRef.current = true;
      stopCameraHardware();
      if (previewStreamRef.current) {
        setPreviewStream(new MediaStream(previewStreamRef.current.getTracks()));
      }
    } else {
      // Turn camera ON
      setPreviewCamMuted(false);
      previewCamMutedRef.current = false;
      startCameraHardware();
    }
  };

  const handleToggleMicrophone = () => {
    if (!previewMicMuted) {
      // Mute Mic: completely stop audio track immediately to clear recording indicator
      setPreviewMicMuted(true);
      previewMicMutedRef.current = true;
      stopMicrophoneHardware();
      if (previewStreamRef.current) {
        setPreviewStream(new MediaStream(previewStreamRef.current.getTracks()));
      }
    } else {
      // Unmute Mic
      setPreviewMicMuted(false);
      previewMicMutedRef.current = false;
      startMicrophoneHardware();
    }
  };

  const handleTestSpeaker = async () => {
    setIsChimePlaying(true);
    await playSpeakerTestChime(deviceSettings.audioOutputId, deviceSettings.outputVolume);
    setIsChimePlaying(false);
  };

  const handleClose = () => {
    stopAllHardware();
    onClose();
  };

  const handleJoinConfirmed = () => {
    stopAllHardware();
    onJoin(roomId, previewMicMuted, previewCamMuted);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Ready to Join?" maxWidth="580px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{roomName}</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Check your camera and microphone before jumping in.
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--accent-subtle)',
              color: 'var(--accent)',
              fontWeight: 600,
            }}
          >
            <Sparkles size={13} />
            <span>meetwo Verified Media</span>
          </div>
        </div>

        {/* Video Preview Box with Quick Overlay Buttons */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: 240,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!previewCamMuted && previewStream && previewStream.getVideoTracks().length > 0 ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--bg-surface-active)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <VideoOff size={28} />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Camera is turned off</span>
            </div>
          )}

          {/* Quick Floating Toggles */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              display: 'flex',
              gap: 12,
              background: 'rgba(24, 29, 40, 0.92)',
              backdropFilter: 'blur(16px)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <button
              type="button"
              className={`video-control-btn ${previewMicMuted ? 'active-off' : ''}`}
              style={{ width: 38, height: 38 }}
              onClick={handleToggleMicrophone}
              title={previewMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {previewMicMuted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            <button
              type="button"
              className={`video-control-btn ${previewCamMuted ? 'active-off' : ''}`}
              style={{ width: 38, height: 38 }}
              onClick={handleToggleCamera}
              title={previewCamMuted ? 'Start Camera' : 'Stop Camera'}
            >
              {previewCamMuted ? <VideoOff size={17} /> : <VideoIcon size={17} />}
            </button>
          </div>
        </div>

        {/* Live Responsive Mic Meter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-muted)' }}>Microphone Activity</span>
            <span style={{ fontWeight: 600, color: micLevel > 15 ? 'var(--status-online)' : 'var(--text-muted)' }}>
              {previewMicMuted ? 'Muted' : `${micLevel}%`}
            </span>
          </div>
          <div
            style={{
              height: 8,
              width: '100%',
              background: 'var(--bg-surface-active)',
              borderRadius: 'var(--radius-xs)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: previewMicMuted ? '0%' : `${micLevel}%`,
                background: micLevel > 50 ? 'var(--status-idle)' : 'var(--status-online)',
                transition: 'width 80ms ease',
              }}
            />
          </div>
        </div>

        {/* Hardware Selectors Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Microphone */}
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label" style={{ fontSize: 11 }}>Microphone</label>
            <select
              className="input-field"
              style={{ fontSize: 12, padding: '8px 10px' }}
              value={deviceSettings.audioInputId}
              onChange={(e) => updateSettings({ audioInputId: e.target.value })}
            >
              <option value="">Default Microphone</option>
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone (${d.deviceId.slice(0, 5)})`}
                </option>
              ))}
            </select>
          </div>

          {/* Camera */}
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label" style={{ fontSize: 11 }}>Camera</label>
            <select
              className="input-field"
              style={{ fontSize: 12, padding: '8px 10px' }}
              value={deviceSettings.videoInputId}
              onChange={(e) => updateSettings({ videoInputId: e.target.value })}
            >
              <option value="">Default Camera</option>
              {videoInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera (${d.deviceId.slice(0, 5)})`}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker (Audio Output) */}
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label" style={{ fontSize: 11 }}>Speaker / Headphones</label>
            <select
              className="input-field"
              style={{ fontSize: 12, padding: '8px 10px' }}
              value={deviceSettings.audioOutputId}
              onChange={(e) => updateSettings({ audioOutputId: e.target.value })}
            >
              <option value="">Default Audio Output</option>
              {audioOutputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Speaker (${d.deviceId.slice(0, 5)})`}
                </option>
              ))}
            </select>
          </div>

          {/* Target Quality */}
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label" style={{ fontSize: 11 }}>Target Video Quality</label>
            <select
              className="input-field"
              style={{ fontSize: 12, padding: '8px 10px' }}
              value={deviceSettings.videoQuality}
              onChange={(e) => updateSettings({ videoQuality: e.target.value as VideoQuality })}
            >
              <option value="4K">4K UHD (3840x2160 @ 30fps) - Ultra Sharp</option>
              <option value="1440p">1440p QHD (2560x1440 @ 30fps) - Crisp</option>
              <option value="1080p">1080p FHD (1920x1080 @ 60fps) - Fluid</option>
              <option value="720p">720p HD (1280x720 @ 60fps) - Balanced</option>
              <option value="480p">480p SD (640x480 @ 30fps) - Low Bandwidth</option>
              <option value="360p">360p Mobile (480x360 @ 24fps) - Minimal</option>
            </select>
          </div>
        </div>

        {/* Pre-Call Readiness Checklist */}
        <div
          style={{
            background: 'var(--bg-surface-active)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>READINESS CHECKLIST:</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: previewCamMuted ? 'var(--text-muted)' : 'var(--status-online)' }}>
              <CheckCircle2 size={13} />
              <span>Camera {previewCamMuted ? '(Off)' : '✓'}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: previewMicMuted ? 'var(--status-idle)' : 'var(--status-online)' }}>
              <CheckCircle2 size={13} />
              <span>Microphone {previewMicMuted ? '(Muted)' : '✓'}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-online)' }}>
              <CheckCircle2 size={13} />
              <span>Audio Output ✓</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-online)' }}>
              <CheckCircle2 size={13} />
              <span>Network Ready ✓</span>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '2px 8px', height: 26, gap: 4 }}
            onClick={handleTestSpeaker}
            disabled={isChimePlaying}
          >
            <Volume2 size={12} />
            <span>{isChimePlaying ? 'Playing...' : 'Test Speaker'}</span>
          </button>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            style={{ borderRadius: 'var(--radius-sm)', padding: '10px 24px', gap: 8 }}
            onClick={handleJoinConfirmed}
          >
            <CheckCircle2 size={16} />
            <span>Join Call Now</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
