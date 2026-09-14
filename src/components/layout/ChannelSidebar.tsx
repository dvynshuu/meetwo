import React, { useState, useEffect, useRef } from 'react';
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
  Compass,
  CheckCheck,
  Settings,
  MoreVertical,
} from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import { useInbox } from '../../app/providers/InboxContext';
import { Channel, ChannelType } from '../../types';
import { UserBar } from './UserBar';
import { ActiveCallBar } from './ActiveCallBar';
import { ChannelContextMenu } from '../navigation/ChannelContextMenu';
import { Tooltip } from '../ui/Tooltip';

interface ChannelSidebarProps {
  onOpenCreateChannel: (categoryId?: string) => void;
  onOpenSettings: () => void;
  onOpenInvite: () => void;
  onOpenChannelBrowser?: () => void;
  onReturnToCall?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  onOpenCreateChannel,
  onOpenSettings,
  onOpenInvite,
  onOpenChannelBrowser = () => {},
  onReturnToCall,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { activeServer, channels, activeChannel, selectChannel, categories } = useServer();
  const { activeRoomId, participants, leaveVoiceRoom, openPreJoin } = useMedia();
  const { unreadByChannel, markChannelRead, markAllRead } = useInbox();

  // Collapsed categories state backed by localStorage
  const storageKey = activeServer ? `mw:ui:collapsed:${activeServer.id}` : null;
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    if (!storageKey) return {};
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Re-sync when server changes
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      setCollapsedCategories(saved ? JSON.parse(saved) : {});
    } catch {
      setCollapsedCategories({});
    }
  }, [storageKey]);

  // Server Header Dropdown State
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  // Channel Context Menu State
  const [channelContextMenu, setChannelContextMenu] = useState<{
    channel: Channel;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCategory = (catId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedCategories((prev) => {
      const next = { ...prev, [catId]: !prev[catId] };
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  };

  const handleChannelClick = (channel: Channel) => {
    selectChannel(channel.id);
    markChannelRead(channel.id);
    if (channel.type === 'voice' && activeRoomId !== channel.id) {
      openPreJoin(channel.id);
    }
  };

  const handleChannelContextMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    setChannelContextMenu({
      channel,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Get categories for current server from ServerContext
  const serverCategories = categories
    ? [...categories].sort((a, b) => a.position - b.position)
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
      {/* Workspace Header with Dropdown Menu */}
      <header className="server-header" ref={headerMenuRef}>
        <div
          className="server-header-clickable"
          onClick={() => setShowHeaderMenu(!showHeaderMenu)}
          role="button"
          aria-expanded={showHeaderMenu}
          title={`${activeServer?.name || 'meetwo'} Menu`}
        >
          <h2 className="truncate">{activeServer?.name || 'meetwo'}</h2>
          <ChevronDown
            size={14}
            className={`server-header-chevron ${showHeaderMenu ? 'open' : ''}`}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip content="Browse Channels">
            <button
              className="icon-btn"
              style={{ width: 28, height: 28 }}
              onClick={onOpenChannelBrowser}
              aria-label="Browse Channels"
            >
              <Compass size={14} />
            </button>
          </Tooltip>
          {onToggleCollapse && (
            <Tooltip content="Collapse Sidebar">
              <button
                className="icon-btn"
                style={{ width: 28, height: 28 }}
                onClick={onToggleCollapse}
                aria-label="Collapse Sidebar"
              >
                <PanelLeftClose size={14} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Server Header Dropdown Menu */}
        {showHeaderMenu && (
          <div className="server-dropdown-menu" role="menu">
            <button
              className="dropdown-item"
              onClick={() => {
                setShowHeaderMenu(false);
                onOpenChannelBrowser();
              }}
            >
              <Compass size={14} />
              <span>Browse Channels</span>
            </button>

            <button
              className="dropdown-item"
              onClick={() => {
                setShowHeaderMenu(false);
                onOpenInvite();
              }}
            >
              <UserPlus size={14} />
              <span>Invite People</span>
            </button>

            <button
              className="dropdown-item"
              onClick={() => {
                setShowHeaderMenu(false);
                onOpenCreateChannel();
              }}
            >
              <Plus size={14} />
              <span>Create Channel</span>
            </button>

            <button
              className="dropdown-item"
              onClick={() => {
                setShowHeaderMenu(false);
                markAllRead();
              }}
            >
              <CheckCheck size={14} />
              <span>Mark Workspace Read</span>
            </button>

            <div className="menu-divider" />

            <button
              className="dropdown-item"
              onClick={() => {
                setShowHeaderMenu(false);
                onOpenSettings();
              }}
            >
              <Settings size={14} />
              <span>Server Settings</span>
            </button>
          </div>
        )}
      </header>

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
                      const unreadState = unreadByChannel[chan.id];
                      const hasUnread = Boolean(unreadState && unreadState.count > 0 && !isActive);
                      const hasMention = Boolean(unreadState && unreadState.hasMention && !isActive);

                      return (
                        <div key={chan.id}>
                          <div
                            className={`channel-item ${isActive || isCurrentVoice ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                            onClick={() => handleChannelClick(chan)}
                            onContextMenu={(e) => handleChannelContextMenu(e, chan)}
                          >
                            {/* Unread dot indicator on left */}
                            {hasUnread && <span className="channel-unread-dot" />}

                            {getChannelIcon(chan.type, chan.name)}
                            <span className={`truncate ${hasUnread ? 'channel-name-unread' : ''}`}>
                              {chan.name}
                            </span>

                            {hasMention && (
                              <span className="channel-mention-badge">
                                @
                              </span>
                            )}

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
              const unreadState = unreadByChannel[chan.id];
              const hasUnread = Boolean(unreadState && unreadState.count > 0 && !isActive);

              return (
                <div
                  key={chan.id}
                  className={`channel-item ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                  onClick={() => handleChannelClick(chan)}
                  onContextMenu={(e) => handleChannelContextMenu(e, chan)}
                >
                  {hasUnread && <span className="channel-unread-dot" />}
                  {getChannelIcon(chan.type, chan.name)}
                  <span className="truncate">{chan.name}</span>
                </div>
              );
            })}
          </>
        )}

        {/* Uncategorized channels */}
        {uncategorizedChannels.length > 0 && serverCategories.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="channel-category">
              <span>General</span>
            </div>
            {uncategorizedChannels.map((chan) => {
              const isActive = activeChannel?.id === chan.id;
              const unreadState = unreadByChannel[chan.id];
              const hasUnread = Boolean(unreadState && unreadState.count > 0 && !isActive);

              return (
                <div
                  key={chan.id}
                  className={`channel-item ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                  onClick={() => handleChannelClick(chan)}
                  onContextMenu={(e) => handleChannelContextMenu(e, chan)}
                >
                  {hasUnread && <span className="channel-unread-dot" />}
                  {getChannelIcon(chan.type, chan.name)}
                  <span className="truncate">{chan.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Call Bar (sticky above user bar) */}
      <ActiveCallBar onReturnToCall={onReturnToCall} />

      {/* Bottom User Bar */}
      <UserBar onOpenSettings={onOpenSettings} />

      {/* Channel Right-Click Context Menu */}
      {channelContextMenu && (
        <ChannelContextMenu
          channel={channelContextMenu.channel}
          x={channelContextMenu.x}
          y={channelContextMenu.y}
          onClose={() => setChannelContextMenu(null)}
          onMarkRead={markChannelRead}
          onOpenSettings={onOpenSettings}
        />
      )}
    </aside>
  );
};
