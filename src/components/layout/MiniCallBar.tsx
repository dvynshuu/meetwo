import React, { useState, useEffect } from 'react';
import { Volume2, Radio, Mic, MicOff, PhoneOff, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { channelRepository } from '../../lib/repositories';

interface MiniCallBarProps {
  onReturnToCall: () => void;
  isFullCallViewActive: boolean;
}

export const MiniCallBar: React.FC<MiniCallBarProps> = ({
  onReturnToCall,
  isFullCallViewActive,
}) => {
  const {
    activeRoomId,
    participants,
    isAudioMuted,
    toggleAudio,
    leaveVoiceRoom,
    connectionState,
    isSpeaking,
  } = useMedia();

  const { channels, allChannels, selectChannel, selectServer } = useServer();
  const [channelMeta, setChannelMeta] = useState<{
    name: string;
    isStage: boolean;
    serverId?: string;
  } | null>(null);

  useEffect(() => {
    if (!activeRoomId) {
      setChannelMeta(null);
      return;
    }

    const combined = allChannels && allChannels.length > 0 ? allChannels : channels;
    const found = combined.find((c) => c.id === activeRoomId);
    if (found) {
      setChannelMeta({
        name: found.name,
        isStage: found.type === 'stage',
        serverId: found.serverId,
      });
      return;
    }

    channelRepository.getAllChannels().then((all) => {
      const match = all.find((c) => c.id === activeRoomId);
      if (match) {
        setChannelMeta({
          name: match.name,
          isStage: match.type === 'stage',
          serverId: match.serverId,
        });
      }
    });
  }, [activeRoomId, channels, allChannels]);

  // Only render when connected to a call AND not currently inside the full call view!
  if (!activeRoomId || isFullCallViewActive) {
    return null;
  }

  const roomName = channelMeta?.name || 'Voice Room';
  const isStage = Boolean(channelMeta?.isStage);

  const handleReturn = () => {
    if (channelMeta?.serverId) {
      selectServer(channelMeta.serverId);
    }
    if (activeRoomId) {
      selectChannel(activeRoomId);
    }
    onReturnToCall();
  };

  return (
    <aside
      className="mobile-mini-call-bar"
      role="region"
      aria-label="Active Call Pill"
      onClick={handleReturn}
    >
      <div className="mobile-mini-call-left">
        <div className={`mobile-mini-call-pulse ${isSpeaking ? 'is-speaking' : ''}`}>
          <span className="mini-pulse-ring" />
          {isStage ? <Radio size={14} /> : <Volume2 size={14} />}
        </div>
        <div className="mobile-mini-call-meta truncate">
          <span className="mobile-mini-call-title truncate">{roomName}</span>
          <span className="mobile-mini-call-sub">
            {connectionState === 'connected'
              ? `${participants.length} connected`
              : 'Connecting...'}
          </span>
        </div>
      </div>

      <div className="mobile-mini-call-actions" onClick={(e) => e.stopPropagation()}>
        {/* Mute Toggle */}
        <button
          type="button"
          className={`mobile-mini-call-btn ${isAudioMuted ? 'muted' : ''}`}
          onClick={toggleAudio}
          aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        {/* Return Button */}
        <button
          type="button"
          className="mobile-mini-call-return-btn"
          onClick={handleReturn}
          aria-label="Return to full call"
        >
          <span>Return</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    </aside>
  );
};
