import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Plus, Smile, X, CornerDownRight, File, Loader2, AtSign } from 'lucide-react';
import { useChat } from '../../app/providers/ChatContext';
import { usePresence } from '../../app/providers/PresenceContext';
import { useServer } from '../../app/providers/ServerContext';
import { useAuth } from '../../app/providers/AuthContext';
import { StorageService } from '../../lib/services/storageService';
import { Attachment, ServerMember } from '../../types';
import { useViewport } from '../../lib/hooks/useViewport';
import { Tooltip } from '../ui/Tooltip';
import { Avatar } from '../ui/Avatar';
import { soundEffects } from '../../lib/utils/soundEffects';

export const MessageComposer: React.FC = () => {
  const { sendMessage, replyingTo, setReplyingTo } = useChat();
  const { sendTyping } = usePresence();
  const { activeChannel, members } = useServer();
  const { currentUser } = useAuth();
  const { isMobile } = useViewport();

  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Autocomplete @mention states
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingTimeRef = useRef<number>(0);
  const mentionPopoverRef = useRef<HTMLDivElement>(null);

  // Auto focus when channel changes ONLY on desktop
  useEffect(() => {
    if (!isMobile && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeChannel?.id, isMobile]);

  // Compute matching members for @mention autocomplete
  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter((m) => {
        const u = m.user;
        if (!u) return false;
        return (
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [mentionQuery, members]);

  // Unified file upload processor
  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    const uId = currentUser?.id || 'demo-user';

    try {
      const uploadedList: Attachment[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
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
  }, [currentUser?.id]);

  const handleSend = useCallback(() => {
    if (!content.trim() && attachments.length === 0) return;
    if (isUploading) return;

    sendMessage(
      content,
      replyingTo ? replyingTo.id : null,
      attachments.length > 0 ? attachments : undefined
    );

    soundEffects.playMessageSent();

    setContent('');
    setAttachments([]);
    setUploadError(null);
    setMentionQuery(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, attachments, replyingTo, sendMessage, isUploading]);

  // Check for @mention trigger
  const checkForMention = (text: string, cursorPos: number) => {
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_\-\.]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = useCallback((member: ServerMember) => {
    if (!member.user) return;
    const username = member.user.username;
    const cursorPos = textareaRef.current?.selectionStart ?? content.length;
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);

    const replacedBefore = textBefore.replace(/(?:^|\s)@([a-zA-Z0-9_\-\.]*)$/, (matched) => {
      return matched.startsWith(' ') ? ` @${username} ` : `@${username} `;
    });

    const updatedContent = replacedBefore + textAfter;
    setContent(updatedContent);
    setMentionQuery(null);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = replacedBefore.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    checkForMention(val, e.target.selectionStart || val.length);

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

  // Clipboard paste handling (images, screenshots, files)
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardFiles = e.clipboardData.files;
    if (clipboardFiles && clipboardFiles.length > 0) {
      e.preventDefault();
      uploadFiles(clipboardFiles);
    }
  }, [uploadFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const emojiList = [
    '😀', '😂', '🤣', '😍', '🥰', '😎', '🥳', '🤔',
    '👍', '👎', '👏', '🙌', '🔥', '✨', '🎉', '🚀',
    '❤️', '💜', '💙', '⭐', '💯', '👀', '💡', '💬'
  ];

  const handleEmojiSelect = (emoji: string) => {
    setContent((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (mentionPopoverRef.current && !mentionPopoverRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

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

      <div
        className={`composer-box ${isDraggingOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Discord-style @Mention Autocomplete Popover */}
        {filteredMembers.length > 0 && (
          <div className="composer-mention-popover" ref={mentionPopoverRef} role="listbox">
            <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
              MEMBERS MATCHING @{mentionQuery}
            </div>
            {filteredMembers.map((m, idx) => {
              const u = m.user!;
              const isSelected = idx === mentionIndex;
              return (
                <button
                  key={m.userId}
                  type="button"
                  className={`mention-popover-item ${isSelected ? 'active' : ''}`}
                  onClick={() => selectMention(m)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <Avatar src={u.avatarUrl} name={u.displayName || u.username} size={22} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                    <span className="mention-popover-name truncate">{u.displayName || u.username}</span>
                    <span className="mention-popover-tag truncate">@{u.username}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Discord-style Circular Plus Attachment Button */}
        <Tooltip content="Attach File or Media" position="top">
          <button
            type="button"
            className="composer-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload Attachment"
          >
            <Plus size={16} />
          </button>
        </Tooltip>

        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Type a message...'}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
        />

        <div className="composer-actions">
          {/* Emoji Picker Popover */}
          <div style={{ position: 'relative' }} ref={emojiPickerRef}>
            <Tooltip content="Select Emoji" position="top">
              <button
                type="button"
                className={`composer-emoji-btn ${showEmojiPicker ? 'active' : ''}`}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                aria-label="Choose Emoji"
              >
                <Smile size={18} />
              </button>
            </Tooltip>

            {showEmojiPicker && (
              <div className="composer-emoji-popover">
                <div className="emoji-popover-grid">
                  {emojiList.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-popover-item"
                      onClick={() => {
                        handleEmojiSelect(emoji);
                        setShowEmojiPicker(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Tooltip content="Send Message (Enter)" position="top">
            <button
              type="button"
              className={`composer-send-btn ${content.trim() || attachments.length > 0 ? 'active' : ''}`}
              onClick={handleSend}
              disabled={!content.trim() && attachments.length === 0}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
