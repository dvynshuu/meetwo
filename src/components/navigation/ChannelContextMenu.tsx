import React, { useEffect, useRef } from 'react';
import { Check, Bell, BellOff, Link2, Settings, Trash2, VolumeX, Hash, Volume2 } from 'lucide-react';
import { Channel } from '../../types';

interface ChannelContextMenuProps {
  channel: Channel;
  x: number;
  y: number;
  onClose: () => void;
  onMarkRead: (channelId: string) => void;
  onOpenSettings?: () => void;
}

export const ChannelContextMenu: React.FC<ChannelContextMenuProps> = ({
  channel,
  x,
  y,
  onClose,
  onMarkRead,
  onOpenSettings,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/channels/${channel.serverId}/${channel.id}`);
    onClose();
  };

  // Adjust positioning to avoid going off screen
  const menuWidth = 200;
  const menuHeight = 180;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className="context-menu-popover"
      style={{ left: adjustedX, top: adjustedY }}
      role="menu"
      aria-label="Channel Actions"
    >
      <div className="context-menu-header truncate">
        {channel.name}
      </div>

      <button
        className="context-menu-item"
        onClick={() => {
          onMarkRead(channel.id);
          onClose();
        }}
      >
        <Check size={14} />
        <span>Mark as Read</span>
      </button>

      <button className="context-menu-item" onClick={handleCopyLink}>
        <Link2 size={14} />
        <span>Copy Channel Link</span>
      </button>

      <div className="context-menu-divider" />

      <button
        className="context-menu-item"
        onClick={() => {
          if (onOpenSettings) onOpenSettings();
          onClose();
        }}
      >
        <Settings size={14} />
        <span>Notification Settings</span>
      </button>

      <button
        className="context-menu-item danger-item"
        onClick={() => {
          onClose();
        }}
      >
        <VolumeX size={14} />
        <span>Mute #{channel.name}</span>
      </button>
    </div>
  );
};
