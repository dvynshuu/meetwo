import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, DMConversation, DMMessage, Friend } from '../../types';
import { DMService } from '../../lib/services/dmService';
import { FriendService } from '../../lib/services/friendService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { useAuth } from './AuthContext';

interface DMContextType {
  conversations: DMConversation[];
  activeConversationId: string | null;
  activeConversation: DMConversation | null;
  dmMessages: Record<string, DMMessage[]>;
  friends: Friend[];
  totalUnreadDMs: number;
  selectConversation: (conversationId: string | null) => void;
  sendDM: (conversationId: string, content: string) => Promise<void>;
  startConversationWithUser: (user: User) => Promise<string>;
  markConversationRead: (conversationId: string) => void;
  acceptFriendRequest: (friendId: string) => Promise<void>;
  addFriend: (username: string) => Promise<{ success: boolean; error?: string }>;
  removeFriend: (friendId: string) => Promise<void>;
}

const DMContext = createContext<DMContextType | undefined>(undefined);

export const DMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [dmMessages, setDmMessages] = useState<Record<string, DMMessage[]>>({});
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Load conversations and friends on auth change
  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setFriends([]);
      return;
    }

    let isMounted = true;

    DMService.getConversations(currentUser.id).then((convos) => {
      if (isMounted) setConversations(convos);
    });

    FriendService.getFriends(currentUser.id).then((fr) => {
      if (isMounted) setFriends(fr);
    });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  // STABLE Realtime subscription: depends strictly on currentUser.id
  // Changing activeConversationId NEVER tears down or reconnects the global DM subscription
  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel(`user_dm_messages:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
        },
        async (payload) => {
          const newRow = payload.new as any;
          if (!newRow || newRow.author_id === currentUser.id) return;

          // Fetch author profile
          const { data: authorProf } = await supabase!
            .from('profiles')
            .select('*')
            .eq('id', newRow.author_id)
            .maybeSingle();

          const incomingMsg: DMMessage = {
            id: newRow.id,
            conversationId: newRow.conversation_id,
            authorId: newRow.author_id,
            content: newRow.content,
            createdAt: newRow.created_at,
            author: authorProf
              ? {
                  id: authorProf.id,
                  username: authorProf.username,
                  displayName: authorProf.display_name,
                  avatarUrl: authorProf.avatar_url,
                  status: authorProf.status || 'online',
                  createdAt: authorProf.created_at,
                }
              : undefined,
          };

          setDmMessages((prev) => {
            const list = prev[newRow.conversation_id] || [];
            if (list.some((m) => m.id === incomingMsg.id)) return prev;
            return {
              ...prev,
              [newRow.conversation_id]: [...list, incomingMsg],
            };
          });

          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== newRow.conversation_id) return c;
              return {
                ...c,
                lastMessage: incomingMsg,
                unreadCount: (c.unreadCount || 0) + 1,
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser?.id]);

  // Load messages whenever active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;

    let isMounted = true;
    DMService.getMessages(activeConversationId).then((messages) => {
      if (isMounted) {
        setDmMessages((prev) => ({
          ...prev,
          [activeConversationId]: messages,
        }));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const totalUnreadDMs = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  }, [conversations]);

  const markConversationRead = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  const selectConversation = useCallback(
    (conversationId: string | null) => {
      setActiveConversationId(conversationId);
      if (conversationId) {
        markConversationRead(conversationId);
      }
    },
    [markConversationRead]
  );

  const sendDM = useCallback(
    async (conversationId: string, content: string) => {
      if (!content.trim() || !currentUser) return;

      const sent = await DMService.sendMessage(conversationId, currentUser, content);

      setDmMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), sent],
      }));

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, lastMessage: sent }
            : c
        )
      );
    },
    [currentUser]
  );

  const startConversationWithUser = useCallback(
    async (targetUser: User): Promise<string> => {
      if (!currentUser) return '';

      const convoId = await DMService.startConversation(currentUser, targetUser);

      setConversations((prev) => {
        if (prev.some((c) => c.id === convoId)) return prev;
        return [
          {
            id: convoId,
            participants: [targetUser],
            unreadCount: 0,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });

      selectConversation(convoId);
      return convoId;
    },
    [currentUser, selectConversation]
  );

  const addFriend = useCallback(
    async (username: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Sign in required' };

      const res = await FriendService.addFriendByUsername(currentUser.id, username);
      if (res.success && res.user) {
        const newFriend: Friend = {
          id: res.user.id,
          user: res.user,
          status: 'accepted',
          createdAt: new Date().toISOString(),
        };
        setFriends((prev) => {
          if (prev.some((f) => f.id === newFriend.id)) return prev;
          return [...prev, newFriend];
        });
      }
      return { success: res.success, error: res.error };
    },
    [currentUser]
  );

  const acceptFriendRequest = useCallback(
    async (friendId: string) => {
      if (!currentUser) return;
      await FriendService.acceptFriendRequest(currentUser.id, friendId);
      setFriends((prev) =>
        prev.map((f) => (f.id === friendId ? { ...f, status: 'accepted' as const } : f))
      );
    },
    [currentUser]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      if (!currentUser) return;
      await FriendService.removeFriend(currentUser.id, friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    },
    [currentUser]
  );

  return (
    <DMContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        dmMessages,
        friends,
        totalUnreadDMs,
        selectConversation,
        sendDM,
        startConversationWithUser,
        markConversationRead,
        acceptFriendRequest,
        addFriend,
        removeFriend,
      }}
    >
      {children}
    </DMContext.Provider>
  );
};

export const useDM = () => {
  const context = useContext(DMContext);
  if (!context) throw new Error('useDM must be used within a DMProvider');
  return context;
};
