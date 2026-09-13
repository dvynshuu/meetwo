import React, { useState, useEffect } from 'react';
import { Message } from '../../types';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../app/providers/AuthContext';
import { ThreadService, ThreadReply } from '../../lib/services/threadService';
import { MessageSquare, X, Send, CornerDownRight } from 'lucide-react';

interface ThreadDrawerProps {
  parentMessage: Message | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  parentMessage,
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [newReply, setNewReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real thread replies from ThreadService
  useEffect(() => {
    if (!isOpen || !parentMessage) return;

    let isMounted = true;
    setIsLoading(true);

    ThreadService.getThreadReplies(parentMessage.id, parentMessage.channelId).then((data) => {
      if (isMounted) {
        setReplies(data);
        setIsLoading(false);
      }
    });

    // Realtime subscription for incoming replies
    const unsubscribe = ThreadService.subscribeToThread(parentMessage.id, (incomingReply) => {
      if (isMounted) {
        setReplies((prev) => {
          if (prev.some((r) => r.id === incomingReply.id)) return prev;
          return [...prev, incomingReply];
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen, parentMessage?.id]);

  if (!isOpen || !parentMessage) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReply.trim() || !currentUser) return;

    const content = newReply.trim();
    setNewReply('');

    try {
      const savedReply = await ThreadService.sendThreadReply(
        parentMessage.id,
        parentMessage.channelId,
        currentUser,
        content
      );

      setReplies((prev) => {
        if (prev.some((r) => r.id === savedReply.id)) return prev;
        return [...prev, savedReply];
      });
    } catch (err) {
      console.error('[ThreadDrawer] Send reply error:', err);
    }
  };

  return (
    <aside className="side-drawer" aria-label="Thread Conversation Drawer">
      {/* Header */}
      <div className="side-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={18} style={{ color: 'var(--accent-light)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Thread</h3>
          {replies.length > 0 && <span className="side-drawer-badge">{replies.length}</span>}
        </div>
        <button className="icon-btn" onClick={onClose} title="Close Thread">
          <X size={18} />
        </button>
      </div>

      <div className="side-drawer-content">
        {/* Parent Message Card */}
        <div className="drawer-card thread-parent-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Avatar
              src={parentMessage.author?.avatarUrl}
              name={parentMessage.author?.displayName || parentMessage.author?.username || 'User'}
              size={24}
            />
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {parentMessage.author?.displayName || parentMessage.author?.username || 'User'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(parentMessage.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.45 }}>
            {parentMessage.content}
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: '8px 0 4px 0',
          }}
        >
          <span>Replies ({replies.length})</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Thread Replies */}
        {isLoading && replies.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            Loading thread replies...
          </div>
        ) : replies.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            <CornerDownRight size={28} style={{ opacity: 0.3, margin: '0 auto 8px auto' }} />
            <p style={{ fontSize: 12, margin: 0 }}>No replies yet. Start the conversation!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {replies.map((r) => (
              <div key={r.id} className="drawer-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Avatar src={r.avatarUrl} name={r.authorName} size={20} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{r.authorName}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.createdAt}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {r.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply Input Footer */}
      <footer className="side-drawer-footer">
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, width: '100%' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Reply to thread..."
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            style={{ fontSize: 13, padding: '8px 12px' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0 14px', borderRadius: 'var(--radius-sm)' }}
            disabled={!newReply.trim()}
          >
            <Send size={14} />
          </button>
        </form>
      </footer>
    </aside>
  );
};
