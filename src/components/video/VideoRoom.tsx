import React from 'react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { VideoGrid } from './VideoGrid';
import { VideoControls } from './VideoControls';
import { PreJoinModal } from './PreJoinModal';
import { Users, Sparkles, ShieldCheck, AlertTriangle, RefreshCw, X, Volume2, Info } from 'lucide-react';

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
  const [isNoticeDismissed, setIsNoticeDismissed] = React.useState(() => {
    try {
      return Boolean(sessionStorage.getItem('meetwo_media_notice_dismissed'));
    } catch {
      return false;
    }
  });

  const handleDismissNotice = () => {
    setIsNoticeDismissed(true);
    try {
      sessionStorage.setItem('meetwo_media_notice_dismissed', '1');
    } catch {
      // Ignore in private browsing mode
    }
  };

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
            maxWidth: 440,
            textAlign: 'center',
            padding: 32,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-light)',
            }}
          >
            <Users size={36} />
          </div>

          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px 0' }}>
              {activeChannel.name}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
              Private small-group room optimized for 2–6 friends. Natural voice priority and resilient adaptive media.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--status-online)',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={16} />
            <span>Low-latency peer media ready</span>
          </div>

          <button
            className="btn btn-primary"
            style={{
              padding: '12px 32px',
              fontSize: 15,
              borderRadius: 'var(--radius-pill)',
              marginTop: 6,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
            onClick={() => openPreJoin(activeChannel.id)}
          >
            Connect to Voice & Video
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
    <div className="video-room-container">
      {/* Device State Change Toast Notification */}
      {deviceNotification && (
        <div
          className="device-notification-toast"
          style={{
            position: 'absolute',
            top: 54,
            right: 20,
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontSize: 13,
          }}
        >
          <Volume2 size={16} style={{ color: 'var(--accent-light)' }} />
          <span>
            {deviceNotification.kind === 'audio' ? 'Microphone' : 'Camera'}{' '}
            {deviceNotification.action === 'disconnected'
              ? 'unplugged. Switched to fallback device.'
              : 'reconnected and active.'}
          </span>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 22, height: 22, padding: 0 }}
            onClick={dismissDeviceNotification}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Network Reconnection / Recovery Banner */}
      {reconnectMessage && (
        <div
          className="reconnection-banner"
          style={{
            background: connectionState === 'failed' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(234, 179, 8, 0.9)',
            color: '#fff',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <RefreshCw size={14} className={connectionState !== 'failed' ? 'spinning' : ''} />
          <span>{reconnectMessage}</span>
        </div>
      )}

      {/* Production Configuration / Media Mode Banner */}
      {productionConfigError && !isNoticeDismissed && (
        <div
          className={`production-config-error-banner ${
            productionConfigError.startsWith('Notice:') ? 'banner-notice' : 'banner-error'
          }`}
        >
          {productionConfigError.startsWith('Notice:') ? (
            <Info size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', color: '#fff' }}>
              {productionConfigError.startsWith('Notice:')
                ? 'Media Mode: Direct WebRTC Engine'
                : 'Production SFU Configuration Required'}
            </strong>
            <span>{productionConfigError}</span>
          </div>
          {productionConfigError.startsWith('Notice:') && (
            <button
              onClick={handleDismissNotice}
              className="production-config-dismiss-btn"
              title="Dismiss notice"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Top Unobtrusive Status Bar */}
      <div className="video-top-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{activeChannel?.name || 'Voice Room'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            • {participants.length} {participants.length === 1 ? 'participant' : 'friends in call'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className={`connection-health-badge ${connectionState}`}
            title={`Status: ${connectionState.toUpperCase()}${connectionStats.rtt !== undefined ? ` | RTT: ${connectionStats.rtt}ms` : ''}`}
          >
            <span className="dot" />
            <span>
              {connectionState === 'connected'
                ? connectionStats.quality === 'unknown'
                  ? 'Measuring connection…'
                  : connectionStats.rtt !== undefined
                  ? `${connectionStats.quality.charAt(0).toUpperCase() + connectionStats.quality.slice(1)} (${connectionStats.rtt}ms)`
                  : `${connectionStats.quality.charAt(0).toUpperCase() + connectionStats.quality.slice(1)} connection`
                : connectionState === 'reconnecting'
                ? 'Reconnecting...'
                : connectionState === 'degraded'
                ? 'Degraded (Audio prioritized)'
                : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      <VideoGrid participants={participants} />
      <VideoControls onOpenSettings={onOpenSettings} />
    </div>
  );
};
