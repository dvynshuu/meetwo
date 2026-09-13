import React, { useState, useEffect, useCallback } from 'react';
import { ServerSidebar } from './ServerSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { HomeSidebar, HomeTab } from './HomeSidebar';
import { TopAppBar } from './TopAppBar';
import { MemberList } from './MemberList';
import { ChatContainer } from '../chat/ChatContainer';
import { VideoRoom } from '../video/VideoRoom';
import { StageRoom } from '../video/StageRoom';
import { ForumContainer } from '../forum/ForumContainer';
import { SavedMessagesDrawer } from '../chat/SavedMessagesDrawer';
import { HomeView } from '../home/HomeView';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import { useNavigation } from '../../app/providers/NavigationContext';
import { useDM } from '../../app/providers/DMContext';
import { useAuth } from '../../app/providers/AuthContext';
import { CreateServerModal } from '../servers/CreateServerModal';
import { CreateChannelModal } from '../servers/CreateChannelModal';
import { SettingsModal } from '../settings/SettingsModal';
import { AuthModal } from '../../features/auth/AuthModal';
import { CommandPalette } from '../navigation/CommandPalette';
import { QuickSwitcher } from '../navigation/QuickSwitcher';
import { GlobalSearchModal } from '../navigation/GlobalSearchModal';
import { ServerInviteModal } from '../servers/ServerInviteModal';
import { InviteAcceptModal } from '../servers/InviteAcceptModal';
import { AuditLogModal } from '../servers/AuditLogModal';
import { ChannelBrowserModal } from '../servers/ChannelBrowserModal';
import { ServerOnboardingModal } from '../servers/ServerOnboardingModal';
import { NavigationEntry } from '../../types';

