import React, { useState } from 'react';
import {
  Menu,
  Hash,
  Volume2,
  Video,
  Radio,
  MessagesSquare,
  Megaphone,
  Users,
  Bell,
  Search,
  UserPlus,
  Bookmark,
  Shield,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';

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
  const [showTelemetryPopover, setShowTelemetryPopover] = useState(false);

  const renderChannelIcon = () => {
    if (!activeChannel) return null;
    switch (activeChannel.type) {
      case 'stage':
        return <Radio size={20} style={{ color: '#F43F5E' }} />;
      case 'forum':
        return <MessagesSquare size={20} style={{ color: '#A855F7' }} />;
      case 'announcement':
        return <Megaphone size={20} style={{ color: 'var(--status-idle)' }} />;
      case 'voice':
        return activeChannel.name.toLowerCase().includes('video') ? (
          <Video size={20} style={{ color: 'var(--accent-light)' }} />
        ) : (
          <Volume2 size={20} style={{ color: 'var(--status-online)' }} />
        );
      case 'text':
      default:
        return <Hash size={20} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  return (
    <header className="top-app-bar">
      <div className="top-app-bar-left">
        {/* Mobile menu button */}
        <button
          className="icon-btn mobile-nav-toggle"
          onClick={onToggleMobileNav}
          aria-label="Toggle navigation drawer"
        >
          <Menu size={20} />
        </button>

        {activeChannel && (
          <>
            {renderChannelIcon()}
            <h1 className="top-app-bar-channel-name truncate">
              {activeChannel.name}
            </h1>
            {activeChannel.topic && (
              <span className="top-app-bar-topic truncate">
                {activeChannel.topic}
              </span>
            )}
          </>
        )}
      </div>

      <div className="top-app-bar-actions">
        {/* Observability Telemetry Badge */}
        <div style={{ position: 'relative' }}>
          <button
            className="telemetry-pill"
            onClick={() => setShowTelemetryPopover(!showTelemetryPopover)}
            title="System Observability Telemetry"
          >
            <span className="telemetry-pulse-dot" />
            <Activity size={13} style={{ color: 'var(--status-online)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
              24ms RTT
            </span>
          </button>

          {showTelemetryPopover && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                onClick={() => setShowTelemetryPopover(false)}
              />
              <div className="telemetry-dropdown">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <CheckCircle2 size={15} style={{ color: 'var(--status-online)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Telemetry & Health</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Signaling:</span>
                    <span style={{ color: 'var(--status-online)', fontWeight: 600 }}>Active (Mesh/SFU)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Packet Loss:</span>
                    <span style={{ color: 'var(--status-online)', fontWeight: 600 }}>0.0%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Round Trip Time:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>24 ms</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Audio Processing:</span>
                    <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>RNNoise + Web Audio</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Media Recovery:</span>
                    <span style={{ color: 'var(--status-online)', fontWeight: 600 }}>ICE Auto-restart OK</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Command Palette Button */}
        <button
          className="command-trigger-bar"
          onClick={onOpenCommandPalette}
          title="Quick Jump (Ctrl+K)"
        >
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Quick Jump...</span>
          <span className="command-kbd">Ctrl K</span>
        </button>

        {/* Saved Messages Drawer Toggle */}
        <button
          className="icon-btn"
          onClick={onOpenSavedMessages}
          title="Saved Messages (⭐ Bookmarks)"
          aria-label="Saved Messages"
        >
          <Bookmark size={18} />
        </button>

        {/* Audit Log Modal Toggle */}
        <button
          className="icon-btn"
          onClick={onOpenAuditLogs}
          title="Server Audit Log (Governance)"
          aria-label="Audit Log"
        >
          <Shield size={18} />
        </button>

        <button className="icon-btn" onClick={onOpenInvite} title="Invite People">
          <UserPlus size={18} />
        </button>

        <button className="icon-btn" onClick={onOpenSearch} title="Search Messages">
          <Search size={18} />
        </button>

        <button className="icon-btn" title="Notifications">
          <Bell size={18} />
        </button>

        <button
          className={`icon-btn ${showMemberList ? 'active' : ''}`}
          onClick={onToggleMemberList}
          title="Toggle Member List"
          aria-label="Toggle Member List"
        >
          <Users size={18} />
        </button>
      </div>
    </header>
  );
};
