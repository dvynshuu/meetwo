import React, { useState } from 'react';
import { MessageSquare, Users, Bookmark, Bell, Plus, Search, X } from 'lucide-react';
import { useDM } from '../../app/providers/DMContext';
import { useInbox } from '../../app/providers/InboxContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Avatar } from '../ui/Avatar';
import { UserBar } from './UserBar';
import { ActiveCallBar } from './ActiveCallBar';
import { User } from '../../types';

export type HomeTab = 'dms' | 'friends' | 'saved' | 'inbox';

interface HomeSidebarProps {
  activeTab: HomeTab;
  onSelectTab: (tab: HomeTab) => void;
  onOpenSettings: () => void;
  onReturnToCall?: () => void;
  onStartNewDM?: () => void;
}

export const HomeSidebar: React.FC<HomeSidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  onReturnToCall,
  onStartNewDM,
}) => {
  const { currentUser } = useAuth();
  const { conversations, activeConversationId, selectConversation, totalUnreadDMs, friends } = useDM();
  const { unreadMentionCount } = useInbox();
  const [filterQuery, setFilterQuery] = useState('');

  const pendingFriendsCount = friends.filter((f) => f.status === 'pending_received').length;

  const getOtherParticipant = (participants: User[]): User | undefined => {
    return participants.find((p) => p.id !== currentUser?.id) || participants[0];
  };

  const filteredConversations = conversations.filter((c) => {
    const other = getOtherParticipant(c.participants);
    if (!other) return false;
    const name = other.displayName || other.username;
    return name.toLowerCase().includes(filterQuery.toLowerCase());
  });

  return (
    <aside className="channel-sidebar home-sidebar" aria-label="Home Navigation">
      {/* Home Header */}
      <header className="server-header home-header">
        <div className="home-search-pill" onClick={onStartNewDM} role="button" title="Find or start a conversation">
          <Search size={13} style={{ color: 'var(--text-muted)' }} />
          <span>Find or start a conversation</span>
        </div>
      </header>

      {/* Main Navigation Items */}
      <div className="channel-list">
        <div className="home-nav-section">
          <button
            className={`channel-item home-nav-item ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => onSelectTab('friends')}
          >
            <Users className="channel-icon" size={17} />
            <span className="truncate">Friends</span>
            {pendingFriendsCount > 0 && (
              <span className="unread-badge-pill" title={`${pendingFriendsCount} pending request${pendingFriendsCount > 1 ? 's' : ''}`}>
                {pendingFriendsCount}
              </span>
            )}
          </button>

          <button
            className={`channel-item home-nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => onSelectTab('inbox')}
          >
            <Bell className="channel-icon" size={17} />
            <span className="truncate">Inbox & Mentions</span>
            {unreadMentionCount > 0 && (
              <span className="unread-badge-pill" title={`${unreadMentionCount} unread mention${unreadMentionCount > 1 ? 's' : ''}`}>
                {unreadMentionCount}
              </span>
            )}
          </button>

          <button
            className={`channel-item home-nav-item ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => onSelectTab('saved')}
          >
            <Bookmark className="channel-icon" size={17} />
            <span className="truncate">Saved Messages</span>
          </button>
        </div>

        {/* Direct Messages Header */}
        <div className="channel-category" style={{ marginTop: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>DIRECT MESSAGES</span>
          <button
            className="icon-btn"
            style={{ width: 18, height: 18 }}
            onClick={onStartNewDM}
            title="Create Direct Message"
            aria-label="Create Direct Message"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Conversations List */}
        <div className="dm-conversations-list">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((c) => {
              const other = getOtherParticipant(c.participants);
              if (!other) return null;
              const isActive = activeTab === 'dms' && activeConversationId === c.id;
              const hasUnread = c.unreadCount > 0;

              return (
                <div
                  key={c.id}
                  className={`channel-item dm-item ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`}
                  onClick={() => {
                    onSelectTab('dms');
                    selectConversation(c.id);
                  }}
                  role="button"
                >
                  <Avatar
                    src={other.avatarUrl}
                    name={other.displayName || other.username}
                    size={28}
                    status={other.status}
                    showStatus={true}
                  />
                  <div className="dm-item-details truncate">
                    <span className={`dm-item-name truncate ${hasUnread ? 'unread-text' : ''}`}>
                      {other.displayName || other.username}
                    </span>
                    {other.customStatus?.text ? (
                      <span className="dm-item-status truncate">
                        {other.customStatus.emoji ? `${other.customStatus.emoji} ` : ''}
                        {other.customStatus.text}
                      </span>
                    ) : c.lastMessage ? (
                      <span className="dm-item-preview truncate">{c.lastMessage.content}</span>
                    ) : null}
                  </div>

                  {hasUnread && (
                    <span className="unread-badge-pill">{c.unreadCount}</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="empty-subtext" style={{ padding: '12px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
              No direct messages yet.
            </div>
          )}
        </div>
      </div>

      {/* Active Call Bar (if connected to voice) */}
      <ActiveCallBar onReturnToCall={onReturnToCall} />

      {/* Persistent User Control Bar */}
      <UserBar onOpenSettings={onOpenSettings} />
    </aside>
  );
};
