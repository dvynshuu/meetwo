import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Settings, ChevronDown, Check, Smile } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthContext';
import { useMedia } from '../../app/providers/MediaContext';
import { Avatar } from '../ui/Avatar';
import { UserStatus } from '../../types';
import { CustomStatusModal } from '../ui/CustomStatusModal';

interface UserBarProps {
  onOpenSettings: () => void;
}

export const UserBar: React.FC<UserBarProps> = ({ onOpenSettings }) => {
  const { currentUser, setStatus } = useAuth();
  const { isAudioMuted, toggleAudio } = useMedia();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCustomStatusModal, setShowCustomStatusModal] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) return null;

  const statuses: { label: string; value: UserStatus; color: string }[] = [
    { label: 'Online', value: 'online', color: 'var(--status-online)' },
    { label: 'Away / Idle', value: 'idle', color: 'var(--status-idle)' },
    { label: 'Do Not Disturb', value: 'dnd', color: 'var(--status-dnd)' },
    { label: 'Invisible', value: 'offline', color: 'var(--status-offline)' },
  ];

  return (
    <footer className="user-bar" aria-label="User navigation" ref={statusMenuRef}>
      {/* Profile summary & Status trigger */}
      <div
        className="user-bar-profile"
        onClick={() => setShowStatusMenu(!showStatusMenu)}
        title="Change Status"
        role="button"
        aria-expanded={showStatusMenu}
        aria-haspopup="menu"
      >
        <Avatar
          src={currentUser.avatarUrl}
          name={currentUser.displayName || currentUser.username}
          size={30}
          status={currentUser.status}
          showStatus={true}
        />
        <div className="user-bar-info">
          <span className="user-bar-name truncate">
            {currentUser.displayName || currentUser.username}
          </span>
          <span className="user-bar-status truncate">
            {currentUser.customStatus ? (
              <>
                <span>{currentUser.customStatus.emoji || '💬'} </span>
                <span>{currentUser.customStatus.text}</span>
              </>
            ) : (
              `@${currentUser.username}`
            )}
          </span>
        </div>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', marginLeft: 2 }} />
      </div>

      {/* Quick Action Buttons */}
      <div className="user-bar-actions">
        <button
          className={`icon-btn ${isAudioMuted ? 'active' : ''}`}
          onClick={toggleAudio}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          aria-label={isAudioMuted ? 'Unmute' : 'Mute'}
          style={{ width: 28, height: 28 }}
        >
          {isAudioMuted ? <MicOff size={15} style={{ color: 'var(--danger)' }} /> : <Mic size={15} />}
        </button>

        <button
          className="icon-btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
          style={{ width: 28, height: 28 }}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* Status Picker Popover (Level 4 Overlay) */}
      {showStatusMenu && (
        <div className="user-status-menu" role="menu" aria-label="Status options">
          {/* Custom Status trigger */}
          <button
            onClick={() => {
              setShowStatusMenu(false);
              setShowCustomStatusModal(true);
            }}
            className="dropdown-item"
            style={{ color: 'var(--accent)', fontWeight: 600 }}
            role="menuitem"
          >
            <Smile size={14} />
            <span>{currentUser.customStatus ? 'Edit Status' : 'Set Custom Status'}</span>
          </button>

          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />

          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setStatus(s.value);
                setShowStatusMenu(false);
              }}
              className="dropdown-item"
              role="menuitem"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: s.color,
                  }}
                />
                <span>{s.label}</span>
              </div>
              {currentUser.status === s.value && (
                <Check size={13} style={{ color: 'var(--accent)', marginLeft: 'auto' }} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Custom Status Modal */}
      <CustomStatusModal
        isOpen={showCustomStatusModal}
        onClose={() => setShowCustomStatusModal(false)}
      />
    </footer>
  );
};
