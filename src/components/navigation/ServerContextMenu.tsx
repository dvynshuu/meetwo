import React, { useEffect, useRef } from 'react';
import { CheckCheck, UserPlus, Plus, Settings, Bell, LogOut } from 'lucide-react';
import { Server } from '../../types';

interface ServerContextMenuProps {
  server: Server;
  x: number;
  y: number;
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenInvite: () => void;
  onOpenCreateChannel: () => void;
  onOpenSettings: () => void;
}

export const ServerContextMenu: React.FC<ServerContextMenuProps> = ({
  server,
  x,
  y,
  onClose,
  onMarkAllRead,
  onOpenInvite,
  onOpenCreateChannel,
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

  const menuWidth = 220;
  const menuHeight = 220;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className="context-menu-popover"
      style={{ left: adjustedX, top: adjustedY }}
      role="menu"
      aria-label="Workspace Actions"
    >
      <div className="context-menu-header truncate">
        {server.name}
      </div>

      <button
        className="context-menu-item"
        onClick={() => {
          onMarkAllRead();
          onClose();
        }}
      >
        <CheckCheck size={14} />
        <span>Mark As Read</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onOpenInvite();
          onClose();
        }}
      >
        <UserPlus size={14} />
        <span>Invite People</span>
      </button>

      <button
        className="context-menu-item"
        onClick={() => {
          onOpenCreateChannel();
          onClose();
        }}
      >
        <Plus size={14} />
        <span>Create Channel</span>
      </button>

      <div className="context-menu-divider" />

      <button
        className="context-menu-item"
        onClick={() => {
          onOpenSettings();
          onClose();
        }}
      >
        <Settings size={14} />
        <span>Server Settings</span>
      </button>

      <div className="context-menu-divider" />

      <button
        className="context-menu-item danger-item"
        onClick={() => {
          onClose();
        }}
      >
        <LogOut size={14} />
        <span>Leave Server</span>
      </button>
    </div>
  );
};
