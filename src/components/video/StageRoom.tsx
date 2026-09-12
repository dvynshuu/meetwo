import React, { useState, useEffect } from 'react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Avatar } from '../ui/Avatar';
import {
  Mic,
  MicOff,
  Video,
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
  Volume2,
} from 'lucide-react';

interface StageRoomProps {
  onOpenSettings: () => void;
}

interface StageUser {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'host' | 'speaker' | 'listener';
  isSpeaking: boolean;
  audioLevel: number;
  isMuted: boolean;
  isHandRaised?: boolean;
}

export const StageRoom: React.FC<StageRoomProps> = ({ onOpenSettings }) => {
  const { activeChannel } = useServer();
  const { currentUser } = useAuth();
  const {
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    audioLevel,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    localStream,
  } = useMedia();

  // Local stage state
  const [isSpeaker, setIsSpeaker] = useState(true); // Current user starts as host/speaker for demo
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showHandQueue, setShowHandQueue] = useState(false);

  // Simulated co-speakers & audience
  const [speakers, setSpeakers] = useState<StageUser[]>([
    {
      id: 'speaker-elena',
      name: 'Elena Rostova',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      role: 'speaker',
      isSpeaking: true,
      audioLevel: 68,
      isMuted: false,
    },
  ]);

  const [audience, setAudience] = useState<StageUser[]>([
    {
      id: 'user-sam',
      name: 'Sam Chen',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      role: 'listener',
      isSpeaking: false,
      audioLevel: 0,
      isMuted: true,
      isHandRaised: true,
    },
    {
      id: 'user-alex',
      name: 'Alex Rivera',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      role: 'listener',
      isSpeaking: false,
      audioLevel: 0,
      isMuted: true,
      isHandRaised: false,
    },
    {
      id: 'user-marcus',
      name: 'Marcus Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      role: 'listener',
      isSpeaking: false,
      audioLevel: 0,
      isMuted: true,
      isHandRaised: false,
    },
    {
      id: 'user-zoe',
      name: 'Zoe Kim',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
      role: 'listener',
      isSpeaking: false,
      audioLevel: 0,
      isMuted: true,
      isHandRaised: false,
    },
  ]);

  // Periodic simulated speaking energy pulse for Elena
  useEffect(() => {
    const interval = setInterval(() => {
      setSpeakers((prev) =>
        prev.map((s) => {
          if (s.id === 'speaker-elena') {
            const talking = Math.random() > 0.35;
            return {
              ...s,
              isSpeaking: talking,
              audioLevel: talking ? Math.floor(Math.random() * 60 + 30) : 0,
            };
          }
          return s;
        })
      );
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const raisedHandsCount = audience.filter((a) => a.isHandRaised).length;

  const handleApproveSpeaker = (userId: string) => {
    const target = audience.find((a) => a.id === userId);
    if (!target) return;

    setAudience((prev) => prev.filter((a) => a.id !== userId));
    setSpeakers((prev) => [
      ...prev,
      {
        ...target,
        role: 'speaker',
        isHandRaised: false,
        isMuted: false,
      },
    ]);
  };

  const handleDismissHand = (userId: string) => {
    setAudience((prev) =>
      prev.map((a) => (a.id === userId ? { ...a, isHandRaised: false } : a))
    );
  };

  const handleToggleMyHand = () => {
    setIsHandRaised((prev) => !prev);
  };

  const handleLeaveStage = () => {
    setIsSpeaker(false);
  };

  const handleJoinAsSpeaker = () => {
    setIsSpeaker(true);
    setIsHandRaised(false);
  };

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
              {activeChannel?.name || 'Town Hall Stage'}
            </h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {activeChannel?.topic || 'Weekly Community Broadcast & Live Keynote'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="stage-listener-counter">
            <Users size={14} />
            <span>{audience.length + (isSpeaker ? 0 : 1) + 128} listening</span>
          </div>
          <div className="stage-simulcast-pill" title="Dynamic downscaling active: 720p/30fps">
            <Radio size={12} style={{ color: 'var(--status-online)' }} />
            <span>HQ Adaptive Broadcast</span>
          </div>
        </div>
      </header>

      {/* Main Stage Viewport */}
      <div className="stage-viewport">
        {/* SPEAKERS ON STAGE */}
        <div className="stage-section">
          <div className="stage-section-title">
            <ShieldCheck size={16} style={{ color: 'var(--accent-light)' }} />
            <span>Speakers on Stage ({speakers.length + (isSpeaker ? 1 : 0)})</span>
          </div>

          <div className="stage-speakers-grid">
            {/* Current User Tile (if speaker) */}
            {isSpeaker && currentUser && (
              <div
                className={`stage-speaker-card ${
                  !isAudioMuted && audioLevel > 15 ? 'speaking' : ''
                }`}
              >
                {/* Local Video if camera enabled, else rich avatar */}
                {!isVideoMuted && localStream ? (
                  <video
                    autoPlay
                    muted
                    playsInline
                    ref={(v) => {
                      if (v && localStream) v.srcObject = localStream;
                    }}
                    className="stage-speaker-video"
                  />
                ) : (
                  <div className="stage-speaker-avatar-wrap">
                    <Avatar
                      src={currentUser.avatarUrl}
                      name={currentUser.displayName || currentUser.username}
                      size={84}
                    />
                  </div>
                )}

                <div className="stage-speaker-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="stage-speaker-name">
                      {currentUser.displayName || currentUser.username} (You)
                    </span>
                    <span className="stage-role-pill host">Host</span>
                  </div>

                  <div className="stage-audio-indicator">
                    {isAudioMuted ? (
                      <MicOff size={14} style={{ color: 'var(--danger)' }} />
                    ) : (
                      <div className="audio-bars">
                        <div
                          className="bar"
                          style={{
                            height: `${Math.min(100, Math.max(20, audioLevel * 1.5))}%`,
                          }}
                        />
                        <div
                          className="bar"
                          style={{
                            height: `${Math.min(100, Math.max(30, audioLevel * 1.2))}%`,
                          }}
                        />
                        <div
                          className="bar"
                          style={{
                            height: `${Math.min(100, Math.max(15, audioLevel * 1.8))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Remote Speakers */}
            {speakers.map((spk) => (
              <div
                key={spk.id}
                className={`stage-speaker-card ${spk.isSpeaking ? 'speaking' : ''}`}
              >
                <div className="stage-speaker-avatar-wrap">
                  <Avatar src={spk.avatarUrl} name={spk.name} size={84} />
                </div>
                <div className="stage-speaker-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="stage-speaker-name">{spk.name}</span>
                    <span className="stage-role-pill speaker">Speaker</span>
                  </div>

                  <div className="stage-audio-indicator">
                    {spk.isMuted ? (
                      <MicOff size={14} style={{ color: 'var(--danger)' }} />
                    ) : (
                      <div className="audio-bars">
                        <div
                          className="bar"
                          style={{
                            height: `${spk.isSpeaking ? spk.audioLevel : 20}%`,
                          }}
                        />
                        <div
                          className="bar"
                          style={{
                            height: `${spk.isSpeaking ? spk.audioLevel * 0.8 : 15}%`,
                          }}
                        />
                        <div
                          className="bar"
                          style={{
                            height: `${spk.isSpeaking ? spk.audioLevel * 1.1 : 25}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
              <span>Audience Listeners</span>
            </div>

            {/* Raised Hands Badge for Speakers */}
            {isSpeaker && raisedHandsCount > 0 && (
              <button
                className="stage-hand-queue-btn"
                onClick={() => setShowHandQueue(!showHandQueue)}
              >
                <Hand size={14} />
                <span>{raisedHandsCount} Request{raisedHandsCount > 1 ? 's' : ''} to Speak</span>
              </button>
            )}
          </div>

          {/* Pending Hand Raised Queue Drawer */}
          {isSpeaker && showHandQueue && raisedHandsCount > 0 && (
            <div className="stage-queue-panel">
              <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px 0' }}>
                Hand Raised Requests
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {audience
                  .filter((a) => a.isHandRaised)
                  .map((a) => (
                    <div key={a.id} className="queue-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar src={a.avatarUrl} name={a.name} size={28} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={() => handleApproveSpeaker(a.id)}
                        >
                          <CheckCircle2 size={12} />
                          <span>Invite to Stage</span>
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          style={{ padding: '4px 8px' }}
                          onClick={() => handleDismissHand(a.id)}
                        >
                          <XCircle size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Audience Grid */}
          <div className="stage-audience-grid">
            {/* If current user is listener */}
            {!isSpeaker && currentUser && (
              <div className="stage-listener-chip self">
                <Avatar
                  src={currentUser.avatarUrl}
                  name={currentUser.displayName || currentUser.username}
                  size={40}
                />
                <span className="listener-name">
                  {currentUser.displayName || currentUser.username} (You)
                </span>
                {isHandRaised && (
                  <span className="hand-badge" title="Waiting for host">
                    ✋
                  </span>
                )}
              </div>
            )}

            {audience.map((a) => (
              <div key={a.id} className="stage-listener-chip">
                <Avatar src={a.avatarUrl} name={a.name} size={40} />
                <span className="listener-name">{a.name}</span>
                {a.isHandRaised && (
                  <span className="hand-badge" title="Hand raised">
                    ✋
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stage Bottom Toolbar */}
      <footer className="stage-bottom-bar">
        {/* Left Action: Hand Raise / Leave Stage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isSpeaker ? (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12, borderRadius: 'var(--radius-pill)' }}
              onClick={handleLeaveStage}
              title="Step down from stage to audience"
            >
              Step Down to Audience
            </button>
          ) : (
            <button
              className={`btn ${isHandRaised ? 'btn-secondary' : 'btn-primary'}`}
              style={{ borderRadius: 'var(--radius-pill)', gap: 8 }}
              onClick={handleToggleMyHand}
            >
              <Hand size={16} />
              <span>{isHandRaised ? 'Lower Hand' : 'Request to Speak'}</span>
            </button>
          )}

          {!isSpeaker && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, color: 'var(--text-muted)' }}
              onClick={handleJoinAsSpeaker}
            >
              (Demo: Switch to Speaker)
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
              {isVideoMuted ? <VideoOff size={18} /> : <Video size={18} />}
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
            onClick={() => window.history.back?.()}
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
