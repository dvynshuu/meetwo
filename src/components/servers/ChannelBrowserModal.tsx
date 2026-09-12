import React, { useState } from 'react';
import { Search, Hash, Volume2, Radio, MessagesSquare, Megaphone, Plus, X, ArrowRight, Check } from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import { Channel, ChannelType } from '../../types';

interface ChannelBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateChannel: () => void;
}

export const ChannelBrowserModal: React.FC<ChannelBrowserModalProps> = ({
  isOpen,
  onClose,
  onOpenCreateChannel,
}) => {
  const { channels, activeServer, activeChannel, selectChannel } = useServer();
  const { openPreJoin } = useMedia();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ChannelType>('all');

  if (!isOpen || !activeServer) return null;

  const serverChannels = channels.filter((c) => c.serverId === activeServer.id);

  const filteredChannels = serverChannels.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.topic && c.topic.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case 'voice':
        return <Volume2 size={16} />;
      case 'stage':
        return <Radio size={16} />;
      case 'forum':
        return <MessagesSquare size={16} />;
      case 'announcement':
        return <Megaphone size={16} />;
      case 'text':
      default:
        return <Hash size={16} />;
    }
  };

  const handleSelectChannel = (c: Channel) => {
    selectChannel(c.id);
    if (c.type === 'voice') openPreJoin(c.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="channel-browser-modal" onClick={(e) => e.stopPropagation()}>
        <header className="channel-browser-header">
          <div>
            <h2 className="channel-browser-title">Browse Channels</h2>
            <p className="channel-browser-subtitle">
              Explore and discover all public channels in <strong>{activeServer.name}</strong>
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </header>

        {/* Filter controls */}
        <div className="channel-browser-controls">
          <div className="channel-browser-search-wrap">
            <Search size={15} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="channel-browser-search-input"
              placeholder="Search channels by name or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="channel-browser-filters">
            {(['all', 'text', 'voice', 'stage', 'forum'] as const).map((t) => (
              <button
                key={t}
                className={`channel-filter-chip ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === 'all' ? 'All Channels' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Channels List */}
        <div className="channel-browser-list">
          {filteredChannels.length > 0 ? (
            filteredChannels.map((c) => {
              const isCurrent = activeChannel?.id === c.id;
              return (
                <div
                  key={c.id}
                  className={`channel-browser-row ${isCurrent ? 'current' : ''}`}
                  onClick={() => handleSelectChannel(c)}
                  role="button"
                >
                  <div className="channel-browser-row-left">
                    <div className="channel-browser-icon">{getChannelIcon(c.type)}</div>
                    <div className="channel-browser-row-info truncate">
                      <span className="channel-browser-name truncate">{c.name}</span>
                      <span className="channel-browser-topic truncate">
                        {c.topic || 'No channel topic set'}
                      </span>
                    </div>
                  </div>

                  <div className="channel-browser-row-right">
                    {isCurrent ? (
                      <span className="channel-current-tag">
                        <Check size={13} /> Current
                      </span>
                    ) : (
                      <button className="channel-join-btn">
                        <span>Go to</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="channel-browser-empty">
              No channels match your query.
            </div>
          )}
        </div>

        <footer className="channel-browser-footer">
          <button
            className="create-channel-inline-btn"
            onClick={() => {
              onClose();
              onOpenCreateChannel();
            }}
          >
            <Plus size={15} />
            <span>Create New Channel</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
