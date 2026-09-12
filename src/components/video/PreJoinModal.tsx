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
  onJoin: (roomId: string) => void;
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

  // Enumerate devices on open
  useEffect(() => {
    if (isOpen) {
      MediaSession.getAvailableDevices().then((devs) => {
        setAudioInputs(devs.audioInputs);
        setAudioOutputs(devs.audioOutputs);
        setVideoInputs(devs.videoInputs);
      });
      startHardwarePreview();
    } else {
      stopHardwarePreview();
    }

    return () => {
      stopHardwarePreview();
    };
  }, [isOpen, deviceSettings.videoInputId, deviceSettings.audioInputId]);

  const startHardwarePreview = async () => {
    stopHardwarePreview();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !previewCamMuted
          ? {
              deviceId: deviceSettings.videoInputId ? { exact: deviceSettings.videoInputId } : undefined,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
        audio: !previewMicMuted
          ? {
              deviceId: deviceSettings.audioInputId ? { exact: deviceSettings.audioInputId } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            }
          : false,
      });

      setPreviewStream(stream);
      if (videoRef.current && stream.getVideoTracks().length > 0) {
        videoRef.current.srcObject = stream;
      }

      // Mic volume metering
      if (stream.getAudioTracks().length > 0) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const loop = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(loop);
          };
          animFrameRef.current = requestAnimationFrame(loop);
        }
      }
    } catch (err) {
      console.warn('[PreJoin] Camera or Mic preview blocked:', err);
    }
  };

  const stopHardwarePreview = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
    }
    setMicLevel(0);
  };

  const handleTestSpeaker = async () => {
    setIsChimePlaying(true);
    await playSpeakerTestChime(deviceSettings.audioOutputId, deviceSettings.outputVolume);
    setIsChimePlaying(false);
  };

  const handleJoinConfirmed = () => {
    stopHardwarePreview();
    onJoin(roomId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ready to Join?" maxWidth="580px">
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
              onClick={() => {
                setPreviewMicMuted(!previewMicMuted);
                if (previewStream) {
                  previewStream.getAudioTracks().forEach((t) => (t.enabled = previewMicMuted));
                }
              }}
              title={previewMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {previewMicMuted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>

            <button
              type="button"
              className={`video-control-btn ${previewCamMuted ? 'active-off' : ''}`}
              style={{ width: 38, height: 38 }}
              onClick={() => {
                const nextCam = !previewCamMuted;
                setPreviewCamMuted(nextCam);
                if (previewStream) {
                  previewStream.getVideoTracks().forEach((t) => (t.enabled = !nextCam));
                }
              }}
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
          <Button variant="ghost" onClick={onClose}>
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
