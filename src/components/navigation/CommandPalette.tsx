import React, { useState, useEffect, useRef } from 'react';
import { Search, Settings, Plus, Mic, Video as VideoIcon, X, CheckCheck, UserPlus, Shield, Activity, Users } from 'lucide-react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { useInbox } from '../../app/providers/InboxContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenCreateServer: () => void;
  onOpenCreateChannel: () => void;
  onOpenInvite?: () => void;
  onOpenAuditLogs?: () => void;
  onToggleMemberList?: () => void;
}

interface ActionCommand {
  id: string;
  title: string;
  category: 'Voice & Video' | 'Workspace' | 'System';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenCreateServer,
  onOpenCreateChannel,
  onOpenInvite,
  onOpenAuditLogs,
  onToggleMemberList,
}) => {
  const { toggleAudio, toggleVideo, isAudioMuted, isVideoMuted } = useMedia();
  const { activeServer } = useServer();
  const { markAllRead } = useInbox();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const actions: ActionCommand[] = [
    {
      id: 'act-toggle-mic',
      title: isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone',
      category: 'Voice & Video',
      icon: <Mic size={16} />,
      shortcut: 'Ctrl+D',
      action: () => {
        toggleAudio();
        onClose();
      },
    },
    {
      id: 'act-toggle-cam',
      title: isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off',
      category: 'Voice & Video',
      icon: <VideoIcon size={16} />,
      shortcut: 'Ctrl+E',
      action: () => {
        toggleVideo();
        onClose();
      },
    },
    {
      id: 'act-create-channel',
      title: 'Create Channel in Current Workspace',
      category: 'Workspace',
      icon: <Plus size={16} />,
      action: () => {
        onClose();
        onOpenCreateChannel();
      },
    },
    {
      id: 'act-create-server',
      title: 'Create New Workspace',
      category: 'Workspace',
      icon: <Plus size={16} />,
      action: () => {
        onClose();
        onOpenCreateServer();
      },
    },
    {
      id: 'act-invite',
      title: 'Invite Members to Workspace',
      category: 'Workspace',
      icon: <UserPlus size={16} />,
      action: () => {
        onClose();
        if (onOpenInvite) onOpenInvite();
      },
    },
    {
      id: 'act-mark-all-read',
      title: 'Mark All Channels and Mentions as Read',
      category: 'Workspace',
      icon: <CheckCheck size={16} />,
      action: () => {
        markAllRead();
        onClose();
      },
    },
    {
      id: 'act-audit-logs',
      title: 'Open Workspace Audit Logs',
      category: 'Workspace',
      icon: <Shield size={16} />,
      action: () => {
        onClose();
        if (onOpenAuditLogs) onOpenAuditLogs();
      },
    },
    {
      id: 'act-toggle-members',
      title: 'Toggle Member List Visibility',
      category: 'Workspace',
      icon: <Users size={16} />,
      action: () => {
        onClose();
        if (onToggleMemberList) onToggleMemberList();
      },
    },
    {
      id: 'act-settings',
      title: 'Open Settings (Voice, Audio, Devices)',
      category: 'System',
      icon: <Settings size={16} />,
      shortcut: 'Ctrl+,',
      action: () => {
        onClose();
        onOpenSettings();
      },
    },
  ];

  const filteredActions = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % Math.max(1, filteredActions.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="command-palette-header">
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type an action or command..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Close Command Palette">
            <X size={16} />
          </button>
        </div>

        <div className="command-palette-list">
          {filteredActions.length > 0 ? (
            filteredActions.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  className={`command-item ${isSelected ? 'selected' : ''}`}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="command-icon">{cmd.icon}</span>
                  <div className="command-info truncate">
                    <span className="command-title truncate">{cmd.title}</span>
                    <span className="command-category">{cmd.category}</span>
                  </div>
                  {cmd.shortcut && <kbd className="command-shortcut">{cmd.shortcut}</kbd>}
                </div>
              );
            })
          ) : (
            <div className="command-empty-state">No matching actions found.</div>
          )}
        </div>

        <footer className="command-palette-footer">
          <span>Tip: Press <strong>Ctrl+K</strong> for Quick Switcher (Channels & DMs)</span>
        </footer>
      </div>
    </div>
  );
};
