import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { InboxItem, Message } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { mockStore } from '../../lib/supabase/mockStore';
import { ReadStateService } from '../../lib/services/readStateService';
import { useAuth } from './AuthContext';

const INBOX_STORAGE_KEY = 'mw:inbox:items';

export interface ChannelUnreadState {
  count: number;
  hasMention: boolean;
}

interface InboxContextType {
  inboxItems: InboxItem[];
  unreadMentionCount: number;
  totalUnreadCount: number;
  unreadByChannel: Record<string, ChannelUnreadState>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  markChannelRead: (channelId: string) => void;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

export const InboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [inboxItems, setInboxItems] = useState<InboxItem[]>(() => {
    try {
      const saved = localStorage.getItem(INBOX_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [channelUnreadMap, setChannelUnreadMap] = useState<Record<string, ChannelUnreadState>>({});

  // Persist inbox items
  useEffect(() => {
    try {
      localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(inboxItems));
    } catch (e) {
      console.warn('Failed to save inbox items:', e);
    }
  }, [inboxItems]);

  // Real-time listener for incoming messages (Supabase + Dev mockStore)
  useEffect(() => {
    if (!currentUser) return;

    const username = currentUser.username || '';
    const displayName = currentUser.displayName || '';

    const handleIncomingMessage = async (
      channelId: string,
      messageId: string,
      content: string,
      authorId: string,
      authorName: string,
      authorAvatar?: string,
      replyToAuthorId?: string
    ) => {
      if (authorId === currentUser.id) return;

      const isMention =
        Boolean(username && content.includes(`@${username}`)) ||
        Boolean(displayName && content.includes(`@${displayName}`)) ||
        content.includes('@everyone') ||
        content.includes('@here');

      const isReply = Boolean(replyToAuthorId && replyToAuthorId === currentUser.id);

      // Check channel info
      let serverId = '';
      let serverName = 'Workspace';
      let channelName = 'general';

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: chanData } = await supabase
            .from('channels')
            .select('id, name, server_id, server:servers(id, name)')
            .eq('id', channelId)
            .maybeSingle();

          if (chanData) {
            channelName = chanData.name || 'general';
            serverId = chanData.server_id || '';
            serverName = (chanData.server as any)?.name || 'Workspace';
          }
        } catch {}
      } else {
        const chan = mockStore.getChannels().find((c) => c.id === channelId);
        const server = chan ? mockStore.getServers().find((s) => s.id === chan.serverId) : undefined;
        channelName = chan?.name || 'chat';
        serverId = chan?.serverId || '';
        serverName = server?.name || 'Workspace';
      }

      if (isMention || isReply) {
        const newItem: InboxItem = {
          id: `inbox-${messageId}`,
          type: isMention ? 'mention' : 'reply',
          channelId,
          serverId,
          messageId,
          content,
          authorName,
          authorAvatar,
          channelName,
          serverName,
          timestamp: new Date().toISOString(),
          isRead: false,
        };

        setInboxItems((prev) => {
          if (prev.some((i) => i.id === newItem.id)) return prev;
          return [newItem, ...prev];
        });
      }

      // Update channel unread state
      setChannelUnreadMap((prev) => {
        const existing = prev[channelId] || { count: 0, hasMention: false };
        return {
          ...prev,
          [channelId]: {
            count: existing.count + 1,
            hasMention: existing.hasMention || isMention,
          },
        };
      });
    };

    // 1. Supabase Realtime Listener
    let globalMsgChannel: any = null;
    if (isSupabaseConfigured && supabase) {
      globalMsgChannel = supabase
        .channel('global_inbox_messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            const row = payload.new as any;
            if (!row || row.author_id === currentUser.id) return;

            const { data: authorProf } = await supabase!
              .from('profiles')
              .select('*')
              .eq('id', row.author_id)
              .maybeSingle();

            handleIncomingMessage(
              row.channel_id,
              row.id,
              row.content,
              row.author_id,
              authorProf?.display_name || authorProf?.username || 'Member',
              authorProf?.avatar_url,
              row.reply_to_id
            );
          }
        )
        .subscribe();
    }

    // 2. Dev MockStore Listener
    const unsubscribeMock = mockStore.on('NEW_MESSAGE', (msg: Message) => {
      handleIncomingMessage(
        msg.channelId,
        msg.id,
        msg.content,
        msg.authorId,
        msg.author?.displayName || msg.author?.username || 'User',
        msg.author?.avatarUrl
      );
    });

    return () => {
      if (globalMsgChannel && supabase) {
        supabase.removeChannel(globalMsgChannel);
      }
      unsubscribeMock();
    };
  }, [currentUser]);

  const unreadMentionCount = useMemo(() => {
    return inboxItems.filter((i) => !i.isRead && (i.type === 'mention' || i.type === 'reply')).length;
  }, [inboxItems]);

  const totalUnreadCount = useMemo(() => {
    return inboxItems.filter((i) => !i.isRead).length;
  }, [inboxItems]);

  const markRead = useCallback((id: string) => {
    setInboxItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setInboxItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setChannelUnreadMap({});
  }, []);

  const markChannelRead = useCallback(
    (channelId: string) => {
      setChannelUnreadMap((prev) => {
        const next = { ...prev };
        delete next[channelId];
        return next;
      });

      setInboxItems((prev) =>
        prev.map((item) => (item.channelId === channelId ? { ...item, isRead: true } : item))
      );

      if (currentUser) {
        ReadStateService.markAsRead(currentUser.id, { channelId });
      }
    },
    [currentUser]
  );

  return (
    <InboxContext.Provider
      value={{
        inboxItems,
        unreadMentionCount,
        totalUnreadCount,
        unreadByChannel: channelUnreadMap,
        markRead,
        markAllRead,
        markChannelRead,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
};

export const useInbox = (): InboxContextType => {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInbox must be used within an InboxProvider');
  }
  return context;
};
