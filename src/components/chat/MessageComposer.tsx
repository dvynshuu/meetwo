import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, CornerDownRight, File, Loader2 } from 'lucide-react';
import { useChat } from '../../app/providers/ChatContext';
import { usePresence } from '../../app/providers/PresenceContext';
import { useServer } from '../../app/providers/ServerContext';
import { useAuth } from '../../app/providers/AuthContext';
import { StorageService } from '../../lib/services/storageService';
import { Attachment } from '../../types';

export const MessageComposer: React.FC = () => {
  const { sendMessage, replyingTo, setReplyingTo } = useChat();
  const { sendTyping } = usePresence();
  const { activeChannel } = useServer();
  const { currentUser } = useAuth();

  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingTimeRef = useRef<number>(0);

  // Auto focus when channel changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeChannel?.id]);

  const handleSend = useCallback(() => {
    if (!content.trim() && attachments.length === 0) return;
    if (isUploading) return;

    sendMessage(
      content,
      replyingTo ? replyingTo.id : null,
      attachments.length > 0 ? attachments : undefined
    );

    setContent('');
    setAttachments([]);
    setUploadError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, attachments, replyingTo, sendMessage, isUploading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Auto-expand height
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;

    // Debounced typing indicator
    const now = Date.now();
    if (activeChannel && now - lastTypingTimeRef.current > 2000) {
      lastTypingTimeRef.current = now;
      sendTyping(activeChannel.id);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    const uId = currentUser?.id || 'demo-user';

    try {
      const uploadedList: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await StorageService.uploadAttachment(file, uId);
        uploadedList.push(uploaded);
      }
      setAttachments((prev) => [...prev, ...uploadedList]);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const addEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    if (textareaRef.current) textareaRef.current.focus();
  };

  return (
    <div className="composer-container">
      {/* Active Reply Banner */}
      {replyingTo && (
        <div className="composer-reply-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CornerDownRight size={13} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Replying to <strong style={{ color: 'var(--text-primary)' }}>
                @{replyingTo.author?.displayName || replyingTo.author?.username || 'User'}
              </strong>:
            </span>
            <span className="truncate" style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 260 }}>
              {replyingTo.content}
            </span>
          </div>
          <button
            className="icon-btn"
            style={{ width: 20, height: 20 }}
            onClick={() => setReplyingTo(null)}
            title="Cancel Reply"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="composer-attachment-previews">
          {attachments.map((att) => (
            <div key={att.id} className="composer-attachment-pill">
              {att.contentType.startsWith('image/') ? (
                <img src={att.fileUrl} alt={att.fileName} style={{ width: 26, height: 26, borderRadius: 'var(--radius-xs)', objectFit: 'cover' }} />
              ) : (
                <File size={14} style={{ color: 'var(--accent)' }} />
              )}
              <span className="truncate" style={{ fontSize: 12, maxWidth: 140 }}>
                {att.fileName}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                style={{ cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isUploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', fontSize: 12, color: 'var(--accent)' }}>
          <Loader2 size={13} className="animate-spin" />
          <span>Uploading attachment to secure storage...</span>
        </div>
      )}

      {uploadError && (
        <div style={{ padding: '4px 12px', fontSize: 12, color: 'var(--danger)' }}>
          {uploadError}
        </div>
      )}

      <div className="composer-box">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Attachment Button */}
        <button
          type="button"
          className="icon-btn"
          style={{ width: 30, height: 30 }}
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          aria-label="Upload Attachment"
        >
          <Paperclip size={16} />
        </button>

        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Type a message...'}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <div className="composer-actions">
          {/* Quick Emojis */}
          <button
            type="button"
            className="composer-emoji-btn"
            onClick={() => addEmoji('👍')}
            title="Thumbs Up"
          >
            👍
          </button>
          <button
            type="button"
            className="composer-emoji-btn"
            onClick={() => addEmoji('🔥')}
            title="Fire"
          >
            🔥
          </button>
          <button
            type="button"
            className="composer-emoji-btn"
            onClick={() => addEmoji('✨')}
            title="Sparkles"
          >
            ✨
          </button>

          <button
            type="button"
            className={`composer-send-btn ${content.trim() || attachments.length > 0 ? 'active' : ''}`}
            onClick={handleSend}
            disabled={!content.trim() && attachments.length === 0}
            title="Send (Enter)"
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
