import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { InboxItem, Message } from '../../types';
import { mockStore } from '../../lib/supabase/mockStore';
import { useAuth } from './AuthContext';

const INBOX_STORAGE_KEY = 'mw:inbox:items';

interface ChannelUnreadState {
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

  // Real-time listener for incoming messages
  useEffect(() => {
    const unsubscribe = mockStore.on('NEW_MESSAGE', (msg: Message) => {
      const channels = mockStore.getChannels();
      const channel = channels.find((c) => c.id === msg.channelId);
      const servers = mockStore.getServers();
      const server = channel ? servers.find((s) => s.id === channel.serverId) : undefined;

      const username = currentUser?.username || '';
      const displayName = currentUser?.displayName || '';

      const isMention =
        Boolean(username && msg.content.includes(`@${username}`)) ||
        Boolean(displayName && msg.content.includes(`@${displayName}`)) ||
        msg.content.includes('@everyone') ||
        msg.content.includes('@here');

      const isReply = Boolean(currentUser && msg.replyTo && msg.replyTo.authorName === currentUser.displayName);

      if (isMention || isReply) {
        const newItem: InboxItem = {
          id: `inbox-${Date.now()}`,
          type: isMention ? 'mention' : 'reply',
          channelId: msg.channelId,
          serverId: channel?.serverId || '',
          messageId: msg.id,
          content: msg.content,
          authorName: msg.author?.displayName || msg.author?.username || 'User',
          authorAvatar: msg.author?.avatarUrl,
          channelName: channel?.name || 'chat',
          serverName: server?.name || 'Workspace',
          timestamp: msg.createdAt,
          isRead: false,
        };

        setInboxItems((prev) => [newItem, ...prev]);
      }

      // Update channel unread badge
      setChannelUnreadMap((prev) => {
        const existing = prev[msg.channelId] || { count: 0, hasMention: false };
        return {
          ...prev,
          [msg.channelId]: {
            count: existing.count + 1,
            hasMention: existing.hasMention || isMention,
          },
        };
      });
    });

    return () => {
      unsubscribe();
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

  const markChannelRead = useCallback((channelId: string) => {
    setChannelUnreadMap((prev) => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });

    setInboxItems((prev) =>
      prev.map((item) => (item.channelId === channelId ? { ...item, isRead: true } : item))
    );
  }, []);

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
