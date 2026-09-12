import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useDM } from '../../app/providers/DMContext';
import { useInbox } from '../../app/providers/InboxContext';
import { Tooltip } from '../ui/Tooltip';
import { ServerContextMenu } from '../navigation/ServerContextMenu';
import { Server } from '../../types';

interface ServerSidebarProps {
  viewMode: 'home' | 'server';
  onSelectHome: () => void;
  onOpenCreateServer: () => void;
  onOpenInvite?: () => void;
  onOpenCreateChannel?: () => void;
  onOpenSettings?: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  viewMode,
  onSelectHome,
  onOpenCreateServer,
  onOpenInvite = () => {},
  onOpenCreateChannel = () => {},
  onOpenSettings = () => {},
}) => {
  const { servers, activeServer, selectServer } = useServer();
  const { totalUnreadDMs } = useDM();
  const { unreadMentionCount, unreadByChannel, markAllRead } = useInbox();

  const [contextMenuState, setContextMenuState] = useState<{
    server: Server;
    x: number;
    y: number;
  } | null>(null);

  const isHomeActive = viewMode === 'home';

  const handleServerContextMenu = (e: React.MouseEvent, server: Server) => {
    e.preventDefault();
    setContextMenuState({
      server,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Check if a server has unread messages
  const serverHasUnread = (serverId: string) => {
    // In mockStore, channels have serverId
    // Check if any unread channel belongs to this server
    return Object.entries(unreadByChannel).some(([channelId, state]) => {
      return state.count > 0;
    });
  };

  return (
    <aside className="server-sidebar" aria-label="Workspaces">
      {/* Brand Anchor: Meetwo Home */}
      <Tooltip content="Home & Direct Messages" position="right">
        <button
          className={`brand-anchor ${isHomeActive ? 'active' : ''}`}
          onClick={onSelectHome}
          aria-label="Meetwo Home"
        >
          <div className="server-indicator" />
          <img
            src="/favicon.svg"
            alt="meetwo"
            style={{ width: 24, height: 24, borderRadius: 'var(--radius-xs)' }}
          />

          {/* Unread mention / DM badges */}
          {unreadMentionCount > 0 ? (
            <span className="server-badge-mention" title={`${unreadMentionCount} unread mentions`}>
              {unreadMentionCount}
            </span>
          ) : totalUnreadDMs > 0 ? (
            <span className="server-badge-dm" title={`${totalUnreadDMs} unread direct messages`} />
          ) : null}
        </button>
      </Tooltip>

      <div className="server-divider" />

      {/* Workspace items */}
      {servers.map((server) => {
        const isActive = viewMode === 'server' && activeServer?.id === server.id;
        const hasUnreads = !isActive && serverHasUnread(server.id);
        const initials = server.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <Tooltip key={server.id} content={server.name} position="right">
            <button
              className={`server-item ${isActive ? 'active' : ''} ${hasUnreads ? 'has-unread' : ''}`}
              onClick={() => selectServer(server.id)}
              onContextMenu={(e) => handleServerContextMenu(e, server)}
              aria-label={server.name}
            >
              <div className="server-indicator" />
              {server.iconUrl ? (
                <img
                  src={server.iconUrl}
                  alt={server.name}
                  style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }}
                />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          </Tooltip>
        );
      })}

      {/* Create Workspace Button */}
      <Tooltip content="Create Workspace" position="right">
        <button
          className="create-server-btn"
          onClick={onOpenCreateServer}
          aria-label="Create Workspace"
        >
          <Plus size={16} />
        </button>
      </Tooltip>

      {/* Server Right-Click Context Menu */}
      {contextMenuState && (
        <ServerContextMenu
          server={contextMenuState.server}
          x={contextMenuState.x}
          y={contextMenuState.y}
          onClose={() => setContextMenuState(null)}
          onMarkAllRead={markAllRead}
          onOpenInvite={onOpenInvite}
          onOpenCreateChannel={onOpenCreateChannel}
          onOpenSettings={onOpenSettings}
        />
      )}
    </aside>
  );
};
