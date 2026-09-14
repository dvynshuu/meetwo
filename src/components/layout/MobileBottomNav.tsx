import React from 'react';
import { Home, MessageSquare, LayoutGrid, Bell, User as UserIcon } from 'lucide-react';
import { useDM } from '../../app/providers/DMContext';
import { useInbox } from '../../app/providers/InboxContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Avatar } from '../ui/Avatar';

export type MobileTab = 'home' | 'dms' | 'spaces' | 'inbox' | 'profile';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const { totalUnreadDMs } = useDM();
  const { unreadMentionCount } = useInbox();
  const { currentUser } = useAuth();

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation Bar">
      {/* 1. Home */}
      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onSelectTab('home')}
        aria-label="Home"
        aria-current={activeTab === 'home' ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap">
          <Home size={21} />
        </div>
        <span className="mobile-nav-label">Home</span>
      </button>

      {/* 2. Direct Messages */}
      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'dms' ? 'active' : ''}`}
        onClick={() => onSelectTab('dms')}
        aria-label={`Direct Messages ${totalUnreadDMs > 0 ? `(${totalUnreadDMs} unread)` : ''}`}
        aria-current={activeTab === 'dms' ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap">
          <MessageSquare size={21} />
          {totalUnreadDMs > 0 && (
            <span className="mobile-nav-badge" aria-label={`${totalUnreadDMs} unread messages`}>
              {totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}
            </span>
          )}
        </div>
        <span className="mobile-nav-label">DMs</span>
      </button>

      {/* 3. Spaces (Workspaces & Channels) */}
      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'spaces' ? 'active' : ''}`}
        onClick={() => onSelectTab('spaces')}
        aria-label="Spaces & Channels"
        aria-current={activeTab === 'spaces' ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap">
          <LayoutGrid size={21} />
        </div>
        <span className="mobile-nav-label">Spaces</span>
      </button>

      {/* 4. Inbox */}
      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
        onClick={() => onSelectTab('inbox')}
        aria-label={`Inbox & Mentions ${unreadMentionCount > 0 ? `(${unreadMentionCount} unread)` : ''}`}
        aria-current={activeTab === 'inbox' ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap">
          <Bell size={21} />
          {unreadMentionCount > 0 && (
            <span className="mobile-nav-badge" aria-label={`${unreadMentionCount} unread mentions`}>
              {unreadMentionCount > 99 ? '99+' : unreadMentionCount}
            </span>
          )}
        </div>
        <span className="mobile-nav-label">Inbox</span>
      </button>

      {/* 5. Profile & Settings */}
      <button
        type="button"
        className={`mobile-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onSelectTab('profile')}
        aria-label="Profile and Settings"
        aria-current={activeTab === 'profile' ? 'page' : undefined}
      >
        <div className="mobile-nav-icon-wrap">
          {currentUser ? (
            <Avatar
              src={currentUser.avatarUrl}
              name={currentUser.displayName || currentUser.username}
              size={22}
              status={currentUser.status}
              showStatus={true}
            />
          ) : (
            <UserIcon size={21} />
          )}
        </div>
        <span className="mobile-nav-label">Profile</span>
      </button>
    </nav>
  );
};
