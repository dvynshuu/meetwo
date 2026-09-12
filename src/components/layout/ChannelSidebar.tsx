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
  const { activeRoomId, participants, leaveVoiceRoom, joinVoiceRoom } = useMedia();

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
    if (channel.type === 'voice') {
      joinVoiceRoom(channel.id);
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
        return <Radio className="channel-icon" style={{ color: '#F43F5E' }} />;
      case 'forum':
        return <MessagesSquare className="channel-icon" style={{ color: '#A855F7' }} />;
      case 'announcement':
        return <Megaphone className="channel-icon" style={{ color: 'var(--status-idle)' }} />;
      case 'text':
      default:
        return <Hash className="channel-icon" />;
    }
  };

  if (isCollapsed) {
    return (
      <aside className="channel-sidebar collapsed" style={{ width: 48, minWidth: 48 }}>
        <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button className="icon-btn" onClick={onToggleCollapse} title="Expand Channels">
            <PanelLeft size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="channel-sidebar" aria-label="Channels sidebar">
      {/* Server Header */}
      <header className="server-header">
        <h2 className="truncate">{activeServer?.name || 'Select a Server'}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="icon-btn"
            style={{ width: 28, height: 28 }}
            onClick={onOpenInvite}
            title="Invite Friends"
          >
            <UserPlus size={15} />
          </button>
          {onToggleCollapse && (
            <button
              className="icon-btn"
              style={{ width: 28, height: 28 }}
              onClick={onToggleCollapse}
              title="Collapse Channel Bar"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
      </header>

      {/* Voice Status Pill if in a room */}
      {activeRoomId && (
        <div
          style={{
            margin: '8px 10px',
            padding: '8px 12px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PhoneCall size={16} style={{ color: 'var(--status-online)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-online)' }}>
                Voice Connected
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {participants.length} in room
              </span>
            </div>
          </div>
          <button
            onClick={() => leaveVoiceRoom()}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: 'var(--danger-surface)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
            }}
          >
            Leave
          </button>
        </div>
      )}

      {/* Channel Lists with Categories */}
      <div className="channel-list">
        {serverCategories.length > 0 ? (
          // Render defined categories
          serverCategories.map((cat) => {
            const catChannels = channelsByCategory.get(cat.id) || [];
            const isCategoryCollapsed = !!collapsedCategories[cat.id];

            return (
              <div key={cat.id} style={{ marginBottom: 12 }}>
                {/* Category Header */}
                <div
                  className="channel-category"
                  onClick={(e) => toggleCategory(cat.id, e)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isCategoryCollapsed ? (
                      <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                    ) : (
                      <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
                    )}
                    <span className="truncate" style={{ fontSize: 11, letterSpacing: '0.04em' }}>
                      {cat.name}
                    </span>
                  </div>
                  <button
                    className="icon-btn"
                    style={{ width: 20, height: 20 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCreateChannel(cat.id);
                    }}
                    title={`Create Channel in ${cat.name}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Category Channels */}
                {!isCategoryCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                            {chan.type === 'stage' && (
                              <span
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: 9,
                                  fontWeight: 800,
                                  background: 'rgba(244, 63, 94, 0.2)',
                                  color: '#F43F5E',
                                  padding: '1px 5px',
                                  borderRadius: 'var(--radius-pill)',
                                }}
                              >
                                LIVE
                              </span>
                            )}
                          </div>

                          {/* Show participants inside voice channel */}
                          {chan.type === 'voice' && isCurrentVoice && participants.length > 0 && (
                            <div style={{ paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: 4, margin: '4px 0' }}>
                              {participants.map((p) => (
                                <div
                                  key={p.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 12,
                                    color: p.isSpeaking ? 'var(--status-online)' : 'var(--text-muted)',
                                    fontWeight: p.isSpeaking ? 600 : 400,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      backgroundColor: p.isSpeaking ? 'var(--status-online)' : 'var(--text-dim)',
                                    }}
                                  />
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
          // Fallback legacy grouped view if no server categories
          <>
            <div className="channel-category">
              <span>Text Channels</span>
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                onClick={() => onOpenCreateChannel()}
                title="Create Channel"
              >
                <Plus size={14} />
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
          <div style={{ marginTop: 12 }}>
            <div className="channel-category">
              <span>Other Channels</span>
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
