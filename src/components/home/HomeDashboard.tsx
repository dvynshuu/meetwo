import React from 'react';
import { Compass, Hash, Volume2, Radio, MessageSquare, Clock, ArrowRight, Sparkles, Command, Plus, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthContext';
import { useNavigation } from '../../app/providers/NavigationContext';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import { NavigationEntry } from '../../types';

interface HomeDashboardProps {
  onNavigateToDestination: (entry: NavigationEntry) => void;
  onOpenQuickSwitcher: () => void;
  onGoToFriends: () => void;
  onNavigateToChannel?: (serverId: string, channelId: string) => void;
  onSelectServer?: (serverId: string) => void;
  onOpenCreateServer?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigateToDestination,
  onOpenQuickSwitcher,
  onGoToFriends,
  onNavigateToChannel,
  onSelectServer,
  onOpenCreateServer,
}) => {
  const { currentUser } = useAuth();
  const { recentDestinations } = useNavigation();
  const { channels, servers, selectServer, selectChannel, activeServer } = useServer();
  const { activeRoomId, openPreJoin } = useMedia();

  const displayName = currentUser?.displayName || currentUser?.username || 'Friend';

  // Voice and Stage channels
  const voiceAndStageChannels = channels.filter((c) => c.type === 'voice' || c.type === 'stage');

  return (
    <div className="home-dashboard-container">
      <div className="home-dashboard-hero">
        <div className="hero-badge">
          <Sparkles size={14} style={{ color: 'var(--accent)' }} />
          <span>Meetwo Community Hub</span>
        </div>
        <h1 className="home-hero-title">Welcome back, {displayName}</h1>
        <p className="home-hero-subtitle">
          Jump right into your active discussions, connect with team members, or drop into a voice room.
        </p>

        {/* Quick Switcher Prompt Bar */}
        <div className="hero-quick-bar" onClick={onOpenQuickSwitcher} role="button">
          <Command size={15} style={{ color: 'var(--accent)' }} />
          <span>Press <kbd className="command-kbd">Ctrl</kbd> + <kbd className="command-kbd">K</kbd> to jump anywhere in Meetwo</span>
          <ArrowRight size={14} className="hero-arrow" />
        </div>
      </div>

      {/* Workspaces Section */}
      {servers.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <LayoutGrid size={16} style={{ color: 'var(--text-muted)' }} />
            <h2 className="section-title">Your Workspaces</h2>
          </div>
          <div className="workspaces-grid">
            {servers.map((s) => {
              const initials = s.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={s.id}
                  className="workspace-card"
                  onClick={() => onSelectServer?.(s.id)}
                  role="button"
                >
                  <div className="workspace-icon-wrap">
                    {s.iconUrl ? (
                      <img src={s.iconUrl} alt={s.name} />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <div className="workspace-info truncate">
                    <span className="workspace-name truncate">{s.name}</span>
                    <span className="workspace-desc truncate">
                      {s.description || 'Workspace & channels'}
                    </span>
                  </div>
                  <button
                    className="workspace-open-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectServer?.(s.id);
                    }}
                  >
                    <span>Open</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty State: No Workspaces Yet */}
      {servers.length === 0 && (
        <section className="dashboard-section">
          <div className="empty-workspace-card">
            <div className="empty-workspace-icon">
              <Sparkles size={24} />
            </div>
            <h3 className="empty-workspace-title">Create your first Workspace</h3>
            <p className="empty-workspace-desc">
              Workspaces are where your team chats, organizes topics into channels, and drops into instant voice and video rooms.
            </p>
            {onOpenCreateServer && (
              <button className="empty-workspace-btn" onClick={onOpenCreateServer}>
                <Plus size={16} />
                <span>Create Workspace</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Recent Destinations */}
      {recentDestinations.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <Clock size={16} style={{ color: 'var(--text-muted)' }} />
            <h2 className="section-title">Jump Back In (Recent Destinations)</h2>
          </div>
          <div className="recent-destinations-grid">
            {recentDestinations.slice(0, 6).map((dest) => (
              <div
                key={`${dest.type}-${dest.id}`}
                className="destination-card"
                onClick={() => onNavigateToDestination(dest)}
                role="button"
              >
                <div className="destination-icon-wrap">
                  {dest.type === 'dm' ? (
                    <MessageSquare size={16} />
                  ) : (
                    <Hash size={16} />
                  )}
                </div>
                <div className="destination-info truncate">
                  <span className="destination-name truncate">{dest.name}</span>
                  <span className="destination-type capitalize">{dest.type}</span>
                </div>
                <ArrowRight size={14} className="destination-arrow" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Voice & Live Stages */}
      {voiceAndStageChannels.length > 0 && (
        <section className="dashboard-section">
          <div className="section-header">
            <Volume2 size={16} style={{ color: 'var(--text-muted)' }} />
            <h2 className="section-title">Drop-in Voice & Broadcast Stages</h2>
          </div>
          <div className="voice-rooms-grid">
            {voiceAndStageChannels.map((room) => {
              const server = servers.find((s) => s.id === room.serverId);
              const isStage = room.type === 'stage';
              const isCurrent = activeRoomId === room.id;

              return (
                <div key={room.id} className="voice-room-card">
                  <div className="voice-room-top">
                    <div className="voice-room-badge">
                      {isStage ? <Radio size={13} /> : <Volume2 size={13} />}
                      <span>{isStage ? 'LIVE STAGE' : 'VOICE ROOM'}</span>
                    </div>
                    {server && <span className="voice-room-server truncate">{server.name}</span>}
                  </div>

                  <h3 className="voice-room-name truncate">{room.name}</h3>
                  <p className="voice-room-topic truncate">{room.topic || 'Drop in to join conversation'}</p>

                  <button
                    className={`voice-room-action-btn ${isCurrent ? 'active' : ''}`}
                    onClick={() => {
                      if (onNavigateToChannel) {
                        onNavigateToChannel(room.serverId, room.id);
                      } else {
                        selectServer(room.serverId);
                        selectChannel(room.id);
                      }
                      if (!isCurrent && room.type === 'voice') {
                        openPreJoin(room.id);
                      }
                    }}
                  >
                    {isCurrent ? 'Currently Connected' : isStage ? 'Listen on Stage' : 'Join Voice Room'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
