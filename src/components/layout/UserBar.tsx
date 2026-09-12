import React, { useState } from 'react';
import { Mic, MicOff, Settings, ChevronDown, Check } from 'lucide-react';
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

  if (!currentUser) return null;

  const statuses: { label: string; value: UserStatus; color: string }[] = [
    { label: 'Online', value: 'online', color: 'var(--status-online)' },
    { label: 'Idle', value: 'idle', color: 'var(--status-idle)' },
    { label: 'Do Not Disturb', value: 'dnd', color: 'var(--status-dnd)' },
    { label: 'Invisible', value: 'offline', color: 'var(--status-offline)' },
  ];

  return (
    <footer className="user-bar" aria-label="User navigation bar">
      {/* Profile summary & Status trigger */}
      <div
        className="user-bar-profile"
        onClick={() => setShowStatusMenu(!showStatusMenu)}
        title="Change Online Status or Set Custom Status"
      >
        <Avatar
          src={currentUser.avatarUrl}
          name={currentUser.displayName || currentUser.username}
          size={34}
          status={currentUser.status}
          showStatus={true}
        />
        <div className="user-bar-info">
          <span className="user-bar-name truncate">
            {currentUser.displayName || currentUser.username}
          </span>
          <span className="user-bar-status truncate" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {currentUser.customStatus ? (
              <>
                <span>{currentUser.customStatus.emoji || '💬'}</span>
                <span className="truncate">{currentUser.customStatus.text}</span>
              </>
            ) : (
              `#${currentUser.username}`
            )}
          </span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
      </div>

      {/* Quick Action Buttons */}
      <div className="user-bar-actions">
        <button
          className={`icon-btn ${isAudioMuted ? 'active' : ''}`}
          onClick={toggleAudio}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          aria-label={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isAudioMuted ? <MicOff size={18} style={{ color: 'var(--danger)' }} /> : <Mic size={18} />}
        </button>

        <button
          className="icon-btn"
          onClick={onOpenSettings}
          title="User Settings"
          aria-label="User Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Status Picker Popover */}
      {showStatusMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setShowStatusMenu(false)}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '62px',
              left: '10px',
              width: '180px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '6px',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {/* Custom Status trigger */}
            <button
              onClick={() => {
                setShowStatusMenu(false);
                setShowCustomStatusModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--accent-light)',
                background: 'rgba(99, 102, 241, 0.1)',
                marginBottom: 4,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span>{currentUser.customStatus?.emoji || '💬'}</span>
              <span>{currentUser.customStatus ? 'Edit Status' : 'Set Custom Status'}</span>
            </button>

            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 0 4px 0' }} />

            {statuses.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setStatus(s.value);
                  setShowStatusMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: s.color,
                    }}
                  />
                  <span>{s.label}</span>
                </div>
                {currentUser.status === s.value && <Check size={14} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Custom Status Modal */}
      <CustomStatusModal
        isOpen={showCustomStatusModal}
        onClose={() => setShowCustomStatusModal(false)}
      />
    </footer>
  );
};
