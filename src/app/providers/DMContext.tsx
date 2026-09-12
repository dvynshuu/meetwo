import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, DMConversation, DMMessage, Friend } from '../../types';
import { mockStore } from '../../lib/supabase/mockStore';
import { useAuth } from './AuthContext';

const DM_CONVOS_KEY = 'mw:dm:conversations';
const DM_MESSAGES_KEY = 'mw:dm:messages';
const FRIENDS_KEY = 'mw:dm:friends';

interface DMContextType {
  conversations: DMConversation[];
  activeConversationId: string | null;
  activeConversation: DMConversation | null;
  dmMessages: Record<string, DMMessage[]>;
  friends: Friend[];
  totalUnreadDMs: number;
  selectConversation: (conversationId: string | null) => void;
  sendDM: (conversationId: string, content: string) => void;
  startConversationWithUser: (user: User) => string;
  markConversationRead: (conversationId: string) => void;
  addFriend: (username: string) => boolean;
  removeFriend: (friendId: string) => void;
  acceptFriendRequest: (friendId: string) => void;
}

const DMContext = createContext<DMContextType | undefined>(undefined);

export const DMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  // State initialization with localStorage fallback (empty arrays by default, no mock seed data)
  const [conversations, setConversations] = useState<DMConversation[]>(() => {
    try {
      const saved = localStorage.getItem(DM_CONVOS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dmMessages, setDmMessages] = useState<Record<string, DMMessage[]>>(() => {
    try {
      const saved = localStorage.getItem(DM_MESSAGES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [friends, setFriends] = useState<Friend[]>(() => {
    try {
      const saved = localStorage.getItem(FRIENDS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(DM_CONVOS_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.warn('Failed to save DM conversations:', e);
    }
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem(DM_MESSAGES_KEY, JSON.stringify(dmMessages));
    } catch (e) {
      console.warn('Failed to save DM messages:', e);
    }
  }, [dmMessages]);

  useEffect(() => {
    try {
      localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
    } catch (e) {
      console.warn('Failed to save friends list:', e);
    }
  }, [friends]);

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

  const selectConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);
    if (conversationId) {
      markConversationRead(conversationId);
    }
  }, [markConversationRead]);

  const sendDM = useCallback((conversationId: string, content: string) => {
    if (!content.trim()) return;
    const author: User = currentUser || {
      id: `user-${Date.now()}`,
      username: 'me',
      displayName: 'Me',
      status: 'online',
      createdAt: new Date().toISOString(),
    };

    const newMsg: DMMessage = {
      id: `dm-msg-${Date.now()}`,
      conversationId,
      authorId: author.id,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      author,
    };

    setDmMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMsg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: newMsg, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, [currentUser]);

  const startConversationWithUser = useCallback((user: User): string => {
    const author: User = currentUser || {
      id: `user-${Date.now()}`,
      username: 'me',
      displayName: 'Me',
      status: 'online',
      createdAt: new Date().toISOString(),
    };

    // Check if conversation already exists with this user
    const existing = conversations.find((c) =>
      c.participants.some((p) => p.id === user.id)
    );

    if (existing) {
      selectConversation(existing.id);
      return existing.id;
    }

    const newConvoId = `dm-${user.id}`;
    const newConvo: DMConversation = {
      id: newConvoId,
      participants: [author, user],
      unreadCount: 0,
      createdAt: new Date().toISOString(),
    };

    setConversations((prev) => [newConvo, ...prev]);
    selectConversation(newConvoId);
    return newConvoId;
  }, [currentUser, conversations, selectConversation]);

  const addFriend = useCallback((username: string): boolean => {
    const trimmed = username.trim().toLowerCase().replace(/^@/, '');
    if (!trimmed) return false;

    const allUsers = mockStore.getAllUsers();
    let user = allUsers.find(
      (u) => u.username.toLowerCase() === trimmed || u.displayName.toLowerCase() === trimmed
    );

    // If user not in local registry yet, register them dynamically
    if (!user) {
      user = {
        id: `user-${trimmed}`,
        username: trimmed,
        displayName: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${trimmed}`,
        status: 'online',
        createdAt: new Date().toISOString(),
      };
      mockStore.addUser(user);
    }

    if (friends.some((f) => f.user.id === user!.id)) return true;

    const newFriend: Friend = {
      id: `friend-${Date.now()}`,
      user,
      status: 'accepted',
      createdAt: new Date().toISOString(),
    };

    setFriends((prev) => [newFriend, ...prev]);
    return true;
  }, [friends]);

  const removeFriend = useCallback((friendId: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId && f.user.id !== friendId));
  }, []);

  const acceptFriendRequest = useCallback((friendId: string) => {
    setFriends((prev) =>
      prev.map((f) => (f.id === friendId ? { ...f, status: 'accepted' } : f))
    );
  }, []);

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
        addFriend,
        removeFriend,
        acceptFriendRequest,
      }}
    >
      {children}
    </DMContext.Provider>
  );
};

export const useDM = (): DMContextType => {
  const context = useContext(DMContext);
  if (!context) {
    throw new Error('useDM must be used within a DMProvider');
  }
  return context;
};