export const AppLayout: React.FC = () => {
  const { activeServer, activeChannel, channels, selectServer, selectChannel } = useServer();
  const { activeRoomId, toggleAudio, toggleVideo } = useMedia();
  const { currentUser } = useAuth();
  const { pushNavigation, goBack, goForward } = useNavigation();
  const { selectConversation } = useDM();

  // Primary view mode: 'home' (DMs, friends, inbox) or 'server' (workspaces & channels)
  const [viewMode, setViewMode] = useState<'home' | 'server'>('home');
  const [homeTab, setHomeTab] = useState<HomeTab>('dms');

  const [showMemberList, setShowMemberList] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [channelSidebarCollapsed, setChannelSidebarCollapsed] = useState(false);

  // Modals & Drawers state
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createServerOpen, setCreateServerOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [savedMessagesOpen, setSavedMessagesOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [channelBrowserOpen, setChannelBrowserOpen] = useState(false);
  const [serverOnboardingOpen, setServerOnboardingOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<{ code: string; encodedData?: string | null } | null>(null);

  // URL Routing detection for invites (/invite/:code, ?invite=:code, #/invite/:code) and channel links (/channels/:serverId/:channelId)
  useEffect(() => {
    const handleUrlRoute = () => {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;

      // 1. Check for invite link
      let inviteCode: string | null = null;
      let encodedData = searchParams.get('d') || searchParams.get('data');

      const pathMatch = pathname.match(/\/invite\/([a-zA-Z0-9_-]+)/i);
      if (pathMatch && pathMatch[1]) {
        inviteCode = pathMatch[1];
      } else if (searchParams.get('invite')) {
        inviteCode = searchParams.get('invite');
      } else if (hash.includes('/invite/')) {
        const hashMatch = hash.match(/\/invite\/([a-zA-Z0-9_-]+)/i);
        if (hashMatch && hashMatch[1]) {
          inviteCode = hashMatch[1];
        }
      }

      if (inviteCode) {
        setPendingInvite({ code: inviteCode, encodedData });
        return;
      }

      // 2. Check for channel link: /channels/:serverId/:channelId
      const chanMatch = pathname.match(/\/channels\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/i);
      if (chanMatch && chanMatch[1] && chanMatch[2]) {
        const sId = chanMatch[1];
        const cId = chanMatch[2];
        selectServer(sId);
        selectChannel(cId);
        setViewMode('server');
      }
    };

    handleUrlRoute();

    window.addEventListener('popstate', handleUrlRoute);
    window.addEventListener('hashchange', handleUrlRoute);

    // Custom in-app event to trigger invite acceptance modal
    const handleCustomInvite = (e: any) => {
      if (e.detail?.code) {
        setPendingInvite({ code: e.detail.code, encodedData: e.detail.encodedData });
      }
    };
    window.addEventListener('meetwo:open-invite', handleCustomInvite);

    return () => {
      window.removeEventListener('popstate', handleUrlRoute);
      window.removeEventListener('hashchange', handleUrlRoute);
      window.removeEventListener('meetwo:open-invite', handleCustomInvite);
    };
  }, []);

  // Push navigation entry on channel selection
  useEffect(() => {
    if (activeChannel && viewMode === 'server') {
      pushNavigation({
        id: activeChannel.id,
        type: 'channel',
        name: activeChannel.name,
        serverId: activeChannel.serverId,
        channelId: activeChannel.id,
      });
    }
  }, [activeChannel?.id, viewMode]);

  // Check server onboarding status when activeServer changes
  useEffect(() => {
    if (activeServer && activeServer.id) {
      try {
        const onboarded = localStorage.getItem(`mw:onboarded:${activeServer.id}`);
        if (!onboarded) {
          setServerOnboardingOpen(true);
        }
      } catch {}
    }
  }, [activeServer?.id]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+K: Command Palette (Actions)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl+K / Cmd+K: Quick Switcher (Navigation)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSwitcherOpen((prev) => !prev);
        return;
      }

      // Ctrl+D: Toggle mic
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        toggleAudio();
        return;
      }

      // Ctrl+E: Toggle camera
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        toggleVideo();
        return;
      }

      // Alt+Left: History Back
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        const dest = goBack();
        if (dest) handleNavigateHistory(dest);
        return;
      }

      // Alt+Right: History Forward
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const dest = goForward();
        if (dest) handleNavigateHistory(dest);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleAudio, toggleVideo, goBack, goForward]);

  const handleNavigateHistory = (entry: NavigationEntry) => {
    if (entry.type === 'dm' && entry.conversationId) {
      setViewMode('home');
      setHomeTab('dms');
      selectConversation(entry.conversationId);
    } else if (entry.type === 'channel' && entry.channelId) {
      if (entry.serverId) selectServer(entry.serverId);
      selectChannel(entry.channelId);
      setViewMode('server');
    } else if (entry.type === 'server' && entry.serverId) {
      selectServer(entry.serverId);
      setViewMode('server');
    }
  };

  const handleOpenCreateChannel = (categoryId?: string) => {
    setSelectedCategoryId(categoryId);
    setCreateChannelOpen(true);
  };

  const isStageView = activeChannel?.type === 'stage';
  const isForumView = activeChannel?.type === 'forum';
  const isVoiceView =
    activeChannel?.type === 'voice' ||
    (activeRoomId && activeChannel && activeRoomId === activeChannel.id);

  return (
    <div className={`app-container ${mobileNavOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Backdrop */}
      <div className="mobile-overlay" onClick={() => setMobileNavOpen(false)} />

      {/* 1. Server Sidebar Rail */}
      <ServerSidebar
        viewMode={viewMode}
        onSelectHome={() => {
          setViewMode('home');
          setMobileNavOpen(false);
        }}
        onSelectServer={(serverId) => {
          selectServer(serverId);
          setViewMode('server');
          setMobileNavOpen(false);
        }}
        onOpenCreateServer={() => setCreateServerOpen(true)}
        onOpenInvite={() => setInviteModalOpen(true)}
        onOpenCreateChannel={() => handleOpenCreateChannel()}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* 2. Channel Sidebar Rail or Home Sidebar Rail */}
      {viewMode === 'home' ? (
        <HomeSidebar
          activeTab={homeTab}
          onSelectTab={(tab) => {
            setHomeTab(tab);
            setMobileNavOpen(false);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onReturnToCall={() => setViewMode('server')}
          onStartNewDM={() => setQuickSwitcherOpen(true)}
        />
      ) : (
        <ChannelSidebar
          onOpenCreateChannel={handleOpenCreateChannel}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenInvite={() => setInviteModalOpen(true)}
          onOpenChannelBrowser={() => setChannelBrowserOpen(true)}
          onReturnToCall={() => setViewMode('server')}
          isCollapsed={channelSidebarCollapsed}
          onToggleCollapse={() => setChannelSidebarCollapsed(!channelSidebarCollapsed)}
        />
      )}

      {/* 3. Main Center Pane */}
      <main className="main-content">
        {/* Hide the top bar entirely during voice/stage calls — Discord-style full viewport */}
        {!isVoiceView && !isStageView && (
          <TopAppBar
            viewMode={viewMode}
            homeTab={homeTab}
            onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)}
            showMemberList={showMemberList}
            onToggleMemberList={() => setShowMemberList(!showMemberList)}
            onOpenQuickSwitcher={() => setQuickSwitcherOpen(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenSearch={() => setGlobalSearchOpen(true)}
            onOpenInvite={() => setInviteModalOpen(true)}
            onOpenSavedMessages={() => setSavedMessagesOpen(true)}
            onOpenAuditLogs={() => setAuditLogOpen(true)}
            onSelectHomeTab={(tab) => {
              setViewMode('home');
              setHomeTab(tab);
            }}
            onNavigateHistory={handleNavigateHistory}
          />
        )}

        <div className={`content-body${isVoiceView || isStageView ? ' content-body--fullscreen' : ''}`}>
          {viewMode === 'home' ? (
            <HomeView
              activeTab={homeTab}
              onSelectTab={setHomeTab}
              onNavigateToChannel={(serverId, channelId) => {
                selectServer(serverId);
                selectChannel(channelId);
                setViewMode('server');
              }}
              onSelectServer={(serverId) => {
                selectServer(serverId);
                setViewMode('server');
              }}
              onOpenCreateServer={() => setCreateServerOpen(true)}
              onNavigateToDestination={handleNavigateHistory}
              onOpenQuickSwitcher={() => setQuickSwitcherOpen(true)}
              onOpenSavedMessages={() => setSavedMessagesOpen(true)}
            />
          ) : isStageView ? (
            <StageRoom onOpenSettings={() => setSettingsOpen(true)} />
          ) : isForumView ? (
            <ForumContainer />
          ) : isVoiceView ? (
            <VideoRoom onOpenSettings={() => setSettingsOpen(true)} />
          ) : (
            <ChatContainer />
          )}

          {/* Member List (shown in text/forum server chat views) */}
          {viewMode === 'server' && !isVoiceView && !isStageView && showMemberList && <MemberList />}

          {/* Saved Messages Drawer (slide-over from right) */}
          <SavedMessagesDrawer
            isOpen={savedMessagesOpen}
            onClose={() => setSavedMessagesOpen(false)}
          />
        </div>
      </main>

      {/* Quick Switcher (Ctrl+K Navigation) */}
      <QuickSwitcher
        isOpen={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onNavigateToDM={(convoId) => {
          setViewMode('home');
          setHomeTab('dms');
          selectConversation(convoId);
        }}
        onNavigateToServerChannel={(serverId, channelId) => {
          selectServer(serverId);
          selectChannel(channelId);
          setViewMode('server');
        }}
        onNavigateToServer={(serverId) => {
          selectServer(serverId);
          setViewMode('server');
        }}
      />

      {/* Command Palette (Ctrl+Shift+K Actions) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCreateServer={() => setCreateServerOpen(true)}
        onOpenCreateChannel={() => handleOpenCreateChannel()}
        onOpenInvite={() => setInviteModalOpen(true)}
        onOpenAuditLogs={() => setAuditLogOpen(true)}
        onToggleMemberList={() => setShowMemberList((prev) => !prev)}
      />

      {/* Channel Browser Modal */}
      <ChannelBrowserModal
        isOpen={channelBrowserOpen}
        onClose={() => setChannelBrowserOpen(false)}
        onOpenCreateChannel={() => handleOpenCreateChannel()}
      />

      {/* Server Onboarding Modal */}
      {activeServer && (
        <ServerOnboardingModal
          server={activeServer}
          channels={channels}
          isOpen={serverOnboardingOpen}
          onClose={() => setServerOnboardingOpen(false)}
          onSelectChannel={(cId) => selectChannel(cId)}
        />
      )}

      {/* Modals & Overlays */}
      <CreateServerModal
        isOpen={createServerOpen}
        onClose={() => setCreateServerOpen(false)}
        onCreated={(newServer) => {
          selectServer(newServer.id);
          setViewMode('server');
        }}
      />

      <CreateChannelModal
        isOpen={createChannelOpen}
        onClose={() => {
          setCreateChannelOpen(false);
          setSelectedCategoryId(undefined);
        }}
        defaultCategoryId={selectedCategoryId}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <AuthModal
        isOpen={authOpen || (!currentUser && !pendingInvite)}
        onClose={() => setAuthOpen(false)}
      />

      <GlobalSearchModal
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
      />

      <ServerInviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      <InviteAcceptModal
        isOpen={Boolean(pendingInvite)}
        inviteCode={pendingInvite?.code || ''}
        encodedData={pendingInvite?.encodedData}
        onClose={() => {
          setPendingInvite(null);
          if (window.location.pathname.startsWith('/invite/')) {
            window.history.replaceState({}, '', '/');
          }
        }}
        onSuccess={(server, channelId) => {
          setPendingInvite(null);
          setViewMode('server');
          selectServer(server.id, server);
          if (channelId) {
            selectChannel(channelId);
          }
          if (window.location.pathname.startsWith('/invite/')) {
            window.history.replaceState({}, '', '/');
          }
        }}
      />

      <AuditLogModal
        isOpen={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
      />
    </div>
  );
};
