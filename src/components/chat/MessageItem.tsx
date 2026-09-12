import React, { useState } from 'react';
import { Message } from '../../types';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '../../app/providers/AuthContext';
import { useChat } from '../../app/providers/ChatContext';
import { mockStore } from '../../lib/supabase/mockStore';
import { Smile, Reply, Edit2, Trash2, Copy, Check, CornerDownRight, FileText, Download, Star, MessageSquare } from 'lucide-react';

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  channelName?: string;
  onOpenThread?: (message: Message) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, isGrouped, channelName = 'general', onOpenThread }) => {
  const { currentUser } = useAuth();
  const { toggleReaction, editMessage, deleteMessage, setReplyingTo } = useChat();

  const [isBookmarked, setIsBookmarked] = useState(
    mockStore.getBookmarks().some((b) => b.messageId === message.id)
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isAuthor = currentUser?.id === message.authorId;
  const authorName = message.author?.displayName || message.author?.username || 'User';

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return isToday ? `Today at ${timeStr}` : `${date.toLocaleDateString()} ${timeStr}`;
    } catch {
      return '';
    }
  };

  const formatShortTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    await editMessage(message.id, editContent.trim());
    setIsEditing(false);
  };

  // Helper to render markdown and @mentions
  const renderFormattedContent = (content: string) => {
    // Code block check
    if (content.startsWith('```') && content.endsWith('```')) {
      const code = content.slice(3, -3).trim();
      return (
        <pre className="message-code-block">
          <code>{code}</code>
        </pre>
      );
    }

    // Split words to highlight mentions and inline code
    const parts = content.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="mention-tag">
            {part}
          </span>
        );
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code key={i} className="inline-code">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="message-link">
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const commonEmojis = ['👍', '❤️', '🔥', '😂', '🎉', '🚀', '👀'];

  return (
    <div className={`message-item-container ${isGrouped ? 'grouped-msg' : ''}`} id={`message-${message.id}`}>
      {/* Floating Actions Toolbar on Hover (Level 4 Overlay) */}
      <div className="message-hover-actions">
        <button
          className="action-pill-btn"
          title="Add Reaction"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile size={15} />
        </button>

        <button
          className="action-pill-btn"
          title="Reply"
          onClick={() => setReplyingTo(message)}
        >
          <Reply size={15} />
        </button>

        {onOpenThread && (
          <button
            className="action-pill-btn"
            title="Start Thread"
            onClick={() => onOpenThread(message)}
          >
            <MessageSquare size={15} />
          </button>
        )}

        <button
          className={`action-pill-btn ${isBookmarked ? 'active' : ''}`}
          title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Message'}
          onClick={() => {
            const added = mockStore.toggleBookmark(message, channelName);
            setIsBookmarked(added);
          }}
        >
          <Star
            size={15}
            style={{
              color: isBookmarked ? 'var(--warning)' : 'inherit',
              fill: isBookmarked ? 'var(--warning)' : 'none',
            }}
          />
        </button>

        <button className="action-pill-btn" title="Copy Text" onClick={handleCopy}>
          {copied ? <Check size={15} style={{ color: 'var(--status-online)' }} /> : <Copy size={15} />}
        </button>

        {isAuthor && (
          <>
            <button
              className="action-pill-btn"
              title="Edit Message"
              onClick={() => {
                setIsEditing(true);
                setEditContent(message.content);
              }}
            >
              <Edit2 size={15} />
            </button>

            <button
              className="action-pill-btn delete-action"
              title="Delete Message"
              onClick={() => deleteMessage(message.id)}
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="emoji-reaction-popover" onMouseLeave={() => setShowEmojiPicker(false)}>
          {commonEmojis.map((emoji) => (
            <button
              key={emoji}
              className="emoji-popover-item"
              onClick={() => {
                toggleReaction(message.id, emoji);
                setShowEmojiPicker(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Quoted Reply Reference Banner */}
      {message.replyTo && (
        <div className="reply-reference-banner">
          <CornerDownRight size={12} style={{ color: 'var(--text-muted)' }} />
          <span className="reply-author">@{message.replyTo.authorName}</span>
          <span className="reply-snippet truncate">{message.replyTo.content}</span>
        </div>
      )}

      <div className={`message-item ${isGrouped ? 'grouped' : ''}`}>
        {!isGrouped ? (
          <div className="message-avatar">
            <Avatar
              src={message.author?.avatarUrl}
              name={authorName}
              size={36}
              status={message.author?.status}
              showStatus={false}
            />
          </div>
        ) : (
          <span className="grouped-timestamp">{formatShortTime(message.createdAt)}</span>
        )}

        <div className="message-content-wrap">
          {!isGrouped && (
            <div className="message-meta">
              <span className="message-author">{authorName}</span>
              <span className="message-timestamp">{formatTime(message.createdAt)}</span>
              {message.isPinned && (
                <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--warning-surface)', color: 'var(--warning)', padding: '1px 5px', borderRadius: 'var(--radius-xs)' }}>
                  PINNED
                </span>
              )}
              {isBookmarked && (
                <span title="Bookmarked" style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center' }}>
                  <Star size={11} fill="currentColor" />
                </span>
              )}
              {message.isEdited && <span className="message-edited-tag">(edited)</span>}
              {message.isOptimistic && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(sending...)</span>
              )}
            </div>
          )}

          {/* Edit Form or Message Body */}
          {isEditing ? (
            <div className="inline-edit-box">
              <textarea
                className="input-field"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                  }
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  escape to <button onClick={() => setIsEditing(false)} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>cancel</button> • enter to <button onClick={handleSaveEdit} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>save</button>
                </span>
              </div>
            </div>
          ) : (
            <div className="message-text">
              {renderFormattedContent(message.content)}
              {isGrouped && message.isEdited && (
                <span className="message-edited-tag" style={{ marginLeft: 6 }}>(edited)</span>
              )}
            </div>
          )}

          {/* Attachments rendering */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="message-attachments-container">
              {message.attachments.map((att) => (
                <div key={att.id} className="attachment-card">
                  {att.contentType.startsWith('image/') ? (
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="attachment-img-preview"
                      onClick={() => window.open(att.fileUrl, '_blank')}
                    />
                  ) : (
                    <div className="attachment-file-box">
                      <FileText size={24} style={{ color: 'var(--accent)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{att.fileName}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {(att.fileSize / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <a
                        href={att.fileUrl}
                        download={att.fileName}
                        className="icon-btn"
                        title="Download"
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Reactions Row */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="message-reactions-row">
              {message.reactions.map((r) => {
                const hasReacted = currentUser ? r.userIds.includes(currentUser.id) : false;
                return (
                  <button
                    key={r.emoji}
                    className={`reaction-pill ${hasReacted ? 'user-reacted' : ''}`}
                    onClick={() => toggleReaction(message.id, r.emoji)}
                    title={`${r.count} reaction${r.count > 1 ? 's' : ''}`}
                  >
                    <span className="reaction-emoji">{r.emoji}</span>
                    <span className="reaction-count">{r.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
