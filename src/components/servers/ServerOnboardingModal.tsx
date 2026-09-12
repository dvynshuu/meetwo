import React from 'react';
import { Sparkles, Hash, Volume2, ShieldCheck, Check, ArrowRight, X } from 'lucide-react';
import { Server, Channel } from '../../types';

interface ServerOnboardingModalProps {
  server: Server;
  channels: Channel[];
  isOpen: boolean;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
}

export const ServerOnboardingModal: React.FC<ServerOnboardingModalProps> = ({
  server,
  channels,
  isOpen,
  onClose,
  onSelectChannel,
}) => {
  if (!isOpen) return null;

  const serverChannels = channels.filter((c) => c.serverId === server.id);
  const starterChannels = serverChannels.slice(0, 3);

  const handleFinish = () => {
    try {
      localStorage.setItem(`mw:onboarded:${server.id}`, 'true');
    } catch {}
    onClose();
  };

  const handlePickChannel = (cId: string) => {
    try {
      localStorage.setItem(`mw:onboarded:${server.id}`, 'true');
    } catch {}
    onSelectChannel(cId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleFinish}>
      <div className="server-onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <button className="onboarding-close-btn" onClick={handleFinish} aria-label="Close">
          <X size={18} />
        </button>

        <div className="onboarding-hero">
          {server.iconUrl ? (
            <img src={server.iconUrl} alt={server.name} className="onboarding-icon" />
          ) : (
            <div className="onboarding-icon-placeholder">
              {server.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <h2 className="onboarding-title">Welcome to {server.name}!</h2>
          <p className="onboarding-desc">
            {server.description || 'Welcome to our space for collaboration, live voice sessions, and community.'}
          </p>
        </div>

        <div className="onboarding-body">
          <h3 className="onboarding-section-title">RECOMMENDED CHANNELS TO START</h3>
          <div className="onboarding-channel-list">
            {starterChannels.map((c) => (
              <div
                key={c.id}
                className="onboarding-channel-card"
                onClick={() => handlePickChannel(c.id)}
                role="button"
              >
                <div className="onboarding-channel-icon">
                  {c.type === 'voice' ? <Volume2 size={16} /> : <Hash size={16} />}
                </div>
                <div className="onboarding-channel-info truncate">
                  <span className="onboarding-channel-name truncate">{c.name}</span>
                  <span className="onboarding-channel-topic truncate">{c.topic || 'Start talking here'}</span>
                </div>
                <ArrowRight size={14} className="onboarding-channel-arrow" />
              </div>
            ))}
          </div>

          <div className="onboarding-rules-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <ShieldCheck size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Community Norms</span>
            </div>
            <ul className="onboarding-rules-list">
              <li>Be thoughtful and constructive in all discussions.</li>
              <li>Keep audio equipment unmuted only when speaking or in open voice lounges.</li>
              <li>Use appropriate channels for specific technical topics.</li>
            </ul>
          </div>
        </div>

        <footer className="onboarding-footer">
          <button className="onboarding-submit-btn" onClick={handleFinish}>
            <span>Got it, let's explore</span>
            <Check size={16} />
          </button>
        </footer>
      </div>
    </div>
  );
};
