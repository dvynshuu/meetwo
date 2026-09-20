import React, { useEffect, useRef } from 'react';
import { Pin, X, CornerDownRight, Trash2 } from 'lucide-react';
import { useChat } from '../../app/providers/ChatContext';
import { useServer } from '../../app/providers/ServerContext';
import { Avatar } from '../ui/Avatar';
import { Message } from '../../types';

interface PinnedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}

export const PinnedMessagesModal: React.FC<PinnedMessagesModalProps> = ({
  isOpen,
  onClose,
  onJumpToMessage,
}) => {
  const { messages, togglePin } = useChat();
  const { activeChannel } = useServer();
  const panelRef = useRef<HTMLDivElement>(null);

  const pinnedMessages = messages.filter((m) => m.isPinned);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatShortDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="pinned-messages-popover" ref={panelRef} role="dialog" aria-label="Pinned Messages">
      {/* Header */}
      <div className="pinned-popover-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Pin size={15} style={{ color: 'var(--accent)', transform: 'rotate(45deg)' }} />
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Pinned Messages
          </h3>
          {activeChannel && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              #{activeChannel.name}
            </span>
          )}
        </div>
        <button
          className="icon-btn"
          style={{ width: 22, height: 22 }}
          onClick={onClose}
          aria-label="Close pinned messages"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="pinned-popover-body">
        {pinnedMessages.length === 0 ? (
          <div className="pinned-empty-state">
            <div className="pinned-empty-icon">
              <Pin size={24} style={{ color: 'var(--text-muted)', transform: 'rotate(45deg)' }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
              No pinned messages yet
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, textAlign: 'center', maxWidth: 240 }}>
              Important messages can be pinned here for easy reference by everyone in this channel.
            </p>
          </div>
        ) : (
          <div className="pinned-messages-list">
            {pinnedMessages.map((msg) => {
              const authorName = msg.author?.displayName || msg.author?.username || 'User';

              return (
                <div key={msg.id} className="pinned-message-card">
                  <div className="pinned-card-header">
                    <Avatar
                      src={msg.author?.avatarUrl}
                      name={authorName}
                      size={24}
                      status={msg.author?.status}
                    />
                    <span className="pinned-card-author truncate">{authorName}</span>
                    <span className="pinned-card-date">{formatShortDate(msg.createdAt)}</span>
                    <button
                      className="pinned-unpin-btn"
                      onClick={() => togglePin(msg.id)}
                      title="Unpin message"
                      aria-label="Unpin"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="pinned-card-content">
                    {msg.content}
                  </div>

                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="pinned-card-attachments">
                      {msg.attachments.map((att) => (
                        <span key={att.id} className="pinned-att-pill">
                          📎 {att.fileName}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pinned-card-footer">
                    <button
                      className="pinned-jump-btn"
                      onClick={() => {
                        onJumpToMessage(msg.id);
                        onClose();
                      }}
                    >
                      <CornerDownRight size={12} />
                      <span>Jump</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
