import React, { useState } from 'react';
import { useDM } from '../../app/providers/DMContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Avatar } from '../ui/Avatar';
import { Plus, Search, MessageSquarePlus, Clock, Sparkles } from 'lucide-react';
import { User } from '../../types';

interface MobileDMListProps {
  onStartNewDM: () => void;
}

export const MobileDMList: React.FC<MobileDMListProps> = ({ onStartNewDM }) => {
  const { currentUser } = useAuth();
  const { conversations, selectConversation, dmMessages } = useDM();
  const [searchQuery, setSearchQuery] = useState('');

  const getOtherParticipant = (participants: User[]): User | undefined => {
    return participants.find((p) => p.id !== currentUser?.id) || participants[0];
  };

  const filteredConversations = conversations.filter((c) => {
    const other = getOtherParticipant(c.participants);
    if (!other) return false;
    const name = other.displayName || other.username;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatLastActivity = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffDays === 1) {
        return 'Yesterday';
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="mobile-dm-list-container">
      {/* Search and New DM Bar */}
      <div className="mobile-dm-search-bar">
        <div className="mobile-dm-search-input-wrap">
          <Search size={16} className="mobile-dm-search-icon" />
          <input
            type="text"
            className="mobile-dm-search-input"
            placeholder="Search direct messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="mobile-dm-new-btn"
          onClick={onStartNewDM}
          aria-label="Start new direct message"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Conversations Scroll Area */}
      <div className="mobile-dm-scroll">
        {filteredConversations.length === 0 ? (
          <div className="mobile-empty-state">
            <div className="mobile-empty-icon">
              <MessageSquarePlus size={28} />
            </div>
            <h3>No direct messages yet</h3>
            <p>Start a conversation with friends or team members.</p>
            <button
              type="button"
              className="mobile-empty-btn"
              onClick={onStartNewDM}
            >
              <Plus size={16} />
              <span>Start Conversation</span>
            </button>
          </div>
        ) : (
          filteredConversations.map((c) => {
            const other = getOtherParticipant(c.participants);
            if (!other) return null;

            const messages = dmMessages[c.id] || [];
            const lastMsg = messages[messages.length - 1];
            const lastMsgText = lastMsg ? lastMsg.content : 'Direct message history';
            const timestamp = lastMsg?.createdAt || c.createdAt;
            const hasUnread = c.unreadCount > 0;

            return (
              <div
                key={c.id}
                className={`mobile-dm-row ${hasUnread ? 'has-unread' : ''}`}
                onClick={() => selectConversation(c.id)}
                role="button"
                tabIndex={0}
              >
                <div className="mobile-dm-avatar-wrap">
                  <Avatar
                    src={other.avatarUrl}
                    name={other.displayName || other.username}
                    size={46}
                    status={other.status}
                    showStatus={true}
                  />
                </div>

                <div className="mobile-dm-details truncate">
                  <div className="mobile-dm-top-line">
                    <span className={`mobile-dm-name truncate ${hasUnread ? 'unread-name' : ''}`}>
                      {other.displayName || other.username}
                    </span>
                    <span className="mobile-dm-time">{formatLastActivity(timestamp)}</span>
                  </div>

                  <div className="mobile-dm-bottom-line">
                    <span className={`mobile-dm-preview truncate ${hasUnread ? 'unread-preview' : ''}`}>
                      {other.customStatus?.text
                        ? `${other.customStatus.emoji || ''} ${other.customStatus.text} • ${lastMsgText}`
                        : lastMsgText}
                    </span>
                    {hasUnread && (
                      <span className="mobile-dm-unread-badge">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
