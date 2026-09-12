import React, { useState, useEffect } from 'react';
import { ServerSidebar } from './ServerSidebar';
import { ChannelSidebar } from './ChannelSidebar';
import { TopAppBar } from './TopAppBar';
import { MemberList } from './MemberList';
import { ChatContainer } from '../chat/ChatContainer';
import { VideoRoom } from '../video/VideoRoom';
import { StageRoom } from '../video/StageRoom';
import { ForumContainer } from '../forum/ForumContainer';
import { SavedMessagesDrawer } from '../chat/SavedMessagesDrawer';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import { CreateServerModal } from '../servers/CreateServerModal';
import { CreateChannelModal } from '../servers/CreateChannelModal';
import { SettingsModal } from '../settings/SettingsModal';
import { AuthModal } from '../../features/auth/AuthModal';
import { CommandPalette } from '../navigation/CommandPalette';
import { GlobalSearchModal } from '../navigation/GlobalSearchModal';
import { ServerInviteModal } from '../servers/ServerInviteModal';
import { AuditLogModal } from '../servers/AuditLogModal';
import { useAuth } from '../../app/providers/AuthContext';

export const AppLayout: React.FC = () => {
  const { activeChannel } = useServer();
  const { activeRoomId } = useMedia();
  const { currentUser } = useAuth();

  const [showMemberList, setShowMemberList] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [channelSidebarCollapsed, setChannelSidebarCollapsed] = useState(false);

  // Modals & Drawers state
  const [createServerOpen, setCreateServerOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [savedMessagesOpen, setSavedMessagesOpen] = useState(false);
  const [auditLogOpen, setAuditLogOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isStageView = activeChannel?.type === 'stage';
  const isForumView = activeChannel?.type === 'forum';
  const isVoiceView =
    activeChannel?.type === 'voice' ||
    (activeRoomId && activeChannel && activeRoomId === activeChannel.id);

  const handleOpenCreateChannel = (categoryId?: string) => {
    setSelectedCategoryId(categoryId);
    setCreateChannelOpen(true);
  };

  return (
    <div className={`app-container ${mobileNavOpen ? 'sidebar-open' : ''}`}>
      {/* Mobile Backdrop */}
      <div
        className="mobile-overlay"
        onClick={() => setMobileNavOpen(false)}
      />

      {/* 1. Server Sidebar Rail */}
      <ServerSidebar onOpenCreateServer={() => setCreateServerOpen(true)} />

      {/* 2. Channel Sidebar Rail */}
      <ChannelSidebar
        onOpenCreateChannel={handleOpenCreateChannel}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenInvite={() => setInviteModalOpen(true)}
        isCollapsed={channelSidebarCollapsed}
        onToggleCollapse={() => setChannelSidebarCollapsed(!channelSidebarCollapsed)}
      />

      {/* 3. Main Center Pane */}
      <main className="main-content">
        <TopAppBar
          onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)}
          showMemberList={showMemberList}
          onToggleMemberList={() => setShowMemberList(!showMemberList)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenSearch={() => setGlobalSearchOpen(true)}
          onOpenInvite={() => setInviteModalOpen(true)}
          onOpenSavedMessages={() => setSavedMessagesOpen(true)}
          onOpenAuditLogs={() => setAuditLogOpen(true)}
        />

        <div className="content-body">
          {isStageView ? (
            <StageRoom onOpenSettings={() => setSettingsOpen(true)} />
          ) : isForumView ? (
            <ForumContainer />
          ) : isVoiceView ? (
            <VideoRoom onOpenSettings={() => setSettingsOpen(true)} />
          ) : (
            <ChatContainer />
          )}

          {/* Member List (shown in text/forum chat views) */}
          {!isVoiceView && !isStageView && showMemberList && <MemberList />}

          {/* ⭐ Saved Messages Drawer (slide-over from right) */}
          <SavedMessagesDrawer
            isOpen={savedMessagesOpen}
            onClose={() => setSavedMessagesOpen(false)}
          />
        </div>
      </main>

      {/* Modals & Overlays */}
      <CreateServerModal
        isOpen={createServerOpen}
        onClose={() => setCreateServerOpen(false)}
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
        isOpen={authOpen || !currentUser}
        onClose={() => setAuthOpen(false)}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCreateServer={() => setCreateServerOpen(true)}
        onOpenCreateChannel={() => setCreateChannelOpen(true)}
      />

      <GlobalSearchModal
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
      />

      <ServerInviteModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      <AuditLogModal
        isOpen={auditLogOpen}
        onClose={() => setAuditLogOpen(false)}
      />
    </div>
  );
};
