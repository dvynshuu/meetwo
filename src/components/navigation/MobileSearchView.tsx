import React, { useState, useEffect, useRef } from 'react';
import { useServer } from '../../app/providers/ServerContext';
import { useNavigation } from '../../app/providers/NavigationContext';
import { useDM } from '../../app/providers/DMContext';
import {
  Search,
  ChevronLeft,
  X,
  Hash,
  Volume2,
  Video,
  Radio,
  MessagesSquare,
  MessageSquare,
  Clock,
  LayoutGrid,
} from 'lucide-react';
import { NavigationEntry } from '../../types';

interface MobileSearchViewProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDM: (convoId: string) => void;
  onNavigateToServerChannel: (serverId: string, channelId: string) => void;
  onNavigateToServer: (serverId: string) => void;
}

export const MobileSearchView: React.FC<MobileSearchViewProps> = ({
  isOpen,
  onClose,
  onNavigateToDM,
  onNavigateToServerChannel,
  onNavigateToServer,
}) => {
  const { servers, allChannels, channels } = useServer();
  const { recentDestinations } = useNavigation();
  const { conversations } = useDM();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const combinedChannels = allChannels && allChannels.length > 0 ? allChannels : channels;

  const filteredChannels = query.trim()
    ? combinedChannels.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const filteredServers = query.trim()
    ? servers.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  const filteredDMs = query.trim()
    ? conversations.filter((c) =>
        c.participants.some(
          (p) =>
            p.displayName?.toLowerCase().includes(query.toLowerCase()) ||
            p.username.toLowerCase().includes(query.toLowerCase())
        )
      )
    : [];

  const renderChannelIcon = (type: string, name: string) => {
    switch (type) {
      case 'voice':
        return name.toLowerCase().includes('video') ? (
          <Video size={16} />
        ) : (
          <Volume2 size={16} />
        );
      case 'stage':
        return <Radio size={16} />;
      case 'forum':
        return <MessagesSquare size={16} />;
      case 'text':
      default:
        return <Hash size={16} />;
    }
  };

  const handleSelectRecent = (dest: NavigationEntry) => {
    onClose();
    if (dest.type === 'dm' && dest.conversationId) {
      onNavigateToDM(dest.conversationId);
    } else if (dest.type === 'channel' && dest.serverId && dest.channelId) {
      onNavigateToServerChannel(dest.serverId, dest.channelId);
    } else if (dest.type === 'server' && dest.serverId) {
      onNavigateToServer(dest.serverId);
    }
  };

  return (
    <div className="mobile-search-screen" role="dialog" aria-modal="true">
      {/* Top Search Input Bar */}
      <header className="mobile-search-header">
        <button
          type="button"
          className="mobile-search-back-btn"
          onClick={onClose}
          aria-label="Close search"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="mobile-search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="mobile-search-input"
            placeholder="Search channels, spaces, DMs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="clear-btn"
              onClick={() => setQuery('')}
              aria-label="Clear input"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Results or Recent Destinations */}
      <div className="mobile-search-results">
        {!query.trim() ? (
          /* Recent Destinations */
          <div className="mobile-search-section">
            <div className="section-title">
              <Clock size={14} />
              <span>RECENT DESTINATIONS</span>
            </div>
            {recentDestinations.length === 0 ? (
              <div className="empty-recents">No recent activity</div>
            ) : (
              recentDestinations.map((dest) => (
                <div
                  key={`${dest.type}-${dest.id}`}
                  className="search-result-row"
                  onClick={() => handleSelectRecent(dest)}
                  role="button"
                >
                  <div className="icon-wrap">
                    {dest.type === 'dm' ? (
                      <MessageSquare size={17} />
                    ) : (
                      <Hash size={17} />
                    )}
                  </div>
                  <div className="info truncate">
                    <span className="name truncate">{dest.name}</span>
                    <span className="sub capitalize">{dest.type}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Search Filter Results */
          <>
            {/* Channels */}
            {filteredChannels.length > 0 && (
              <div className="mobile-search-section">
                <div className="section-title">CHANNELS</div>
                {filteredChannels.map((c) => (
                  <div
                    key={c.id}
                    className="search-result-row"
                    onClick={() => {
                      onClose();
                      onNavigateToServerChannel(c.serverId, c.id);
                    }}
                    role="button"
                  >
                    <div className="icon-wrap">
                      {renderChannelIcon(c.type, c.name)}
                    </div>
                    <div className="info truncate">
                      <span className="name truncate">{c.name}</span>
                      <span className="sub">
                        {c.topic ? c.topic : `${c.type} channel`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Workspaces */}
            {filteredServers.length > 0 && (
              <div className="mobile-search-section">
                <div className="section-title">SPACES & WORKSPACES</div>
                {filteredServers.map((s) => (
                  <div
                    key={s.id}
                    className="search-result-row"
                    onClick={() => {
                      onClose();
                      onNavigateToServer(s.id);
                    }}
                    role="button"
                  >
                    <div className="icon-wrap">
                      <LayoutGrid size={17} />
                    </div>
                    <div className="info truncate">
                      <span className="name truncate">{s.name}</span>
                      <span className="sub truncate">{s.description || 'Workspace'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Direct Messages */}
            {filteredDMs.length > 0 && (
              <div className="mobile-search-section">
                <div className="section-title">DIRECT MESSAGES</div>
                {filteredDMs.map((dm) => {
                  const target = dm.participants[0];
                  return (
                    <div
                      key={dm.id}
                      className="search-result-row"
                      onClick={() => {
                        onClose();
                        onNavigateToDM(dm.id);
                      }}
                      role="button"
                    >
                      <div className="icon-wrap">
                        <MessageSquare size={17} />
                      </div>
                      <div className="info truncate">
                        <span className="name truncate">
                          {target?.displayName || target?.username || 'Direct Message'}
                        </span>
                        <span className="sub">Direct conversation</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredChannels.length === 0 &&
              filteredServers.length === 0 &&
              filteredDMs.length === 0 && (
                <div className="search-no-results">
                  <p>No results found for &ldquo;{query}&rdquo;</p>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};
