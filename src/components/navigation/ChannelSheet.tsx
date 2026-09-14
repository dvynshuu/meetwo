import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import {
  Hash,
  Volume2,
  Video,
  Radio,
  MessagesSquare,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  Users,
} from 'lucide-react';
import { Channel } from '../../types';

interface ChannelSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateChannel?: () => void;
  onOpenWorkspaceSheet?: () => void;
}

export const ChannelSheet: React.FC<ChannelSheetProps> = ({
  isOpen,
  onClose,
  onOpenCreateChannel,
  onOpenWorkspaceSheet,
}) => {
  const { activeServer, activeChannel, channels, selectChannel } = useServer();
  const { activeRoomId, participants, openPreJoin } = useMedia();

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (catName: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  // Group channels by category
  const categories = channels.reduce<Record<string, Channel[]>>((acc, chan) => {
    const cat = chan.categoryId || 'GENERAL';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(chan);
    return acc;
  }, {});

  const renderChannelIcon = (type: Channel['type'], name: string) => {
    switch (type) {
      case 'voice':
        return name.toLowerCase().includes('video') ? (
          <Video size={17} className="channel-icon" />
        ) : (
          <Volume2 size={17} className="channel-icon" />
        );
      case 'stage':
        return <Radio size={17} className="channel-icon" />;
      case 'forum':
        return <MessagesSquare size={17} className="channel-icon" />;
      case 'text':
      default:
        return <Hash size={17} className="channel-icon" />;
    }
  };

  const handleChannelClick = (channel: Channel) => {
    selectChannel(channel.id);
    onClose();

    // If clicking a voice or stage room that is not currently connected, open pre-join
    if (channel.type === 'voice' && activeRoomId !== channel.id) {
      openPreJoin(channel.id);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div
          className="mobile-channel-sheet-header-title"
          onClick={() => {
            onClose();
            onOpenWorkspaceSheet?.();
          }}
          role="button"
        >
          <span className="truncate">{activeServer?.name || 'Workspace Channels'}</span>
          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
      }
      headerAction={
        onOpenCreateChannel ? (
          <button
            type="button"
            className="mobile-sheet-action-btn"
            onClick={() => {
              onClose();
              onOpenCreateChannel();
            }}
            aria-label="Create Channel"
          >
            <Plus size={16} />
            <span>New</span>
          </button>
        ) : null
      }
      maxHeight="82vh"
    >
      <div className="mobile-channel-list">
        {Object.entries(categories).map(([catKey, chans]) => {
          const isCollapsed = Boolean(collapsedCategories[catKey]);
          const catTitle = catKey.toUpperCase();

          return (
            <div key={catKey} className="mobile-channel-category-group">
              <div
                className="mobile-channel-category-header"
                onClick={() => toggleCategory(catKey)}
                role="button"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>{catTitle}</span>
              </div>

              {!isCollapsed && (
                <div className="mobile-category-channels">
                  {chans.map((chan) => {
                    const isSelected = activeChannel?.id === chan.id;
                    const isRoomConnected = activeRoomId === chan.id;
                    const isVoiceOrStage = chan.type === 'voice' || chan.type === 'stage';

                    return (
                      <div
                        key={chan.id}
                        className={`mobile-channel-row ${isSelected ? 'selected' : ''} ${
                          isRoomConnected ? 'in-call' : ''
                        }`}
                        onClick={() => handleChannelClick(chan)}
                        role="button"
                      >
                        <div className="mobile-channel-row-left">
                          {renderChannelIcon(chan.type, chan.name)}
                          <span className="mobile-channel-name truncate">{chan.name}</span>
                        </div>

                        <div className="mobile-channel-row-right">
                          {isVoiceOrStage && (
                            <span className="mobile-channel-participants-badge">
                              <Users size={12} />
                              <span>{isRoomConnected ? participants.length : 0}</span>
                            </span>
                          )}
                          {isSelected && <Check size={16} className="mobile-channel-check" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
};
