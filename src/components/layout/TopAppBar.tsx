import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Hash,
  Volume2,
  Video,
  Radio,
  MessagesSquare,
  Megaphone,
  Users,
  Search,
  Bookmark,
  Shield,
  UserPlus,
  MoreHorizontal,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Bell,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import { useNavigation } from '../../app/providers/NavigationContext';
import { useInbox } from '../../app/providers/InboxContext';
import { useDM } from '../../app/providers/DMContext';
import { Tooltip } from '../ui/Tooltip';
import { HomeTab } from './HomeSidebar';

interface TopAppBarProps {
  viewMode: 'home' | 'server';
  homeTab?: HomeTab;
  onToggleMobileNav: () => void;
  showMemberList: boolean;
  onToggleMemberList: () => void;
  onOpenQuickSwitcher: () => void;
  onOpenCommandPalette: () => void;
  onOpenSearch: () => void;
  onOpenInvite: () => void;
  onOpenSavedMessages: () => void;
  onOpenAuditLogs: () => void;
  onSelectHomeTab?: (tab: HomeTab) => void;
  onNavigateHistory?: (entry: any) => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  viewMode,
  homeTab = 'dms',
  onToggleMobileNav,
  showMemberList,
  onToggleMemberList,
  onOpenQuickSwitcher,
  onOpenCommandPalette,
  onOpenSearch,
  onOpenInvite,
  onOpenSavedMessages,
  onOpenAuditLogs,
  onSelectHomeTab,
  onNavigateHistory,
}) => {
  const { activeChannel } = useServer();
  const { connectionState, connectionStats } = useMedia();
  const { canGoBack, canGoForward, goBack, goForward } = useNavigation();
  const { unreadMentionCount } = useInbox();
  const { activeConversation, conversations } = useDM();

  const [showStatusPopover, setShowStatusPopover] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setShowStatusPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBack = () => {
    const dest = goBack();
    if (dest && onNavigateHistory) {
      onNavigateHistory(dest);
    }
  };

  const handleForward = () => {
    const dest = goForward();
    if (dest && onNavigateHistory) {
      onNavigateHistory(dest);
    }
  };

  const renderChannelIcon = () => {
    if (!activeChannel) return null;
    switch (activeChannel.type) {
      case 'stage':
        return <Radio size={16} className="channel-icon" />;
      case 'forum':
        return <MessagesSquare size={16} className="channel-icon" />;
      case 'announcement':
        return <Megaphone size={16} className="channel-icon" />;
      case 'voice':
        return activeChannel.name.toLowerCase().includes('video') ? (
          <Video size={16} className="channel-icon" />
        ) : (
          <Volume2 size={16} className="channel-icon" />
        );
      case 'text':
      default:
        return <Hash size={16} className="channel-icon" />;
    }
  };

  const isConnected = connectionState === 'connected';
  const isReconnecting = connectionState === 'reconnecting';
  const connectionLabel = isReconnecting
    ? 'Reconnecting'
    : isConnected
    ? 'Good connection'
    : 'Online';

  return (
    <header className="top-app-bar">
      {/* Left: Navigation history + Channel/Home title */}
      <div className="top-app-bar-left">
        <button
          className="icon-btn mobile-nav-toggle"
          onClick={onToggleMobileNav}
          aria-label="Toggle navigation drawer"
        >
          <Menu size={18} />
        </button>

        {/* Browser-style Back / Forward Buttons */}
        <div className="history-nav-controls">
          <Tooltip content="Go Back (Alt+Left)">
            <button
              className="icon-btn history-btn"
              onClick={handleBack}
              disabled={!canGoBack}
              aria-label="Go Back"
            >
              <ChevronLeft size={16} />
            </button>
          </Tooltip>

          <Tooltip content="Go Forward (Alt+Right)">
            <button
              className="icon-btn history-btn"
              onClick={handleForward}
              disabled={!canGoForward}
              aria-label="Go Forward"
            >
              <ChevronRight size={16} />
            </button>
          </Tooltip>
        </div>

        <div className="top-bar-divider" />

        {/* Title Content: Dynamic between Home mode and Server mode */}
        {viewMode === 'home' ? (
          <div className="top-app-bar-home-title">
            {homeTab === 'friends' ? (
              <>
                <Users size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="top-app-bar-channel-name">Friends</span>
              </>
            ) : homeTab === 'inbox' ? (
              <>
                <Bell size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="top-app-bar-channel-name">Inbox & Mentions</span>
              </>
            ) : homeTab === 'saved' ? (
              <>
                <Bookmark size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="top-app-bar-channel-name">Saved Messages</span>
              </>
            ) : activeConversation ? (
              <>
                <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
                <span className="top-app-bar-channel-name">
                  {activeConversation.participants[0]?.displayName || 'Direct Message'}
                </span>
              </>
            ) : (
              <>
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <span className="top-app-bar-channel-name">Home</span>
              </>
            )}
          </div>
        ) : (
          activeChannel && (
            <>
              {renderChannelIcon()}
              <h1 className="top-app-bar-channel-name truncate">
                {activeChannel.name}
              </h1>
              {activeChannel.topic && (
                <span className="top-app-bar-topic truncate" title={activeChannel.topic}>
                  {activeChannel.topic}
                </span>
              )}
            </>
          )
        )}
      </div>

      {/* Right: Actions, Quick Switcher, Connection indicator */}
      <div className="top-app-bar-actions">
        {/* Discreet Connection Status Indicator */}
        <div style={{ position: 'relative' }} ref={statusRef}>
          <button
            className="connection-status-indicator"
            onClick={() => setShowStatusPopover(!showStatusPopover)}
            title={`Connection Status: ${connectionLabel}`}
            aria-expanded={showStatusPopover}
            aria-haspopup="dialog"
          >
            <span
              className={`status-indicator-dot ${isReconnecting ? 'reconnecting' : ''}`}
            />
            <span className="truncate">{connectionLabel}</span>
          </button>

          {showStatusPopover && (
            <div className="connection-popover" role="dialog" aria-label="System Health">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} style={{ color: 'var(--status-online)' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>System Health</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span style={{ color: 'var(--status-online)', fontWeight: 500 }}>Operational</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Signaling:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Mesh & SFU Ready</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Round Trip:</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {connectionStats.rtt !== undefined ? `${connectionStats.rtt}ms` : '24ms'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Jump / Search Trigger (Ctrl+K) */}
        <button
          className="command-trigger-bar"
          onClick={onOpenQuickSwitcher}
          title="Quick Switcher (Ctrl+K)"
          aria-label="Quick Switcher (Ctrl+K)"
        >
          <Search size={13} />
          <span>Quick Switcher</span>
          <span className="command-shortcut-badge">⌘K</span>
        </button>

        {/* Inbox Quick Trigger */}
        <Tooltip content="Inbox & Mentions">
          <button
            className="icon-btn"
            onClick={() => {
              if (onSelectHomeTab) onSelectHomeTab('inbox');
            }}
            aria-label="Inbox"
            style={{ position: 'relative' }}
          >
            <Bell size={16} />
            {unreadMentionCount > 0 && (
              <span className="topbar-badge-dot" />
            )}
          </button>
        </Tooltip>

        {/* Secondary Context Menu */}
        <div style={{ position: 'relative' }} ref={moreMenuRef}>
          <button
            className="icon-btn"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            title="More Options"
            aria-label="More options"
            aria-expanded={showMoreMenu}
            aria-haspopup="true"
          >
            <MoreHorizontal size={16} />
          </button>

          {showMoreMenu && (
            <div className="top-app-bar-menu" role="menu">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenSearch();
                }}
                className="dropdown-item"
                role="menuitem"
              >
                <Search size={14} />
                <span>Search Messages</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenSavedMessages();
                }}
                className="dropdown-item"
                role="menuitem"
              >
                <Bookmark size={14} />
                <span>Saved Messages</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenInvite();
                }}
                className="dropdown-item"
                role="menuitem"
              >
                <UserPlus size={14} />
                <span>Invite Members</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenAuditLogs();
                }}
                className="dropdown-item"
                role="menuitem"
              >
                <Shield size={14} />
                <span>Audit Logs</span>
              </button>

              <div className="menu-divider" />

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onOpenCommandPalette();
                }}
                className="dropdown-item"
                role="menuitem"
              >
                <Sparkles size={14} />
                <span>Action Palette (Ctrl+Shift+K)</span>
              </button>
            </div>
          )}
        </div>

        {/* Toggle Member List (shown only in server view mode) */}
        {viewMode === 'server' && (
          <Tooltip content="Toggle Member List">
            <button
              className={`icon-btn ${showMemberList ? 'active' : ''}`}
              onClick={onToggleMemberList}
              aria-label="Toggle Member List"
            >
              <Users size={16} />
            </button>
          </Tooltip>
        )}
      </div>
    </header>
  );
};
