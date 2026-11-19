import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, ArrowUpRight, Radio, Volume2, Monitor } from 'lucide-react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { Tooltip } from '../ui/Tooltip';
import { channelRepository } from '../../lib/repositories';

interface ActiveCallBarProps {
  onReturnToCall?: () => void;
}

interface ActiveCallMetadata {
  channelId: string;
  serverId?: string;
  channelName: string;
  isStage: boolean;
}

export const ActiveCallBar: React.FC<ActiveCallBarProps> = ({ onReturnToCall }) => {
  const {
    activeRoomId,
    participants,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    connectionState,
    connectionStats,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    leaveVoiceRoom,
  } = useMedia();

  const { channels, allChannels, selectChannel, selectServer } = useServer();
  const [callMeta, setCallMeta] = useState<ActiveCallMetadata | null>(null);

  // Synchronize and resolve channel & server metadata globally
  useEffect(() => {
    if (!activeRoomId) {
      setCallMeta(null);
      return;
    }

    // 1. Check in all accessible channels or current channels list
    const combinedChannels = allChannels && allChannels.length > 0 ? allChannels : channels;
    const currentChannel = combinedChannels.find((c) => c.id === activeRoomId);
    if (currentChannel) {
      setCallMeta({
        channelId: currentChannel.id,
        serverId: currentChannel.serverId,
        channelName: currentChannel.name,
        isStage: currentChannel.type === 'stage',
      });
      return;
    }

    // 2. Fallback to channelRepository if not yet in local context
    let isCancelled = false;
    channelRepository
      .getAllChannels()
      .then((chans) => {
        if (isCancelled) return;
        const found = chans.find((c) => c.id === activeRoomId);
        if (found) {
          setCallMeta({
            channelId: found.id,
            serverId: found.serverId,
            channelName: found.name,
            isStage: found.type === 'stage',
          });
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [activeRoomId, channels, allChannels]);

  if (!activeRoomId) return null;

  const channelName = callMeta?.channelName || 'Voice Channel';
  const isStage = Boolean(callMeta?.isStage);
  const isConnected = connectionState === 'connected';
  const rtt = connectionStats?.rtt !== undefined ? Math.round(connectionStats.rtt) : null;

  const handleReturn = () => {
    if (callMeta?.serverId) {
      selectServer(callMeta.serverId);
    }
    if (activeRoomId) {
      selectChannel(activeRoomId);
    }
    if (onReturnToCall) {
      onReturnToCall();
    }
  };

  return (
    <div className="active-call-bar" role="region" aria-label="Active Call Controller">
      {/* Top info row */}
      <div className="active-call-info" onClick={handleReturn} role="button" title="Click to view voice call">
        <div
          className="active-call-status-indicator"
          title={rtt !== null ? `Voice Connected • Ping: ${rtt}ms` : 'Voice Connected'}
        >
          <span className={`pulse-dot ${isConnected ? 'active-connected' : ''}`} />
          {isStage ? <Radio size={14} className="active-call-icon" /> : <Volume2 size={14} className="active-call-icon" />}
        </div>
        <div className="active-call-details truncate">
          <div className="active-call-status-heading">
            <span className="active-call-status-text">
              {isConnected ? 'Voice Connected' : 'Connecting...'}
            </span>
            {isConnected && rtt !== null && (
              <span className="active-call-ping">{rtt}ms</span>
            )}
          </div>
          <div className="active-call-title-row">
            <span className="active-call-title truncate">{channelName}</span>
            <ArrowUpRight size={11} className="active-call-arrow" />
          </div>
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

        <Tooltip content={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'} position="top" style={{ flex: 1, display: 'flex' }}>
          <button
            className={`active-call-btn ${isScreenSharing ? 'active-share' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleScreenShare();
            }}
            aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            <Monitor size={14} />
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
