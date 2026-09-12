import React from 'react';
import { Plus } from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';

interface ServerSidebarProps {
  onOpenCreateServer: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({ onOpenCreateServer }) => {
  const { servers, activeServer, selectServer } = useServer();

  return (
    <aside className="server-sidebar" aria-label="Workspaces">
      {/* Brand Anchor: meetwo mark */}
      <button
        className={`brand-anchor ${!activeServer ? 'active' : ''}`}
        title="meetwo"
        onClick={() => {}}
        aria-label="meetwo home"
      >
        <div className="server-indicator" />
        <img
          src="/favicon.svg"
          alt="meetwo"
          style={{ width: 24, height: 24, borderRadius: 'var(--radius-xs)' }}
        />
      </button>

      <div className="server-divider" />

      {/* Workspace items */}
      {servers.map((server) => {
        const isActive = activeServer?.id === server.id;
        const initials = server.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <button
            key={server.id}
            className={`server-item ${isActive ? 'active' : ''}`}
            onClick={() => selectServer(server.id)}
            title={server.name}
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
        );
      })}

      {/* Create Workspace Button */}
      <button
        className="create-server-btn"
        onClick={onOpenCreateServer}
        title="Create Workspace"
        aria-label="Create Workspace"
      >
        <Plus size={16} />
      </button>
    </aside>
  );
};
