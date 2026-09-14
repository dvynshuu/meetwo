import React from 'react';
import {
  ChevronLeft,
  ChevronDown,
  Hash,
  Volume2,
  Video,
  Radio,
  MessagesSquare,
  Search,
  Users,
  MoreVertical,
  Phone,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useDM } from '../../app/providers/DMContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Avatar } from '../ui/Avatar';
import { MobileTab } from './MobileBottomNav';

interface MobileHeaderProps {
  mobileTab: MobileTab;
  viewMode: 'home' | 'server';
  onOpenChannelSheet: () => void;
  onOpenWorkspaceSheet: () => void;
  onOpenSearch: () => void;
  onOpenMemberList: () => void;
  onBackFromDM: () => void;
  onOpenSettings: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  mobileTab,
  viewMode,
  onOpenChannelSheet,
  onOpenWorkspaceSheet,
  onOpenSearch,
  onOpenMemberList,
  onBackFromDM,
  onOpenSettings,
}) => {
  const { activeServer, activeChannel } = useServer();
  const { activeConversation, activeConversationId } = useDM();
  const { currentUser } = useAuth();

  const otherUser = activeConversation?.participants.find(
    (p) => p.id !== currentUser?.id
  ) || activeConversation?.participants[0];

  const renderChannelIcon = (type?: string, name?: string) => {
    switch (type) {
      case 'voice':
        return name?.toLowerCase().includes('video') ? (
          <Video size={17} className="mobile-header-channel-icon" />
        ) : (
          <Volume2 size={17} className="mobile-header-channel-icon" />
        );
      case 'stage':
        return <Radio size={17} className="mobile-header-channel-icon" />;
      case 'forum':
        return <MessagesSquare size={17} className="mobile-header-channel-icon" />;
      case 'text':
      default:
        return <Hash size={17} className="mobile-header-channel-icon" />;
    }
  };

  // 1. Inside an active DM conversation
  if (mobileTab === 'dms' && activeConversationId && otherUser) {
    return (
      <header className="mobile-header">
        <div className="mobile-header-left">
          <button
            type="button"
            className="mobile-header-back-btn"
            onClick={onBackFromDM}
            aria-label="Back to Conversations"
          >
            <ChevronLeft size={22} />
            <span className="mobile-header-back-text">DMs</span>
          </button>
        </div>

        <div className="mobile-header-center truncate">
          <Avatar
            src={otherUser.avatarUrl}
            name={otherUser.displayName || otherUser.username}
            size={26}
            status={otherUser.status}
            showStatus={true}
          />
          <span className="mobile-header-title truncate">
            {otherUser.displayName || otherUser.username}
          </span>
        </div>

        <div className="mobile-header-actions">
          <button
            type="button"
            className="mobile-header-icon-btn"
            onClick={onOpenSearch}
            aria-label="Search messages"
          >
            <Search size={19} />
          </button>
        </div>
      </header>
    );
  }

  // 2. Inside a Workspace Channel (Server mode)
  if (viewMode === 'server' && activeChannel) {
    return (
      <header className="mobile-header">
        <div className="mobile-header-left truncate">
          <button
            type="button"
            className="mobile-header-channel-picker-btn truncate"
            onClick={onOpenChannelSheet}
            aria-label={`Switch channel in ${activeServer?.name || 'Workspace'}`}
          >
            {renderChannelIcon(activeChannel.type, activeChannel.name)}
            <span className="mobile-header-title truncate">{activeChannel.name}</span>
            <ChevronDown size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </button>
        </div>

        <div className="mobile-header-actions">
          <button
            type="button"
            className="mobile-header-icon-btn"
            onClick={onOpenSearch}
            aria-label="Search channel"
          >
            <Search size={19} />
          </button>
          <button
            type="button"
            className="mobile-header-icon-btn"
            onClick={onOpenMemberList}
            aria-label="Members"
          >
            <Users size={19} />
          </button>
        </div>
      </header>
    );
  }

  // 3. Default Header for Home, Spaces Hub, Inbox, or Profile
  let title = 'Meetwo';
  if (mobileTab === 'dms') title = 'Direct Messages';
  else if (mobileTab === 'spaces') title = activeServer?.name || 'Workspaces';
  else if (mobileTab === 'inbox') title = 'Inbox & Mentions';
  else if (mobileTab === 'profile') title = 'Your Profile';

  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
        {mobileTab === 'spaces' ? (
          <button
            type="button"
            className="mobile-header-channel-picker-btn"
            onClick={onOpenWorkspaceSheet}
            aria-label="Switch Workspace"
          >
            <LayoutGrid size={18} style={{ color: 'var(--accent)' }} />
            <span className="mobile-header-title truncate">{title}</span>
            <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
          </button>
        ) : (
          <div className="mobile-header-brand">
            <div className="mobile-brand-icon">
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <span className="mobile-header-title">{title}</span>
          </div>
        )}
      </div>

      <div className="mobile-header-actions">
        <button
          type="button"
          className="mobile-header-icon-btn"
          onClick={onOpenSearch}
          aria-label="Search"
        >
          <Search size={19} />
        </button>
      </div>
    </header>
  );
};
