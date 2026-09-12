import React, { useState } from 'react';
import { Message } from '../../types';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../app/providers/AuthContext';
import { MessageSquare, X, Send, CornerDownRight } from 'lucide-react';

interface ThreadDrawerProps {
  parentMessage: Message | null;
  isOpen: boolean;
  onClose: () => void;
}

interface ThreadReply {
  id: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  parentMessage,
  isOpen,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const [replies, setReplies] = useState<ThreadReply[]>([
    {
      id: 'trep-1',
      authorId: 'user-elena',
      authorName: 'Elena Rostova',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      content: 'This will keep the main room stream clean. Very helpful for technical discussions.',
      createdAt: '10 minutes ago',
    },
    {
      id: 'trep-2',
      authorId: 'user-alex',
      authorName: 'Alex Rivera',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      content: 'Agreed, thread replies keep context localized without notifying the whole channel.',
      createdAt: '4 minutes ago',
    },
  ]);
  const [newReply, setNewReply] = useState('');

  if (!isOpen || !parentMessage) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReply.trim() || !currentUser) return;

    const rep: ThreadReply = {
      id: `trep-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.displayName || currentUser.username,
      avatarUrl: currentUser.avatarUrl,
      content: newReply.trim(),
      createdAt: 'Just now',
    };

    setReplies((prev) => [...prev, rep]);
    setNewReply('');
  };

  return (
    <aside className="side-drawer" aria-label="Thread Conversation Drawer">
      {/* Header */}
      <div className="side-drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={18} style={{ color: 'var(--accent-light)' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Thread</h3>
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
              name={parentMessage.author?.displayName || 'User'}
              size={28}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {parentMessage.author?.displayName || parentMessage.author?.username}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(parentMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
            {parentMessage.content}
          </p>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0', color: 'var(--text-muted)', fontSize: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span>{replies.length} replies</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        {/* Thread Replies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {replies.map((rep) => (
            <div key={rep.id} className="drawer-card" style={{ background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Avatar src={rep.avatarUrl} name={rep.authorName} size={22} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{rep.authorName}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rep.createdAt}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {rep.content}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Reply Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Reply to thread..."
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            style={{ fontSize: 13 }}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!newReply.trim()} style={{ padding: '8px 14px' }}>
            <Send size={15} />
          </button>
        </form>
      </div>
    </aside>
  );
};
