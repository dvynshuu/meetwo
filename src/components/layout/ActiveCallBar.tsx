import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, ArrowUpRight, Radio, Volume2 } from 'lucide-react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { Tooltip } from '../ui/Tooltip';

interface ActiveCallBarProps {
  onReturnToCall?: () => void;
}

export const ActiveCallBar: React.FC<ActiveCallBarProps> = ({ onReturnToCall }) => {
  const {
    activeRoomId,
    participants,
    isAudioMuted,
    isVideoMuted,
    connectionState,
    toggleAudio,
    toggleVideo,
    leaveVoiceRoom,
  } = useMedia();

  const { channels, selectChannel, selectServer } = useServer();

  if (!activeRoomId) return null;

  // Find channel and server metadata
  const channel = channels.find((c) => c.id === activeRoomId);
  const channelName = channel?.name || 'Voice Channel';
  const isStage = channel?.type === 'stage';

  const handleReturn = () => {
    if (channel) {
      selectServer(channel.serverId);
      selectChannel(channel.id);
    }
    if (onReturnToCall) {
      onReturnToCall();
    }
  };

  return (
    <div className="active-call-bar" role="region" aria-label="Active Call Controller">
      {/* Top info row */}
      <div className="active-call-info" onClick={handleReturn} role="button" title="Click to view call">
        <div className="active-call-status-indicator">
          <span className="pulse-dot" />
          {isStage ? <Radio size={14} className="active-call-icon" /> : <Volume2 size={14} className="active-call-icon" />}
        </div>
        <div className="active-call-details truncate">
          <div className="active-call-title-row">
            <span className="active-call-title truncate">{channelName}</span>
            <ArrowUpRight size={12} className="active-call-arrow" />
          </div>
          <span className="active-call-meta">
            {connectionState === 'connected' ? `${participants.length} connected` : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Controls row */}
      <div className="active-call-controls">
        <Tooltip content={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'} position="top" shortcut="Ctrl+D" style={{ flex: 1, display: 'flex' }}>
          <button
            className={`active-call-btn ${isAudioMuted ? 'muted' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleAudio();
            }}
            aria-label={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        </Tooltip>

        <Tooltip content={isVideoMuted ? 'Start Video' : 'Stop Video'} position="top" shortcut="Ctrl+E" style={{ flex: 1, display: 'flex' }}>
          <button
            className={`active-call-btn ${isVideoMuted ? 'muted' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleVideo();
            }}
            aria-label={isVideoMuted ? 'Start Video' : 'Stop Video'}
          >
            {isVideoMuted ? <VideoOff size={14} /> : <Video size={14} />}
          </button>
        </Tooltip>

        <Tooltip content="Disconnect Call" position="top" style={{ flex: 1, display: 'flex' }}>
          <button
            className="active-call-btn disconnect-btn"
            onClick={(e) => {
              e.stopPropagation();
              leaveVoiceRoom();
            }}
            aria-label="Disconnect Call"
          >
            <PhoneOff size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
