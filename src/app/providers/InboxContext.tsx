import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { InboxItem } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { NotificationService, NotificationItem } from '../../lib/services/notificationService';
import { ReadStateService } from '../../lib/services/readStateService';
import { useAuth } from './AuthContext';

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
  refreshInbox: () => Promise<void>;
}

const InboxContext = createContext<InboxContextType | undefined>(undefined);

const mapNotificationToInboxItem = (n: NotificationItem): InboxItem => ({
  id: n.id,
  type: n.type === 'reply' ? 'reply' : n.type === 'mention' ? 'mention' : 'unread',
  channelId: n.channelId || '',
  serverId: n.serverId || '',
  messageId: n.sourceId || '',
  content: n.content,
  authorName: n.metadata?.actorName || 'Member',
  authorAvatar: n.metadata?.avatarUrl,
  channelName: n.metadata?.channelName || 'general',
  serverName: n.metadata?.serverName || 'Workspace',
  timestamp: n.createdAt,
  isRead: n.isRead,
});

export const InboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [channelUnreadMap, setChannelUnreadMap] = useState<Record<string, ChannelUnreadState>>({});

  const loadNotifications = useCallback(async () => {
    if (!currentUser) {
      setInboxItems([]);
      return;
    }

    try {
      const items = await NotificationService.getNotifications(currentUser.id);
      setInboxItems(items.map(mapNotificationToInboxItem));
    } catch (err) {
      console.warn('[InboxContext] Error loading notifications:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time listener for incoming notifications
  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured || !supabase) return;

    const notifSub = supabase
      .channel(`user_notifications:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new as any;
            const notif: NotificationItem = {
              id: raw.id,
              userId: raw.user_id,
              type: raw.type,
              sourceId: raw.source_id,
              actorId: raw.actor_id,
              serverId: raw.server_id,
              channelId: raw.channel_id,
              conversationId: raw.conversation_id,
              content: raw.content,
              metadata: raw.metadata || {},
              isRead: Boolean(raw.is_read),
              createdAt: raw.created_at,
            };
            const mapped = mapNotificationToInboxItem(notif);
            setInboxItems((prev) => {
              if (prev.some((i) => i.id === mapped.id)) return prev;
              return [mapped, ...prev];
            });

            if (mapped.channelId) {
              setChannelUnreadMap((prev) => {
                const existing = prev[mapped.channelId] || { count: 0, hasMention: false };
                return {
                  ...prev,
                  [mapped.channelId]: {
                    count: existing.count + 1,
                    hasMention: existing.hasMention || mapped.type === 'mention',
                  },
                };
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setInboxItems((prev) =>
              prev.map((i) => (i.id === updated.id ? { ...i, isRead: Boolean(updated.is_read) } : i))
            );
          } else if (payload.eventType === 'DELETE') {
            const delId = (payload.old as any)?.id;
            if (delId) {
              setInboxItems((prev) => prev.filter((i) => i.id !== delId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(notifSub);
    };
  }, [currentUser?.id]);

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
    NotificationService.markAsRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setInboxItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setChannelUnreadMap({});
    if (currentUser) {
      NotificationService.markAllAsRead(currentUser.id).catch(() => {});
    }
  }, [currentUser]);

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
        refreshInbox: loadNotifications,
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
