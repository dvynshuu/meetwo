import React, { useState } from 'react';
import { Search, Hash, MessageSquare, Calendar, User, X } from 'lucide-react';
import { useChat } from '../../app/providers/ChatContext';
import { useServer } from '../../app/providers/ServerContext';
import { mockStore } from '../../lib/supabase/mockStore';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const { channels, selectChannel } = useServer();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterChannel, setFilterChannel] = useState('');

  if (!isOpen) return null;

  // Retrieve messages across channels from mock store / state
  const allChannels = channels;
  let allFoundMessages: any[] = [];

  allChannels.forEach((ch) => {
    const msgs = mockStore.getMessages(ch.id);
    msgs.forEach((m) => {
      allFoundMessages.push({ ...m, channelName: ch.name });
    });
  });

  const filteredMessages = allFoundMessages.filter((m) => {
    const matchesQuery = searchQuery.trim()
      ? m.content.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesUser = filterUser.trim()
      ? (m.author?.displayName || m.author?.username || '').toLowerCase().includes(filterUser.toLowerCase())
      : true;
    const matchesChannel = filterChannel.trim()
      ? m.channelName.toLowerCase().includes(filterChannel.toLowerCase())
      : true;

    return matchesQuery && matchesUser && matchesChannel;
  });

  const handleSelectResult = (channelId: string) => {
    selectChannel(channelId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 620, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={20} style={{ color: 'var(--accent-light)' }} />
            <h3>Search Messages & Conversations</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Main search input */}
          <div className="input-group">
            <input
              type="text"
              className="input-field"
              placeholder="Search keyword... (e.g. WebRTC, screen share, architecture)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Quick Filters */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="input-field"
                style={{ fontSize: 12, padding: '6px 10px' }}
                placeholder="from: (username)"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="input-field"
                style={{ fontSize: 12, padding: '6px 10px' }}
                placeholder="in: (channel)"
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
              />
            </div>
          </div>

          {/* Results count */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Found {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
          </div>

          {/* Results Scroll Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
            {filteredMessages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                No messages match your search criteria.
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleSelectResult(msg.channelId)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <Hash size={13} style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{msg.channelName}</span>
                      <span style={{ color: 'var(--text-dim)' }}>•</span>
                      <span style={{ color: 'var(--accent-light)' }}>
                        {msg.author?.displayName || msg.author?.username || 'User'}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                    {msg.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
