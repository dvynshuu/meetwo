import React from 'react';
import { HomeTab } from '../layout/HomeSidebar';
import { DMConversationView } from './DMConversationView';
import { FriendsView } from './FriendsView';
import { InboxView } from './InboxView';
import { HomeDashboard } from './HomeDashboard';
import { useDM } from '../../app/providers/DMContext';
import { NavigationEntry } from '../../types';

interface HomeViewProps {
  activeTab: HomeTab;
  onSelectTab: (tab: HomeTab) => void;
  onNavigateToChannel: (serverId: string, channelId: string) => void;
  onNavigateToDestination: (entry: NavigationEntry) => void;
  onOpenQuickSwitcher: () => void;
  onOpenSavedMessages: () => void;
  onSelectServer?: (serverId: string) => void;
  onOpenCreateServer?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  activeTab,
  onSelectTab,
  onNavigateToChannel,
  onNavigateToDestination,
  onOpenQuickSwitcher,
  onOpenSavedMessages,
  onSelectServer,
  onOpenCreateServer,
}) => {
  const { activeConversationId, selectConversation } = useDM();

  if (activeTab === 'friends') {
    return (
      <FriendsView
        onOpenDM={(conversationId) => {
          onSelectTab('dms');
          selectConversation(conversationId);
        }}
      />
    );
  }

  if (activeTab === 'inbox') {
    return <InboxView onNavigateToChannel={onNavigateToChannel} />;
  }

  if (activeTab === 'saved') {
    onOpenSavedMessages();
    return (
      <HomeDashboard
        onNavigateToDestination={onNavigateToDestination}
        onOpenQuickSwitcher={onOpenQuickSwitcher}
        onGoToFriends={() => onSelectTab('friends')}
        onNavigateToChannel={onNavigateToChannel}
        onSelectServer={onSelectServer}
        onOpenCreateServer={onOpenCreateServer}
      />
    );
  }

  if (activeTab === 'dms' && activeConversationId) {
    return <DMConversationView conversationId={activeConversationId} />;
  }

  return (
    <HomeDashboard
      onNavigateToDestination={onNavigateToDestination}
      onOpenQuickSwitcher={onOpenQuickSwitcher}
      onGoToFriends={() => onSelectTab('friends')}
      onNavigateToChannel={onNavigateToChannel}
      onSelectServer={onSelectServer}
      onOpenCreateServer={onOpenCreateServer}
    />
  );
};
