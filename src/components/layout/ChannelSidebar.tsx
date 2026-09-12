import React, { useState } from 'react';
import {
  Hash,
  Volume2,
  Video,
  Radio,
  MessagesSquare,
  Megaphone,
  Plus,
  ChevronDown,
  ChevronRight,
  PhoneCall,
  UserPlus,
  PanelLeftClose,
  PanelLeft,
  Lock,
} from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import { mockStore } from '../../lib/supabase/mockStore';
import { Channel, ChannelType } from '../../types';
import { UserBar } from './UserBar';

interface ChannelSidebarProps {
  onOpenCreateChannel: (categoryId?: string) => void;
  onOpenSettings: () => void;
  onOpenInvite: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  onOpenCreateChannel,
  onOpenSettings,
  onOpenInvite,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { activeServer, channels, activeChannel, selectChannel } = useServer();
  const { activeRoomId, participants, leaveVoiceRoom, openPreJoin } = useMedia();

  // Collapsed categories state (map of categoryId -> isCollapsed)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleChannelClick = (channel: Channel) => {
    selectChannel(channel.id);
    if (channel.type === 'voice' && activeRoomId !== channel.id) {
      openPreJoin(channel.id);
    }
  };

  // Get categories for current server
  const allCategories = mockStore.getCategories();
  const serverCategories = activeServer
    ? allCategories.filter((cat) => cat.serverId === activeServer.id).sort((a, b) => a.position - b.position)
    : [];

  // Group channels by categoryId
  const channelsByCategory = new Map<string, Channel[]>();
  const uncategorizedChannels: Channel[] = [];

  channels.forEach((chan) => {
    if (chan.categoryId) {
      const existing = channelsByCategory.get(chan.categoryId) || [];
      existing.push(chan);
      channelsByCategory.set(chan.categoryId, existing);
    } else {
      uncategorizedChannels.push(chan);
    }
  });

  const getChannelIcon = (type: ChannelType, name: string) => {
    switch (type) {
      case 'voice':
        return name.toLowerCase().includes('video') || name.toLowerCase().includes('study') ? (
          <Video className="channel-icon" />
        ) : (
          <Volume2 className="channel-icon" />
        );
      case 'stage':
        return <Radio className="channel-icon" />;
      case 'forum':
        return <MessagesSquare className="channel-icon" />;
      case 'announcement':
        return <Megaphone className="channel-icon" />;
      case 'text':
      default:
        return <Hash className="channel-icon" />;
    }
  };

  if (isCollapsed) {
    return (
      <aside className="channel-sidebar collapsed" style={{ width: 48, minWidth: 48 }}>
        <div style={{ padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button className="icon-btn" onClick={onToggleCollapse} title="Expand Sidebar">
            <PanelLeft size={16} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="channel-sidebar" aria-label="Channels">
      {/* Workspace Header */}
      <header className="server-header">
        <h2 className="truncate">{activeServer?.name || 'meetwo'}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={onOpenInvite}
            title="Invite to Workspace"
          >
            <UserPlus size={14} />
          </button>
          {onToggleCollapse && (
            <button
              className="icon-btn"
              style={{ width: 28, height: 28 }}
              onClick={onToggleCollapse}
              title="Collapse Sidebar"
            >
              <PanelLeftClose size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Voice Status Bar (when connected to a room) */}
      {activeRoomId && (
        <div className="voice-status-bar">
          <div className="voice-status-info">
            <span className="voice-status-dot" />
            <div className="voice-status-text">
              <span className="voice-status-title">Voice Connected</span>
              <span className="voice-status-count">{participants.length} connected</span>
            </div>
          </div>
          <button
            className="voice-disconnect-btn"
            onClick={() => leaveVoiceRoom()}
            title="Disconnect from voice room"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* Channel Lists with Categories */}
      <div className="channel-list">
        {serverCategories.length > 0 ? (
          serverCategories.map((cat) => {
            const catChannels = channelsByCategory.get(cat.id) || [];
            const isCategoryCollapsed = !!collapsedCategories[cat.id];

            return (
              <div key={cat.id} style={{ marginBottom: 8 }}>
                {/* Category Header */}
                <div
                  className="channel-category"
                  onClick={(e) => toggleCategory(cat.id, e)}
                  role="button"
                  aria-expanded={!isCategoryCollapsed}
                  title={isCategoryCollapsed ? 'Expand category' : 'Collapse category'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isCategoryCollapsed ? (
                      <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                    ) : (
                      <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
                    )}
                    <span className="truncate">{cat.name}</span>
                  </div>
                  <button
                    className="icon-btn"
                    style={{ width: 18, height: 18 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCreateChannel(cat.id);
                    }}
                    title={`Create channel in ${cat.name}`}
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {/* Category Channels */}
                {!isCategoryCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {catChannels.map((chan) => {
                      const isActive = activeChannel?.id === chan.id;
                      const isCurrentVoice = activeRoomId === chan.id;

                      return (
                        <div key={chan.id}>
                          <div
                            className={`channel-item ${isActive || isCurrentVoice ? 'active' : ''}`}
                            onClick={() => handleChannelClick(chan)}
                          >
                            {getChannelIcon(chan.type, chan.name)}
                            <span className="truncate">{chan.name}</span>
                            {chan.isLocked && (
                              <span className="channel-badge-locked" title="Restricted channel">
                                <Lock size={12} />
                              </span>
                            )}
                            {chan.type === 'stage' && (
                              <span className="channel-badge channel-badge-stage">
                                STAGE
                              </span>
                            )}
                          </div>

                          {/* Show participants inside voice channel */}
                          {chan.type === 'voice' && isCurrentVoice && participants.length > 0 && (
                            <div className="channel-voice-participants">
                              {participants.map((p) => (
                                <div
                                  key={p.id}
                                  className={`channel-participant-row ${p.isSpeaking ? 'speaking' : ''}`}
                                >
                                  <span className={`participant-speaking-dot ${p.isSpeaking ? 'speaking' : ''}`} />
                                  <span className="truncate">{p.displayName || p.username}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // Fallback if no server categories
          <>
            <div className="channel-category">
              <span>Channels</span>
              <button
                className="icon-btn"
                style={{ width: 18, height: 18 }}
                onClick={() => onOpenCreateChannel()}
                title="Create Channel"
              >
                <Plus size={13} />
              </button>
            </div>
            {channels.map((chan) => {
              const isActive = activeChannel?.id === chan.id;
              return (
                <div
                  key={chan.id}
                  className={`channel-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleChannelClick(chan)}
                >
                  {getChannelIcon(chan.type, chan.name)}
                  <span className="truncate">{chan.name}</span>
                </div>
              );
            })}
          </>
        )}

        {/* Uncategorized channels (if any) */}
        {uncategorizedChannels.length > 0 && serverCategories.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="channel-category">
              <span>General</span>
            </div>
            {uncategorizedChannels.map((chan) => {
              const isActive = activeChannel?.id === chan.id;
              return (
                <div
                  key={chan.id}
                  className={`channel-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleChannelClick(chan)}
                >
                  {getChannelIcon(chan.type, chan.name)}
                  <span className="truncate">{chan.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom User Bar */}
      <UserBar onOpenSettings={onOpenSettings} />
    </aside>
  );
};
