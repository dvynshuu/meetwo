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
} from 'lucide-react';
import { useMedia } from '../../app/providers/MediaContext';
import { MediaSession } from '../../lib/webrtc/mediaSession';
import { DiagnosticsModal } from './DiagnosticsModal';
import { Tooltip } from '../ui/Tooltip';

interface VideoControlsProps {
  onOpenSettings: () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({ onOpenSettings }) => {
  const {
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    deviceSettings,
    isDiagnosticsOpen,
    closeDiagnostics,
    toggleDiagnostics,
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

  const audioMenuRef = useRef<HTMLDivElement>(null);
  const videoMenuRef = useRef<HTMLDivElement>(null);

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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAnyMenuOpen = showVideoMenu || showAudioMenu || isDiagnosticsOpen;

  return (
    <div
      className={`video-controls-dock ${isAnyMenuOpen ? 'dock-active' : ''}`}
      id="video-controls"
      role="toolbar"
      aria-label="Call controls"
    >
      {/* 1. Camera Toggle with integrated split picker */}
      <div className={`dock-split-wrapper ${showVideoMenu ? 'menu-open' : ''}`} ref={videoMenuRef}>
        <Tooltip content={isVideoMuted ? 'Turn on Camera (Ctrl+E)' : 'Turn off Camera (Ctrl+E)'} position="top">
          <button
            className={`dock-btn ${isVideoMuted ? 'dock-btn-off' : 'dock-btn-active'}`}
            onClick={toggleVideo}
            aria-label={isVideoMuted ? 'Turn on Camera' : 'Turn off Camera'}
          >
            {isVideoMuted ? <VideoOff size={19} /> : <VideoIcon size={19} />}
          </button>
        </Tooltip>
        <Tooltip content="Camera Settings" position="top" className="dock-arrow-tooltip">
          <button
            type="button"
            className="dock-arrow-btn"
            onClick={() => {
              setShowVideoMenu(!showVideoMenu);
              setShowAudioMenu(false);
            }}
            aria-label="Select camera"
          >
            <ChevronUp size={12} />
          </button>
        </Tooltip>

        {showVideoMenu && (
          <div className="control-quick-menu">
            <div className="control-quick-menu-header">SELECT CAMERA</div>
            {videoInputs.length === 0 ? (
              <div className="control-quick-menu-empty">No cameras detected</div>
            ) : (
              videoInputs.map((d) => (
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
                  <span className="truncate">{d.label || `Camera (${d.deviceId.slice(0, 6)})`}</span>
                  {deviceSettings.videoInputId === d.deviceId && <Check size={13} />}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 2. Screen Sharing */}
      <Tooltip content={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'} position="top">
        <button
          className={`dock-btn ${isScreenSharing ? 'dock-btn-screenshare' : ''}`}
          onClick={toggleScreenShare}
          aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          <Monitor size={19} />
        </button>
      </Tooltip>

      {/* 3. Microphone Toggle with Discord red-muted pill style */}
      <div
        className={`dock-split-wrapper ${isAudioMuted ? 'dock-split-danger' : ''} ${showAudioMenu ? 'menu-open' : ''}`}
        ref={audioMenuRef}
      >
        <Tooltip content={isAudioMuted ? 'Unmute Mic (Ctrl+D)' : 'Mute Mic (Ctrl+D)'} position="top">
          <button
            className={`dock-btn ${isAudioMuted ? 'dock-btn-muted-danger' : 'dock-btn-active'}`}
            onClick={toggleAudio}
            aria-label={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isAudioMuted ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
        </Tooltip>
        <Tooltip content="Microphone Settings" position="top" className="dock-arrow-tooltip">
          <button
            type="button"
            className="dock-arrow-btn"
            onClick={() => {
              setShowAudioMenu(!showAudioMenu);
              setShowVideoMenu(false);
            }}
            aria-label="Select microphone"
          >
            <ChevronUp size={12} />
          </button>
        </Tooltip>

        {showAudioMenu && (
          <div className="control-quick-menu">
            <div className="control-quick-menu-header">SELECT MICROPHONE</div>
            {audioInputs.length === 0 ? (
              <div className="control-quick-menu-empty">No microphones detected</div>
            ) : (
              audioInputs.map((d) => (
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
                  <span className="truncate">{d.label || `Microphone (${d.deviceId.slice(0, 6)})`}</span>
                  {deviceSettings.audioInputId === d.deviceId && <Check size={13} />}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* 4. Telemetry & Diagnostics */}
      <Tooltip content="Stream Telemetry (Diagnostics)" position="top">
        <button
          type="button"
          className={`dock-btn ${isDiagnosticsOpen ? 'dock-btn-active' : ''}`}
          onClick={toggleDiagnostics}
          aria-label="Stream Diagnostics"
        >
          <Activity size={19} />
        </button>
      </Tooltip>

      {/* 5. Device Settings */}
      <Tooltip content="Voice & Video Settings" position="top">
        <button
          className="dock-btn"
          onClick={onOpenSettings}
          aria-label="Settings"
        >
          <Settings size={19} />
        </button>
      </Tooltip>

      {/* Subtle Separator */}
      <div className="dock-separator" />

      {/* 6. Disconnect Button (Discord Red Pill) */}
      <Tooltip content="Disconnect" position="top">
        <button
          className="dock-disconnect-btn"
          onClick={() => leaveVoiceRoom()}
          aria-label="Disconnect from call"
        >
          <PhoneOff size={18} />
          <span className="dock-disconnect-text">Disconnect</span>
        </button>
      </Tooltip>

      {/* Diagnostics Modal */}
      <DiagnosticsModal isOpen={isDiagnosticsOpen} onClose={closeDiagnostics} />
    </div>
  );
};
