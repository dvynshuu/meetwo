import React, { useState, useEffect } from 'react';
import { User, ServerMember } from '../../types';
import { Avatar } from '../ui/Avatar';
import { AtSign, MessageSquare, Shield, Crown, Sparkles, X, Send } from 'lucide-react';
import { useDM } from '../../app/providers/DMContext';
import { useAuth } from '../../app/providers/AuthContext';

interface UserProfilePopoverProps {
  user: User;
  member?: ServerMember;
  onClose: () => void;
  onMention: (username: string) => void;
}

export const UserProfilePopover: React.FC<UserProfilePopoverProps> = ({
  user,
  member,
  onClose,
  onMention,
}) => {
  const { currentUser } = useAuth();
  const { startConversationWithUser, sendDM } = useDM();
  const [quickMsg, setQuickMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSendQuickMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickMsg.trim() || isSending) return;

    setIsSending(true);
    try {
      const convoId = await startConversationWithUser(user);
      if (convoId) {
        await sendDM(convoId, quickMsg.trim());
        setQuickMsg('');
        setSendSuccess(true);
        setTimeout(() => {
          setSendSuccess(false);
          onClose();
        }, 1000);
      }
    } catch (err) {
      console.warn('Failed to send quick DM:', err);
    } finally {
      setIsSending(false);
    }
  };

  const isSelf = currentUser?.id === user.id;

  return (
    <div className="user-popover-overlay" onClick={onClose}>
      <div className="user-popover-card" onClick={(e) => e.stopPropagation()}>
        {/* Banner Header with Meetwo software-craft depth */}
        <div className="user-popover-banner">
          <button
            className="icon-btn user-popover-close"
            onClick={onClose}
            aria-label="Close Profile"
          >
            <X size={15} />
          </button>
        </div>

        {/* Avatar Positioned over Banner */}
        <div className="user-popover-avatar-wrap">
          <Avatar
            src={user.avatarUrl}
            name={user.displayName || user.username}
            size={80}
            status={user.status}
            showStatus={true}
          />
        </div>

        {/* Profile Details Container */}
        <div className="user-popover-body">
          {/* Header Row: Names & Badges */}
          <div className="user-popover-names-row">
            <div className="user-popover-names">
              <h3 className="truncate">{user.displayName || user.username}</h3>
              <span className="user-popover-username">@{user.username}</span>
            </div>

            {/* Badges Cluster */}
            <div className="user-popover-badges">
              {member?.role === 'owner' && (
                <span className="user-badge-chip owner" title="Server Owner">
                  <Crown size={12} />
                </span>
              )}
              {(member?.role === 'admin' || member?.role === 'moderator') && (
                <span className="user-badge-chip mod" title={member.role === 'admin' ? 'Admin' : 'Moderator'}>
                  <Shield size={12} />
                </span>
              )}
              <span className="user-badge-chip member" title="Meetwo Member">
                <Sparkles size={12} />
              </span>
            </div>
          </div>

          {/* Custom Status Quote Block */}
          {user.customStatus && (
            <div className="user-popover-custom-status">
              <span className="custom-status-emoji">{user.customStatus.emoji || '💬'}</span>
              <span className="custom-status-text truncate">{user.customStatus.text}</span>
            </div>
          )}

          <div className="user-popover-divider" />

          {/* About Me Section */}
          <div className="user-popover-section">
            <span className="user-section-title">ABOUT ME</span>
            <p className="user-popover-bio-text">
              {user.bio || 'This user hasn’t written a bio yet.'}
            </p>
          </div>

          {/* Roles Tags */}
          {member && (
            <div className="user-popover-section">
              <span className="user-section-title">ROLES</span>
              <div className="user-popover-roles">
                <span className={`role-pill role-${member.role}`}>
                  <span className="role-dot" />
                  <span>{member.role.charAt(0).toUpperCase() + member.role.slice(1)}</span>
                </span>
                <span className="role-pill">
                  <span className="role-dot" style={{ backgroundColor: 'var(--text-muted)' }} />
                  <span>@everyone</span>
                </span>
              </div>
            </div>
          )}

          {/* Quick Message Input Box (Discord signature direct reply) */}
          {!isSelf && (
            <div className="user-popover-quick-message">
              <form onSubmit={handleSendQuickMessage} className="quick-message-form">
                <input
                  type="text"
                  className="quick-message-input"
                  placeholder={`Message @${user.displayName || user.username}`}
                  value={quickMsg}
                  onChange={(e) => setQuickMsg(e.target.value)}
                  disabled={isSending}
                />
                <button
                  type="submit"
                  className={`quick-message-submit ${quickMsg.trim() ? 'active' : ''}`}
                  disabled={!quickMsg.trim() || isSending}
                  aria-label="Send direct message"
                >
                  <Send size={14} />
                </button>
              </form>
              {sendSuccess && (
                <span style={{ fontSize: 11, color: 'var(--semantic-success)', marginTop: 4, display: 'block' }}>
                  ✓ Message sent!
                </span>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="user-popover-actions">
            <button
              type="button"
              className="user-action-btn secondary"
              onClick={() => {
                onMention(user.username);
                onClose();
              }}
            >
              <AtSign size={13} />
              <span>Mention</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
