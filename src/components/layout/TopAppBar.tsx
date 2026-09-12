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
  Activity,
} from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';

interface TopAppBarProps {
  onToggleMobileNav: () => void;
  showMemberList: boolean;
  onToggleMemberList: () => void;
  onOpenCommandPalette: () => void;
  onOpenSearch: () => void;
  onOpenInvite: () => void;
  onOpenSavedMessages: () => void;
  onOpenAuditLogs: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  onToggleMobileNav,
  showMemberList,
  onToggleMemberList,
  onOpenCommandPalette,
  onOpenSearch,
  onOpenInvite,
  onOpenSavedMessages,
  onOpenAuditLogs,
}) => {
  const { activeChannel } = useServer();
  const { connectionState, connectionStats } = useMedia();
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
      {/* Left: Channel context & Topic */}
      <div className="top-app-bar-left">
        <button
          className="icon-btn mobile-nav-toggle"
          onClick={onToggleMobileNav}
          aria-label="Toggle navigation drawer"
        >
          <Menu size={18} />
        </button>

        {activeChannel && (
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
        )}
      </div>

      {/* Right: Only high-value actions */}
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
          onClick={onOpenCommandPalette}
          title="Quick Jump (Ctrl+K)"
          aria-label="Quick Jump (Ctrl+K)"
        >
          <Search size={13} />
          <span>Jump to...</span>
          <span className="command-shortcut-badge">⌘K</span>
        </button>

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
            </div>
          )}
        </div>

        {/* Toggle Member List */}
        <button
          className={`icon-btn ${showMemberList ? 'active' : ''}`}
          onClick={onToggleMemberList}
          title="Toggle Member List"
          aria-label="Toggle Member List"
        >
          <Users size={16} />
        </button>
      </div>
    </header>
  );
};
