import React from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Message } from '../../types';
import {
  Smile,
  Reply,
  MessageSquare,
  Copy,
  Share2,
  Bookmark,
  BookmarkCheck,
  Link2,
  Edit3,
  Trash2,
  Check,
} from 'lucide-react';

interface MessageActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  isAuthor: boolean;
  isBookmarked: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onOpenThread?: () => void;
  onCopy: () => void;
  onCopyLink: () => void;
  onToggleBookmark: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '✨', '😂', '😮', '🎉', '🙏'];

export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  isOpen,
  onClose,
  message,
  isAuthor,
  isBookmarked,
  onReact,
  onReply,
  onOpenThread,
  onCopy,
  onCopyLink,
  onToggleBookmark,
  onStartEdit,
  onDelete,
}) => {
  if (!message) return null;

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Meetwo Message',
          text: message.content,
          url: `${window.location.origin}#msg-${message.id}`,
        });
        onClose();
        return;
      } catch (err) {
        // Fall back to copy
      }
    }
    onCopy();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="mobile-action-sheet-title truncate">
          <span>Message by <strong>{message.author?.displayName || message.author?.username || 'User'}</strong></span>
        </div>
      }
      maxHeight="70vh"
    >
      <div className="mobile-message-actions-wrap">
        {/* Quick Emoji Reaction Strip */}
        <div className="mobile-emoji-reaction-strip">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="mobile-emoji-btn"
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="mobile-sheet-divider" />

        {/* Primary Action Items */}
        <div className="mobile-action-list">
          <button
            type="button"
            className="mobile-action-item"
            onClick={() => {
              onReply();
              onClose();
            }}
          >
            <Reply size={19} className="mobile-action-icon" />
            <span>Reply</span>
          </button>

          {onOpenThread && (
            <button
              type="button"
              className="mobile-action-item"
              onClick={() => {
                onOpenThread();
                onClose();
              }}
            >
              <MessageSquare size={19} className="mobile-action-icon" />
              <span>Reply in Thread</span>
            </button>
          )}

          <button
            type="button"
            className="mobile-action-item"
            onClick={() => {
              onCopy();
              onClose();
            }}
          >
            <Copy size={19} className="mobile-action-icon" />
            <span>Copy Text</span>
          </button>

          <button
            type="button"
            className="mobile-action-item"
            onClick={handleShare}
          >
            <Share2 size={19} className="mobile-action-icon" />
            <span>Share Message</span>
          </button>

          <button
            type="button"
            className="mobile-action-item"
            onClick={() => {
              onToggleBookmark();
              onClose();
            }}
          >
            {isBookmarked ? (
              <BookmarkCheck size={19} className="mobile-action-icon active-bookmark" />
            ) : (
              <Bookmark size={19} className="mobile-action-icon" />
            )}
            <span>{isBookmarked ? 'Remove Bookmark' : 'Bookmark Message'}</span>
          </button>

          <button
            type="button"
            className="mobile-action-item"
            onClick={() => {
              onCopyLink();
              onClose();
            }}
          >
            <Link2 size={19} className="mobile-action-icon" />
            <span>Copy Link</span>
          </button>

          {isAuthor && (
            <>
              <div className="mobile-sheet-divider" />

              <button
                type="button"
                className="mobile-action-item"
                onClick={() => {
                  onStartEdit();
                  onClose();
                }}
              >
                <Edit3 size={19} className="mobile-action-icon" />
                <span>Edit Message</span>
              </button>

              <button
                type="button"
                className="mobile-action-item danger-item"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
              >
                <Trash2 size={19} className="mobile-action-icon" />
                <span>Delete Message</span>
              </button>
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
