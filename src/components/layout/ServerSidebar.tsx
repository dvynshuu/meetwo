import React from 'react';
import { Plus, Compass } from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';

interface ServerSidebarProps {
  onOpenCreateServer: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({ onOpenCreateServer }) => {
  const { servers, activeServer, selectServer } = useServer();

  return (
    <aside className="server-sidebar" aria-label="Servers sidebar">
      {/* Home / Meetwo Brand Home */}
      <button
        className={`server-item ${!activeServer ? 'active' : ''}`}
        title="Meetwo Direct Messages & Communities"
        onClick={() => {}}
      >
        <div className="server-pill" />
        <img
          src="/favicon.svg"
          alt="Meetwo Brand"
          style={{ width: 28, height: 28, borderRadius: 'var(--radius-xs)' }}
        />
      </button>

      <div className="server-divider" />

      {/* Server icons */}
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
          >
            <div className="server-pill" />
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

      {/* Add Server Button */}
      <button
        className="server-item"
        onClick={onOpenCreateServer}
        title="Add a Server"
        style={{ color: 'var(--status-online)', background: 'rgba(16, 185, 129, 0.1)' }}
      >
        <Plus size={22} />
      </button>
    </aside>
  );
};
