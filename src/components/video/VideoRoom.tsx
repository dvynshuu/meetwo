import React from 'react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { VideoGrid } from './VideoGrid';
import { VideoControls } from './VideoControls';
import { PreJoinModal } from './PreJoinModal';
import { Users, Sparkles, ShieldCheck, AlertTriangle } from 'lucide-react';

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
  } = useMedia();
  const { activeChannel } = useServer();

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
              Private room optimized for 2–6 friends. Crystal-clear Opus 48kHz audio and adaptive 1080p video.
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
      {/* Production Configuration Error Banner */}
      {productionConfigError && (
        <div
          className="production-config-error-banner"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            margin: '12px 12px 0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#fca5a5',
            fontSize: 13,
          }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', color: '#fff' }}>Production SFU Configuration Required</strong>
            <span>{productionConfigError}</span>
          </div>
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
                ? connectionStats.rtt !== undefined
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
