import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  Settings,
  PhoneOff,
  ChevronUp,
  Activity,
  Check,
  Sparkles,
} from 'lucide-react';
import { useMedia } from '../../app/providers/MediaContext';
import { MediaSession } from '../../lib/webrtc/mediaSession';

interface VideoControlsProps {
  onOpenSettings: () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({ onOpenSettings }) => {
  const {
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    connectionState,
    connectionStats,
    deviceSettings,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    switchCamera,
    switchMicrophone,
    leaveVoiceRoom,
  } = useMedia();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [showStatsPopover, setShowStatsPopover] = useState(false);

  const audioMenuRef = useRef<HTMLDivElement>(null);
  const videoMenuRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    MediaSession.getAvailableDevices().then((devs) => {
      setAudioInputs(devs.audioInputs);
      setVideoInputs(devs.videoInputs);
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setShowAudioMenu(false);
      }
      if (videoMenuRef.current && !videoMenuRef.current.contains(e.target as Node)) {
        setShowVideoMenu(false);
      }
      if (statsRef.current && !statsRef.current.contains(e.target as Node)) {
        setShowStatsPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const qualityColor =
    connectionStats.quality === 'excellent'
      ? 'var(--status-online)'
      : connectionStats.quality === 'good'
      ? '#38bdf8'
      : connectionStats.quality === 'fair'
      ? 'var(--status-idle)'
      : 'var(--status-dnd)';

  return (
    <div className="video-controls-bar" id="video-controls">
      {/* 1. Microphone Split Button with Quick Device Picker */}
      <div style={{ position: 'relative' }} ref={audioMenuRef}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className={`video-control-btn ${isAudioMuted ? 'active-off' : ''}`}
            onClick={toggleAudio}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            aria-label={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
          <button
            type="button"
            className="video-control-chevron-btn"
            onClick={() => {
              setShowAudioMenu(!showAudioMenu);
              setShowVideoMenu(false);
              setShowStatsPopover(false);
            }}
            title="Select Microphone"
          >
            <ChevronUp size={13} />
          </button>
        </div>

        {showAudioMenu && (
          <div className="control-quick-menu">
            <div className="control-quick-menu-header">SELECT MICROPHONE</div>
            {audioInputs.map((d) => (
              <button
                key={d.deviceId}
                className={`control-quick-menu-item ${
                  deviceSettings.audioInputId === d.deviceId ? 'selected' : ''
                }`}
                onClick={() => {
                  switchMicrophone(d.deviceId);
                  setShowAudioMenu(false);
                }}
              >
                <span>{d.label || `Microphone (${d.deviceId.slice(0, 6)})`}</span>
                {deviceSettings.audioInputId === d.deviceId && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Camera Split Button with Quick Device Picker */}
      <div style={{ position: 'relative' }} ref={videoMenuRef}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className={`video-control-btn ${isVideoMuted ? 'active-off' : ''}`}
            onClick={toggleVideo}
            title={isVideoMuted ? 'Start Camera' : 'Stop Camera'}
            aria-label={isVideoMuted ? 'Start Camera' : 'Stop Camera'}
          >
            {isVideoMuted ? <VideoOff size={19} /> : <VideoIcon size={19} />}
          </button>
          <button
            type="button"
            className="video-control-chevron-btn"
            onClick={() => {
              setShowVideoMenu(!showVideoMenu);
              setShowAudioMenu(false);
              setShowStatsPopover(false);
            }}
            title="Select Camera"
          >
            <ChevronUp size={13} />
          </button>
        </div>

        {showVideoMenu && (
          <div className="control-quick-menu">
            <div className="control-quick-menu-header">SELECT CAMERA</div>
            {videoInputs.map((d) => (
              <button
                key={d.deviceId}
                className={`control-quick-menu-item ${
                  deviceSettings.videoInputId === d.deviceId ? 'selected' : ''
                }`}
                onClick={() => {
                  switchCamera(d.deviceId);
                  setShowVideoMenu(false);
                }}
              >
                <span>{d.label || `Camera (${d.deviceId.slice(0, 6)})`}</span>
                {deviceSettings.videoInputId === d.deviceId && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Screen Sharing */}
      <button
        className={`video-control-btn ${isScreenSharing ? 'active-screen' : ''}`}
        onClick={toggleScreenShare}
        title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
      >
        <Monitor size={19} />
      </button>

      {/* 4. Connection Health Pill with Real Telemetry Popover */}
      <div style={{ position: 'relative' }} ref={statsRef}>
        <button
          type="button"
          className="connection-status-pill"
          onClick={() => setShowStatsPopover(!showStatsPopover)}
          title="Click to view realtime WebRTC stream metrics"
        >
          <span
            className="status-dot"
            style={{ backgroundColor: qualityColor }}
          />
          <span>
            {connectionState === 'reconnecting'
              ? 'Reconnecting...'
              : connectionStats.rtt !== undefined
              ? `${connectionStats.rtt} ms`
              : connectionStats.quality === 'excellent'
              ? 'Excellent'
              : connectionStats.quality.charAt(0).toUpperCase() + connectionStats.quality.slice(1)}
          </span>
        </button>

        {showStatsPopover && (
          <div className="webrtc-telemetry-popover">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                CALL TELEMETRY (MEASURED)
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: 'var(--accent-light)',
                  fontWeight: 600,
                }}
              >
                {connectionStats.quality.toUpperCase()}
              </span>
            </div>

            <div className="telemetry-grid">
              <div className="telemetry-item">
                <span className="label">ROUND-TRIP (RTT)</span>
                <span className="val" style={{ color: connectionStats.rtt !== undefined ? qualityColor : 'var(--text-muted)' }}>
                  {connectionStats.rtt !== undefined ? `${connectionStats.rtt} ms` : '--'}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">PACKET LOSS</span>
                <span className="val">
                  {connectionStats.packetLoss !== undefined ? `${connectionStats.packetLoss}%` : '--'}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">JITTER</span>
                <span className="val">
                  {connectionStats.jitter !== undefined ? `${connectionStats.jitter} ms` : '--'}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">BITRATE</span>
                <span className="val">
                  {connectionStats.bitrate !== undefined
                    ? connectionStats.bitrate >= 1000
                      ? `${(connectionStats.bitrate / 1000).toFixed(1)} Mbps`
                      : `${connectionStats.bitrate} kbps`
                    : '0 kbps'}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">RESOLUTION</span>
                <span className="val">{connectionStats.resolution || (isVideoMuted ? 'Camera Off' : 'Unavailable')}</span>
              </div>
              <div className="telemetry-item">
                <span className="label">FPS</span>
                <span className="val">{connectionStats.fps !== undefined ? `${connectionStats.fps} fps` : (isVideoMuted ? '--' : 'Unavailable')}</span>
              </div>
              <div className="telemetry-item">
                <span className="label">AUDIO CODEC</span>
                <span className="val" style={{ color: 'var(--accent-light)' }}>
                  {connectionStats.audioCodec || (isAudioMuted ? 'Muted' : 'Opus 48kHz')}
                </span>
              </div>
              <div className="telemetry-item">
                <span className="label">VIDEO CODEC</span>
                <span className="val" style={{ color: 'var(--text-secondary)' }}>
                  {connectionStats.videoCodec || (isVideoMuted ? '--' : 'VP8 / H.264')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Device Settings */}
      <button
        className="video-control-btn"
        onClick={onOpenSettings}
        title="Voice & Video Settings"
        aria-label="Settings"
      >
        <Settings size={19} />
      </button>

      {/* 6. Disconnect */}
      <button
        className="video-control-btn leave-btn"
        onClick={() => leaveVoiceRoom()}
        title="Disconnect"
        aria-label="Disconnect"
      >
        <PhoneOff size={19} />
      </button>
    </div>
  );
};
