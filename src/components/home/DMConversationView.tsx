import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Phone, Video as VideoIcon, User as UserIcon, MoreVertical } from 'lucide-react';
import { useDM } from '../../app/providers/DMContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { User } from '../../types';

interface DMConversationViewProps {
  conversationId: string;
}

export const DMConversationView: React.FC<DMConversationViewProps> = ({ conversationId }) => {
  const { currentUser } = useAuth();
  const { conversations, dmMessages, sendDM } = useDM();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const otherUser: User | undefined =
    conversation?.participants.find((p) => p.id !== currentUser?.id) || conversation?.participants[0];

  const messages = dmMessages[conversationId] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, conversationId]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    sendDM(conversationId, inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation || !otherUser) {
    return (
      <div className="dm-empty-state">
        <p>Select a direct message to start chatting</p>
      </div>
    );
  }

  return (
    <div className="dm-chat-container">
      {/* DM Top Header */}
      <header className="dm-chat-header">
        <div className="dm-header-user-info">
          <Avatar
            src={otherUser.avatarUrl}
            name={otherUser.displayName || otherUser.username}
            size={34}
            status={otherUser.status}
            showStatus={true}
          />
          <div className="dm-header-meta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="dm-header-name">{otherUser.displayName || otherUser.username}</span>
              <span className="dm-header-handle">@{otherUser.username}</span>
            </div>
            {otherUser.customStatus?.text && (
              <span className="dm-header-status-text">
                {otherUser.customStatus.emoji} {otherUser.customStatus.text}
              </span>
            )}
          </div>
        </div>

        <div className="dm-header-actions">
          <Tooltip content="Direct voice calls in Meetwo are hosted in community channels">
            <button className="icon-btn" aria-label="Voice Call">
              <Phone size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Profile details">
            <button className="icon-btn" aria-label="Profile">
              <UserIcon size={16} />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="dm-messages-scroll">
        {/* Beginning of conversation banner */}
        <div className="dm-start-banner">
          <Avatar
            src={otherUser.avatarUrl}
            name={otherUser.displayName || otherUser.username}
            size={68}
            status={otherUser.status}
            showStatus={true}
          />
          <h2 className="dm-start-title">{otherUser.displayName || otherUser.username}</h2>
          <p className="dm-start-sub">
            This is the start of your direct message history with <strong>@{otherUser.username}</strong>.
          </p>
        </div>

        <div className="dm-messages-list">
          {messages.map((msg, idx) => {
            const isMe = msg.authorId === currentUser?.id;
            const author = msg.author || (isMe ? currentUser : otherUser);
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={msg.id} className="dm-message-row">
                <Avatar
                  src={author?.avatarUrl}
                  name={author?.displayName || author?.username || 'User'}
                  size={36}
                  status={author?.status}
                  showStatus={false}
                />
                <div className="dm-message-content">
                  <div className="dm-message-meta">
                    <span className="dm-message-author">{author?.displayName || author?.username}</span>
                    <span className="dm-message-time">{timeStr}</span>
                  </div>
                  <div className="dm-message-body">{msg.content}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Composer Footer */}
      <footer className="dm-composer-footer">
        <form onSubmit={handleSend} className="dm-composer-form">
          <textarea
            className="dm-composer-input"
            rows={1}
            placeholder={`Message @${otherUser.displayName || otherUser.username}`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            type="submit"
            className="dm-send-btn"
            disabled={!inputText.trim()}
            title="Send Message (Enter)"
            aria-label="Send Message"
          >
            <Send size={16} />
          </button>
        </form>
      </footer>
    </div>
  );
};
