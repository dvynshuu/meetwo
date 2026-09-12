import React, { useState } from 'react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Avatar } from '../ui/Avatar';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Hand,
  PhoneOff,
  Settings,
  Users,
  Radio,
  Share2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface StageRoomProps {
  onOpenSettings: () => void;
}

export const StageRoom: React.FC<StageRoomProps> = ({ onOpenSettings }) => {
  const { activeChannel } = useServer();
  const { currentUser } = useAuth();
  const {
    participants,
    activeRoomId,
    joinVoiceRoom,
    leaveVoiceRoom,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    audioLevel,
    localStream,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    raiseHand,
    lowerHand,
    setStageRole,
  } = useMedia();

  const [showHandQueue, setShowHandQueue] = useState(false);

  // If not joined to this stage channel yet
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
            <Radio size={36} />
          </div>

          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px 0' }}>
              {activeChannel.name}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
              Live audio-first Stage. Speakers broadcast crystal-clear Opus voice while listeners consume minimal bandwidth.
            </p>
          </div>

          <button
            className="btn btn-primary"
            style={{
              padding: '12px 32px',
              fontSize: 15,
              borderRadius: 'var(--radius-pill)',
              marginTop: 6,
            }}
            onClick={() => joinVoiceRoom(activeChannel.id)}
          >
            Join Live Stage
          </button>
        </div>
      </div>
    );
  }

  // Real participant partitioning
  const localParticipant = participants.find((p) => p.userId === currentUser?.id);
  const isSpeaker = localParticipant?.isStageSpeaker ?? true;
  const isHandRaised = localParticipant?.isHandRaised ?? false;

  const speakers = participants.filter((p) => p.isStageSpeaker);
  const listeners = participants.filter((p) => !p.isStageSpeaker);
  const handRequests = listeners.filter((p) => p.isHandRaised);

  return (
    <div className="stage-room-container">
      {/* Top Broadcast Bar */}
      <header className="stage-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="stage-live-badge">
            <span className="live-dot" />
            <span>LIVE STAGE</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              {activeChannel?.name || 'Community Stage'}
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {activeChannel?.topic || 'Live Interactive Voice & Discussion'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="stage-listener-counter">
            <Users size={14} />
            <span>
              {participants.length} {participants.length === 1 ? 'member' : 'members in room'}
            </span>
          </div>
          <div className="stage-simulcast-pill" title="Audio-first adaptive delivery active">
            <Radio size={12} style={{ color: 'var(--status-online)' }} />
            <span>Opus 48kHz HD</span>
          </div>
        </div>
      </header>

      {/* Main Stage Viewport */}
      <div className="stage-viewport">
        {/* SPEAKERS ON STAGE */}
        <div className="stage-section">
          <div className="stage-section-title">
            <ShieldCheck size={16} style={{ color: 'var(--accent-light)' }} />
            <span>Speakers on Stage ({speakers.length})</span>
          </div>

          <div className="stage-speakers-grid">
            {speakers.map((spk) => {
              const isSelf = spk.userId === currentUser?.id;
              const hasVideo =
                Boolean(spk.stream) &&
                spk.stream!.getVideoTracks().length > 0 &&
                spk.stream!.getVideoTracks()[0].enabled &&
                !spk.isVideoMuted;

              return (
                <div
                  key={spk.id}
                  className={`stage-speaker-card ${spk.isSpeaking ? 'speaking' : ''}`}
                >
                  {/* Speaker Video or Avatar */}
                  {hasVideo && spk.stream ? (
                    <video
                      autoPlay
                      muted={isSelf}
                      playsInline
                      ref={(v) => {
                        if (v && spk.stream && v.srcObject !== spk.stream) {
                          v.srcObject = spk.stream;
                        }
                      }}
                      className="stage-speaker-video"
                    />
                  ) : (
                    <div className="stage-speaker-avatar-wrap">
                      <Avatar
                        src={spk.avatarUrl}
                        name={spk.displayName || spk.username}
                        size={84}
                      />
                    </div>
                  )}

                  <div className="stage-speaker-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="stage-speaker-name">
                        {spk.displayName || spk.username} {isSelf && '(You)'}
                      </span>
                      <span className={`stage-role-pill ${spk.stageRole === 'host' ? 'host' : 'speaker'}`}>
                        {spk.stageRole === 'host' ? 'Host' : 'Speaker'}
                      </span>
                    </div>

                    <div className="stage-audio-indicator">
                      {spk.isAudioMuted ? (
                        <MicOff size={14} style={{ color: 'var(--danger)' }} />
                      ) : (
                        <div className="audio-bars">
                          <div
                            className="bar"
                            style={{
                              height: `${Math.min(100, Math.max(15, (spk.audioLevel || 0) * 1.5))}%`,
                            }}
                          />
                          <div
                            className="bar"
                            style={{
                              height: `${Math.min(100, Math.max(25, (spk.audioLevel || 0) * 1.2))}%`,
                            }}
                          />
                          <div
                            className="bar"
                            style={{
                              height: `${Math.min(100, Math.max(15, (spk.audioLevel || 0) * 1.8))}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AUDIENCE / LISTENERS SECTION */}
        <div className="stage-section audience-section">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <div className="stage-section-title">
              <Users size={16} style={{ color: 'var(--text-muted)' }} />
              <span>Audience Listeners ({listeners.length})</span>
            </div>

            {/* Raised Hands Badge for Speakers */}
            {isSpeaker && handRequests.length > 0 && (
              <button
                className="stage-hand-queue-btn"
                onClick={() => setShowHandQueue(!showHandQueue)}
              >
                <Hand size={14} />
                <span>
                  {handRequests.length} Request{handRequests.length > 1 ? 's' : ''} to Speak
                </span>
              </button>
            )}
          </div>

          {/* Pending Hand Raised Queue Drawer */}
          {isSpeaker && showHandQueue && handRequests.length > 0 && (
            <div className="stage-queue-panel">
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px 0' }}>
                Hand Raised Requests
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {handRequests.map((req) => (
                  <div key={req.id} className="queue-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar src={req.avatarUrl} name={req.displayName || req.username} size={28} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {req.displayName || req.username}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-sm btn-primary"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => setStageRole('speaker')}
                      >
                        <CheckCircle2 size={12} />
                        <span>Invite to Stage</span>
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ padding: '4px 8px' }}
                        onClick={() => lowerHand()}
                      >
                        <XCircle size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real Audience Grid */}
          <div className="stage-audience-grid">
            {listeners.map((listener) => {
              const isSelf = listener.userId === currentUser?.id;
              return (
                <div
                  key={listener.id}
                  className={`stage-listener-chip ${isSelf ? 'self' : ''}`}
                >
                  <Avatar
                    src={listener.avatarUrl}
                    name={listener.displayName || listener.username}
                    size={38}
                  />
                  <span className="listener-name">
                    {listener.displayName || listener.username} {isSelf && '(You)'}
                  </span>
                  {listener.isHandRaised && (
                    <span className="hand-badge" title="Raised hand to speak">
                      ✋
                    </span>
                  )}
                </div>
              );
            })}

            {listeners.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                No listeners currently in the audience.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stage Bottom Toolbar */}
      <footer className="stage-bottom-bar">
        {/* Left Action: Hand Raise / Step Down */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSpeaker ? (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, borderRadius: 'var(--radius-pill)' }}
              onClick={() => setStageRole('listener')}
              title="Step down to audience"
            >
              Step Down to Audience
            </button>
          ) : (
            <button
              className={`btn ${isHandRaised ? 'btn-secondary' : 'btn-primary'}`}
              style={{ borderRadius: 'var(--radius-pill)', gap: 8 }}
              onClick={() => (isHandRaised ? lowerHand() : raiseHand())}
            >
              <Hand size={16} />
              <span>{isHandRaised ? 'Lower Hand' : 'Request to Speak'}</span>
            </button>
          )}
        </div>

        {/* Center Media Controls (if speaker) */}
        {isSpeaker && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className={`stage-ctrl-btn ${isAudioMuted ? 'muted' : ''}`}
              onClick={toggleAudio}
              title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button
              className={`stage-ctrl-btn ${isVideoMuted ? 'muted' : ''}`}
              onClick={toggleVideo}
              title={isVideoMuted ? 'Start Camera' : 'Stop Camera'}
            >
              {isVideoMuted ? <VideoOff size={18} /> : <VideoIcon size={18} />}
            </button>

            <button
              className={`stage-ctrl-btn ${isScreenSharing ? 'active' : ''}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              <Share2 size={18} />
            </button>
          </div>
        )}

        {/* Right Controls: Settings & Disconnect */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="icon-btn"
            onClick={onOpenSettings}
            title="Audio & Video Settings"
          >
            <Settings size={18} />
          </button>

          <button
            className="btn btn-danger"
            style={{ borderRadius: 'var(--radius-pill)', padding: '8px 18px' }}
            onClick={() => leaveVoiceRoom()}
            title="Leave Stage"
          >
            <PhoneOff size={16} />
            <span>Leave Stage</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
