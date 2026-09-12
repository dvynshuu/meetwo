import React from 'react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { VideoGrid } from './VideoGrid';
import { VideoControls } from './VideoControls';
import { PreJoinModal } from './PreJoinModal';
import { Users, ShieldCheck, AlertTriangle, RefreshCw, X, Volume2, Info } from 'lucide-react';

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
    <div className="video-room-container">
      {/* Device State Change Toast Notification */}
      {deviceNotification && (
        <div
          className="device-notification-toast"
          style={{
            position: 'absolute',
            top: 50,
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

      {/* Network Reconnection / Recovery Banner */}
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

      {/* Top Unobtrusive Status Bar */}
      <div className="video-top-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
            {activeChannel?.name || 'Voice Room'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            • {participants.length} {participants.length === 1 ? 'person' : 'people'} in call
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            className={`connection-health-badge ${connectionState}`}
            title={`Status: ${connectionState.toUpperCase()}${connectionStats.rtt !== undefined ? ` | RTT: ${connectionStats.rtt}ms` : ''}`}
          >
            <span className="dot" />
            <span>
              {connectionState === 'connected'
                ? connectionStats.quality === 'unknown'
                  ? 'Connected'
                  : `${connectionStats.quality.charAt(0).toUpperCase() + connectionStats.quality.slice(1)} connection`
                : connectionState === 'reconnecting'
                ? 'Reconnecting...'
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
