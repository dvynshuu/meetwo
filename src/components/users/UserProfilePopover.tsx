import React, { useEffect } from 'react';
import { User, ServerMember } from '../../types';
import { Avatar } from '../ui/Avatar';
import { AtSign, MessageSquare, Shield, X, VolumeX } from 'lucide-react';
import { Button } from '../ui/Button';

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
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="user-popover-overlay" onClick={onClose}>
      <div className="user-popover-card" onClick={(e) => e.stopPropagation()}>
        {/* Banner Header */}
        <div className="user-popover-banner">
          <button className="icon-btn user-popover-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Avatar Positioned over Banner */}
        <div className="user-popover-avatar-wrap">
          <Avatar
            src={user.avatarUrl}
            name={user.displayName || user.username}
            size={72}
            status={user.status}
            showStatus={true}
          />
        </div>

        {/* Profile Details */}
        <div className="user-popover-body">
          <div className="user-popover-names">
            <h4>{user.displayName || user.username}</h4>
            <span className="user-popover-username">#{user.username}</span>
          </div>

          {member && (
            <div className="user-popover-role-badge">
              <Shield size={12} style={{ color: 'var(--accent-light)' }} />
              <span>{member.role.toUpperCase()}</span>
            </div>
          )}

          {user.bio && (
            <div className="user-popover-bio">
              <span className="input-label" style={{ fontSize: 10 }}>About Me</span>
              <p>{user.bio}</p>
            </div>
          )}

          <div className="user-popover-divider" />

          {/* Quick Actions */}
          <div className="user-popover-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={<AtSign size={14} />}
              onClick={() => {
                onMention(user.username);
                onClose();
              }}
            >
              Mention
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<MessageSquare size={14} />}
              onClick={() => {
                onClose();
              }}
            >
              Message
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
