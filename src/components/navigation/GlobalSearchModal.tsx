import React, { useState, useEffect } from 'react';
import { Search, Hash, MessageSquare, Calendar, User, X, Loader2 } from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { SearchService, DetailedSearchResult } from '../../lib/services/searchService';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const { channels, selectChannel, selectServer } = useServer();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [results, setResults] = useState<DetailedSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setFilterUser('');
      setFilterChannel('');
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!searchQuery.trim() && !filterUser.trim() && !filterChannel.trim()) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const accessibleIds = channels.map((c) => c.id);
        const searchResults = await SearchService.search(
          {
            query: searchQuery,
            fromUser: filterUser || undefined,
            inChannel: filterChannel || undefined,
          },
          accessibleIds
        );
        setResults(searchResults);
      } catch (err) {
        console.warn('[GlobalSearch] Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, searchQuery, filterUser, filterChannel, channels]);

  if (!isOpen) return null;

  const handleSelectResult = (result: DetailedSearchResult) => {
    if (result.serverId) {
      selectServer(result.serverId);
    }
    if (result.channelId) {
      selectChannel(result.channelId);
    }
    onClose();
  };

  const getChannelName = (channelId?: string) => {
    const ch = channels.find((c) => c.id === channelId);
    return ch?.name || 'general';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0 }}>Search Messages & Discussions</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close search">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Main search input */}
          <div className="input-group">
            <input
              type="text"
              className="input-field"
              placeholder="Search keyword... (e.g. WebRTC, architecture, release)"
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
                placeholder="from: (author name)"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="input-field"
                style={{ fontSize: 12, padding: '6px 10px' }}
                placeholder="in: (channel name)"
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
              />
            </div>
          </div>

          {/* Results count & status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            <span>
              {searchQuery.trim() || filterUser.trim() || filterChannel.trim()
                ? `Found ${results.length} result${results.length !== 1 ? 's' : ''}`
                : 'Type to search across channels, forums, and messages'}
            </span>
            {isSearching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                <Loader2 size={12} className="spin" />
                <span>Searching...</span>
              </div>
            )}
          </div>

          {/* Results Scroll Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
            {results.length === 0 && !isSearching && (searchQuery.trim() || filterUser.trim() || filterChannel.trim()) ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                No messages match your search criteria.
              </div>
            ) : (
              results.map((res) => (
                <div
                  key={`${res.type}-${res.id}`}
                  onClick={() => handleSelectResult(res)}
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
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {getChannelName(res.channelId)}
                      </span>
                      <span style={{ color: 'var(--text-dim)' }}>•</span>
                      <span style={{ color: 'var(--accent)' }}>
                        {res.authorName || res.title || 'User'}
                      </span>
                    </div>
                    {res.timestamp && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(res.timestamp).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, wordBreak: 'break-word' }}>
                    {res.messageContent || res.subtitle}
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

