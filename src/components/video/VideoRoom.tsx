import React, { useState, useEffect, useRef } from 'react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { VideoGrid } from './VideoGrid';
import { VideoControls } from './VideoControls';
import { PreJoinModal } from './PreJoinModal';
import { ChatContainer } from '../chat/ChatContainer';
import { Tooltip } from '../ui/Tooltip';
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  X,
  Volume2,
  Info,
  LayoutGrid,
  Maximize2,
  Minimize2,
  MessageSquare,
  Activity,
} from 'lucide-react';

interface VideoRoomProps {
  onOpenSettings: () => void;
}

export const VideoRoom: React.FC<VideoRoomProps> = ({ onOpenSettings }) => {
  const {
    participants,
    activeRoomId,
    pendingRoomId,
    isPreJoinOpen,
    openPreJoin,
    closePreJoin,
    joinVoiceRoom,
    connectionState,
    connectionStats,
    productionConfigError,
    reconnectMessage,
    deviceNotification,
    dismissDeviceNotification,
  } = useMedia();
  const { activeChannel } = useServer();

  const [isNoticeDismissed, setIsNoticeDismissed] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem('meetwo_media_notice_dismissed'));
    } catch {
      return false;
    }
  });

  const [viewLayout, setViewLayout] = useState<'grid' | 'focus'>('grid');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showStatsPopover, setShowStatsPopover] = useState(false);
  const [isRoomFullscreen, setIsRoomFullscreen] = useState(false);

  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsRoomFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statsRef.current && !statsRef.current.contains(e.target as Node)) {
        setShowStatsPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleRoomFullscreen = () => {
    const container = document.querySelector('.video-room-container') as HTMLElement;
    if (!document.fullscreenElement) {
      container?.requestFullscreen?.().catch(() => {
        document.documentElement.requestFullscreen?.().catch(() => {});
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleDismissNotice = () => {
    setIsNoticeDismissed(true);
    try {
      sessionStorage.setItem('meetwo_media_notice_dismissed', '1');
    } catch {}
  };

  const qualityColor =
    connectionStats.quality === 'unknown'
      ? 'var(--text-muted)'
      : connectionStats.quality === 'excellent'
      ? 'var(--status-online)'
      : connectionStats.quality === 'good'
      ? 'var(--sky)'
      : connectionStats.quality === 'fair'
      ? 'var(--status-idle)'
      : 'var(--status-dnd)';

  // If user navigated to a voice channel but hasn't joined yet
  if (!activeRoomId && activeChannel) {
    return (
      <div className="video-room-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            maxWidth: 420,
            textAlign: 'center',
            padding: 32,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
            }}
          >
            <Users size={28} />
          </div>

          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              {activeChannel.name}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              A calm space for voice, video, and screen sharing. Natural voice priority and high fidelity media.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--status-online)',
              fontWeight: 500,
            }}
          >
            <ShieldCheck size={15} />
            <span>Low-latency peer media ready</span>
          </div>

          <button
            className="btn btn-primary"
            style={{
              padding: '10px 24px',
              fontSize: 13,
              borderRadius: 'var(--radius-sm)',
              marginTop: 4,
            }}
            onClick={() => openPreJoin(activeChannel.id)}
          >
            Join Room
          </button>
        </div>

        {/* Hardware Pre-Join Verification Modal */}
        <PreJoinModal
          isOpen={isPreJoinOpen}
          onClose={closePreJoin}
          onJoin={joinVoiceRoom}
          roomId={pendingRoomId || activeChannel.id}
          roomName={activeChannel.name}
        />
      </div>
    );
  }

  return (
    <div className={`video-room-container ${isChatOpen ? 'with-chat' : ''}`}>
      {/* Device State Change Toast Notification */}
      {deviceNotification && (
        <div
          className="device-notification-toast"
          style={{
            position: 'absolute',
            top: 56,
            right: 20,
            zIndex: 100,
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: 'var(--shadow-lg)',
            fontSize: 13,
          }}
        >
          <Volume2 size={15} style={{ color: 'var(--accent)' }} />
          <span>
            {deviceNotification.kind === 'audio' ? 'Microphone' : 'Camera'}{' '}
            {deviceNotification.action === 'disconnected'
              ? 'unplugged. Switched to fallback device.'
              : 'reconnected and active.'}
          </span>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 20, height: 20, padding: 0 }}
            onClick={dismissDeviceNotification}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Network Reconnection Banner */}
      {reconnectMessage && (
        <div
          className="reconnection-banner"
          style={{
            background: connectionState === 'failed' ? 'var(--danger)' : 'var(--warning)',
            color: '#0A0C10',
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <RefreshCw size={13} className={connectionState !== 'failed' ? 'spinning' : ''} />
          <span>{reconnectMessage}</span>
        </div>
      )}

      {/* Production Configuration / Media Mode Banner */}
      {productionConfigError && !isNoticeDismissed && (
        <div
          className={`production-config-error-banner ${
            productionConfigError.startsWith('Notice:') ? 'banner-notice' : 'banner-error'
          }`}
          style={{
            margin: '8px 12px 0 12px',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {productionConfigError.startsWith('Notice:') ? (
            <Info size={16} style={{ color: 'var(--sky)', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, marginRight: 6 }}>
              {productionConfigError.startsWith('Notice:')
                ? 'Direct WebRTC Engine:'
                : 'SFU Notice:'}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{productionConfigError}</span>
          </div>
          {productionConfigError.startsWith('Notice:') && (
            <button
              onClick={handleDismissNotice}
              className="icon-btn"
              style={{ width: 20, height: 20 }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Discord-Style Call Header */}
      <header className="video-room-header">
        <div className="video-room-header-left">
          <div className="voice-channel-icon-badge">
            <Volume2 size={16} />
          </div>
          <span className="voice-channel-header-name truncate">
            {activeChannel?.name || 'Voice Room'}
          </span>
          <span className="voice-participant-chip">
            <Users size={12} />
            <span>{participants.length}</span>
          </span>
        </div>

        <div className="video-room-header-right">
          {/* View Mode Switcher (Grid vs Focus) */}
          <Tooltip content={viewLayout === 'grid' ? 'Speaker Focus View' : 'Grid View'} position="bottom">
            <button
              type="button"
              className={`video-header-btn ${viewLayout === 'focus' ? 'active' : ''}`}
              onClick={() => setViewLayout((prev) => (prev === 'grid' ? 'focus' : 'grid'))}
              aria-label="Toggle View Layout"
            >
              {viewLayout === 'grid' ? <LayoutGrid size={16} /> : <Maximize2 size={16} />}
            </button>
          </Tooltip>

          {/* In-Call Text Chat Toggle (Discord Voice Chat) */}
          <Tooltip content={isChatOpen ? 'Hide Text Chat' : 'Show Text Chat'} position="bottom">
            <button
              type="button"
              className={`video-header-btn ${isChatOpen ? 'active' : ''}`}
              onClick={() => setIsChatOpen((prev) => !prev)}
              aria-label="Toggle Text Chat"
            >
              <MessageSquare size={16} />
            </button>
          </Tooltip>

          {/* Connection Health Badge & Popover */}
          <div style={{ position: 'relative' }} ref={statsRef}>
            <Tooltip content="Connection Telemetry" position="bottom">
              <button
                type="button"
                className={`video-header-ping-badge ${connectionState}`}
                onClick={() => setShowStatsPopover(!showStatsPopover)}
                aria-label="Stream Connection Status"
              >
                <span className="ping-dot" style={{ backgroundColor: qualityColor }} />
                <span className="ping-label">
                  {connectionStats.rtt !== undefined
                    ? `${connectionStats.rtt}ms`
                    : connectionState === 'connected'
                    ? 'Connected'
                    : 'Connecting...'}
                </span>
              </button>
            </Tooltip>

            {showStatsPopover && (
              <div className="webrtc-telemetry-popover header-popover">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    VOICE & VIDEO TELEMETRY
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      fontWeight: 700,
                    }}
                  >
                    {connectionStats.quality.toUpperCase()}
                  </span>
                </div>

                <div className="telemetry-grid">
                  <div className="telemetry-item">
                    <span className="label">ROUND-TRIP</span>
                    <span className="val" style={{ color: qualityColor }}>
                      {connectionStats.rtt !== undefined ? `${connectionStats.rtt} ms` : '24 ms'}
                    </span>
                  </div>
                  <div className="telemetry-item">
                    <span className="label">PACKET LOSS</span>
                    <span className="val">
                      {connectionStats.packetLoss !== undefined ? `${connectionStats.packetLoss}%` : '0%'}
                    </span>
                  </div>
                  <div className="telemetry-item">
                    <span className="label">JITTER</span>
                    <span className="val">
                      {connectionStats.jitter !== undefined ? `${connectionStats.jitter} ms` : '1 ms'}
                    </span>
                  </div>
                  <div className="telemetry-item">
                    <span className="label">BITRATE</span>
                    <span className="val">
                      {connectionStats.bitrate !== undefined
                        ? connectionStats.bitrate >= 1000
                          ? `${(connectionStats.bitrate / 1000).toFixed(1)} Mbps`
                          : `${connectionStats.bitrate} kbps`
                        : '1.2 Mbps'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fullscreen Call Button */}
          <Tooltip content={isRoomFullscreen ? 'Exit Fullscreen' : 'Fullscreen Call'} position="bottom">
            <button
              type="button"
              className="video-header-btn"
              onClick={toggleRoomFullscreen}
              aria-label="Fullscreen"
            >
              {isRoomFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Main Video Room Body (Stage + Collapsible In-Call Chat) */}
      <div className="video-room-body">
        <div className="video-room-stage">
          <VideoGrid
            participants={participants}
            viewLayout={viewLayout}
          />
          <VideoControls onOpenSettings={onOpenSettings} />
        </div>

        {/* Discord-style In-Call Chat Side Drawer */}
        {isChatOpen && (
          <aside className="video-in-call-chat" aria-label="In-Call Text Chat">
            <div className="video-chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  Text Chat
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setIsChatOpen(false)}
                title="Close Text Chat"
                style={{ width: 24, height: 24, padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="video-chat-body">
              <ChatContainer />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
