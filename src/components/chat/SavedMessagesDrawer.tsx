import React, { useState, useEffect } from 'react';
import { Bookmark as BookmarkType } from '../../types';
import { BookmarkService } from '../../lib/services/bookmarkService';
import { useAuth } from '../../app/providers/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Bookmark, Star, X, Trash2, ArrowUpRight } from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';

interface SavedMessagesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage?: (channelId: string, messageId: string) => void;
}

export const SavedMessagesDrawer: React.FC<SavedMessagesDrawerProps> = ({
  isOpen,
  onClose,
  onJumpToMessage,
}) => {
  const { selectChannel, selectServer, channels } = useServer();
  const { currentUser } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadBookmarks = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const data = await BookmarkService.getBookmarks(currentUser.id);
      setBookmarks(data);
    } catch (err) {
      console.error('[SavedMessagesDrawer] Error loading bookmarks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBookmarks();
    }
  }, [isOpen, currentUser?.id]);

  if (!isOpen) return null;

  const handleRemove = async (b: BookmarkType) => {
    if (!currentUser) return;
    await BookmarkService.toggleBookmark(currentUser.id, b.message, b.channelName);
    setBookmarks((prev) => prev.filter((item) => item.id !== b.id));
  };

  const handleJump = (b: BookmarkType) => {
    if (b.message.channelId) {
      const targetChan = channels.find((c) => c.id === b.message.channelId);
      if (targetChan) {
        selectServer(targetChan.serverId);
      }
      selectChannel(b.message.channelId);
    }
    if (onJumpToMessage && b.message.channelId) {
      onJumpToMessage(b.message.channelId, b.message.id);
    }
    onClose();
  };

  return (
    <aside className="side-drawer" aria-label="Saved Messages Drawer">
      <div className="side-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={18} style={{ color: 'var(--warning)', fill: 'var(--warning)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Saved Messages</h3>
          <span className="side-drawer-badge">{bookmarks.length}</span>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close">
          <X size={18} />
        </button>
      </div>

      <div className="side-drawer-content">
        {isLoading && bookmarks.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            Loading saved messages...
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="side-drawer-empty">
            <Bookmark size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <h4>No saved messages</h4>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Hover over any chat message and click the Star icon to bookmark it for later reference.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bookmarks.map((bm) => (
              <div key={bm.id} className="drawer-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="drawer-channel-tag">#{bm.channelName}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="icon-btn"
                      style={{ width: 26, height: 26 }}
                      onClick={() => handleJump(bm)}
                      title="Jump to message in chat"
                    >
                      <ArrowUpRight size={14} />
                    </button>
                    <button
                      className="icon-btn"
                      style={{ width: 26, height: 26, color: 'var(--danger)' }}
                      onClick={() => handleRemove(bm)}
                      title="Remove bookmark"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Avatar
                    src={bm.message.author?.avatarUrl}
                    name={bm.message.author?.displayName || 'User'}
                    size={22}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {bm.message.author?.displayName || 'Member'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(bm.message.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  {bm.message.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
