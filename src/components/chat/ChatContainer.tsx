import React, { useRef, useEffect, useState } from 'react';
import { Hash, Pin } from 'lucide-react';
import { useChat } from '../../app/providers/ChatContext';
import { useServer } from '../../app/providers/ServerContext';
import { MessageItem } from './MessageItem';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { ThreadDrawer } from './ThreadDrawer';
import { Message } from '../../types';

interface ChatContainerProps {
  onOpenThreadMessage?: (message: Message) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = () => {
  const { messages } = useChat();
  const { activeChannel } = useServer();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessagesBelow, setHasNewMessagesBelow] = useState(false);
  const prevMessageCountRef = useRef(messages.length);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(nearBottom);
    if (nearBottom) {
      setHasNewMessagesBelow(false);
    }
  };

  // Only auto-scroll to bottom on new messages IF the user was already near the bottom
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      if (isAtBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setHasNewMessagesBelow(false);
      } else {
        setHasNewMessagesBelow(true);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewMessagesBelow(false);
  };

  const pinnedMessage = messages.find((m) => m.isPinned);

  const handleJumpToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-pulse');
      setTimeout(() => el.classList.remove('highlight-pulse'), 2000);
    }
  };

  if (!activeChannel) {
    return (
      <div className="chat-pane" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Select a channel to begin chatting</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      <div className="chat-pane">
        {/* Pinned Message Banner */}
        {pinnedMessage && (
          <div
            className="pinned-message-banner"
            onClick={() => handleJumpToMessage(pinnedMessage.id)}
            title="Click to jump to pinned message"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <Pin size={13} style={{ color: 'var(--warning)', transform: 'rotate(45deg)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                Pinned:
              </span>
              <span className="truncate" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {pinnedMessage.author?.displayName || 'User'}: {pinnedMessage.content}
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
              Jump
            </span>
          </div>
        )}

        <div className="chat-messages-container" ref={containerRef} onScroll={handleScroll}>
          {/* Channel Start Banner / Editorial Welcome */}
          <div className="messages-empty-state">
            <div className="messages-empty-hash">
              <Hash size={28} />
            </div>
            <h2>Welcome to #{activeChannel.name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
              This is the beginning of the #{activeChannel.name} channel.
              {activeChannel.topic ? ` ${activeChannel.topic}` : ''}
            </p>
          </div>

          {/* Messages List */}
          {messages.map((message, index) => {
            const prev = messages[index - 1];
            const isSameAuthor = prev && prev.authorId === message.authorId;
            const isWithin5Min =
              prev &&
              Math.abs(
                new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime()
              ) < 300000;
            const isGrouped = Boolean(isSameAuthor && isWithin5Min);

            return (
              <MessageItem
                key={message.id}
                message={message}
                isGrouped={isGrouped}
                channelName={activeChannel.name}
                onOpenThread={(msg) => setActiveThreadMessage(msg)}
              />
            );
          })}

          <div ref={bottomRef} style={{ height: 1 }} />
        </div>

        {/* Floating New Messages Button */}
        {hasNewMessagesBelow && (
          <button
            type="button"
            className="mobile-new-messages-pill"
            onClick={scrollToBottom}
            aria-label="Scroll to new messages"
          >
            <span>New messages</span>
            <span className="arrow">↓</span>
          </button>
        )}

        <TypingIndicator />
        <MessageComposer />
      </div>

      {/* Thread Drawer (side-by-side) */}
      <ThreadDrawer
        parentMessage={activeThreadMessage}
        isOpen={Boolean(activeThreadMessage)}
        onClose={() => setActiveThreadMessage(null)}
      />
    </div>
  );
};
