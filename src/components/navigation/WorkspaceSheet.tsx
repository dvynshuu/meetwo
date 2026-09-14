import React from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useServer } from '../../app/providers/ServerContext';
import { Home, Plus, Check, Compass, Shield } from 'lucide-react';

interface WorkspaceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: 'home' | 'server';
  onSelectHome: () => void;
  onSelectServer: (serverId: string) => void;
  onOpenCreateServer: () => void;
}

export const WorkspaceSheet: React.FC<WorkspaceSheetProps> = ({
  isOpen,
  onClose,
  viewMode,
  onSelectHome,
  onSelectServer,
  onOpenCreateServer,
}) => {
  const { servers, activeServer } = useServer();

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Switch Space"
      headerAction={
        <button
          type="button"
          className="mobile-sheet-action-btn"
          onClick={() => {
            onClose();
            onOpenCreateServer();
          }}
          aria-label="Create Space"
        >
          <Plus size={16} />
          <span>New Space</span>
        </button>
      }
      maxHeight="75vh"
    >
      <div className="mobile-workspace-list">
        {/* Home Option */}
        <div
          className={`mobile-workspace-row ${viewMode === 'home' ? 'active' : ''}`}
          onClick={() => {
            onSelectHome();
            onClose();
          }}
          role="button"
        >
          <div className="mobile-workspace-icon home-icon-style">
            <Home size={20} />
          </div>
          <div className="mobile-workspace-info">
            <span className="mobile-workspace-name">Home & Direct Messages</span>
            <span className="mobile-workspace-sub">Activity, friends, and private chats</span>
          </div>
          {viewMode === 'home' && <Check size={18} className="mobile-workspace-check" />}
        </div>

        <div className="mobile-sheet-divider" />
        <div className="mobile-sheet-section-title">COMMUNITIES & SPACES</div>

        {/* Server List */}
        {servers.map((server) => {
          const isSelected = viewMode === 'server' && activeServer?.id === server.id;
          const initials = server.name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return (
            <div
              key={server.id}
              className={`mobile-workspace-row ${isSelected ? 'active' : ''}`}
              onClick={() => {
                onSelectServer(server.id);
                onClose();
              }}
              role="button"
            >
              <div className="mobile-workspace-icon">
                {server.iconUrl ? (
                  <img src={server.iconUrl} alt={server.name} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="mobile-workspace-info">
                <span className="mobile-workspace-name">{server.name}</span>
                <span className="mobile-workspace-sub truncate">
                  {server.description || 'Workspace & live rooms'}
                </span>
              </div>
              {isSelected && <Check size={18} className="mobile-workspace-check" />}
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
};
