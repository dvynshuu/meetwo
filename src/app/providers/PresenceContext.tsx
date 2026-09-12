import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TypingUser, UserStatus } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { mockStore } from '../../lib/supabase/mockStore';
import { useAuth } from './AuthContext';

interface PresenceContextType {
  typingUsers: TypingUser[];
  sendTyping: (channelId: string) => void;
  getUserStatus: (userId: string) => UserStatus;
  onlineUserIds: Set<string>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [typingMap, setTypingMap] = useState<Map<string, TypingUser>>(new Map());
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map());

  // Clean up typing indicators older than 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingMap((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [key, user] of next.entries()) {
          if (now - user.timestamp > 3000) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Listen to typing & presence events
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const presenceChannel = supabase.channel('global_presence', {
        config: { presence: { key: currentUser?.id || 'anon' } },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState();
          const newStatuses = new Map<string, UserStatus>();
          for (const key of Object.keys(state)) {
            const presence = state[key]?.[0] as any;
            if (presence?.userId) {
              newStatuses.set(presence.userId, presence.status || 'online');
            }
          }
          setUserStatuses(newStatuses);
        })
        .on('broadcast', { event: 'user_typing' }, ({ payload }) => {
          if (payload.userId !== currentUser?.id) {
            setTypingMap((prev) => {
              const next = new Map(prev);
              next.set(payload.userId, {
                userId: payload.userId,
                username: payload.username,
                channelId: payload.channelId,
                timestamp: Date.now(),
              });
              return next;
            });
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && currentUser) {
            await presenceChannel.track({
              userId: currentUser.id,
              username: currentUser.username,
              status: currentUser.status,
            });
          }
        });

      return () => {
        if (supabase) {
          supabase.removeChannel(presenceChannel);
        }
      };
    } else {
      // Local/Demo cross-tab listener
      const unsubs = [
        mockStore.subscribe('USER_TYPING', (payload: any) => {
          if (payload.userId !== currentUser?.id) {
            setTypingMap((prev) => {
              const next = new Map(prev);
              next.set(payload.userId, {
                userId: payload.userId,
                username: payload.username,
                channelId: payload.channelId,
                timestamp: Date.now(),
              });
              return next;
            });
          }
        }),
      ];

      return () => unsubs.forEach((u) => u());
    }
  }, [currentUser?.id, currentUser?.status]);

  const sendTyping = useCallback(
    (channelId: string) => {
      if (!currentUser) return;

      const payload = {
        userId: currentUser.id,
        username: currentUser.displayName || currentUser.username,
        channelId,
      };

      if (isSupabaseConfigured && supabase) {
        supabase.channel('global_presence').send({
          type: 'broadcast',
          event: 'user_typing',
          payload,
        });
      } else {
        mockStore.emit('USER_TYPING', payload);
      }
    },
    [currentUser]
  );

  const getUserStatus = useCallback(
    (userId: string): UserStatus => {
      if (userId === currentUser?.id) {
        return currentUser.status || 'online';
      }
      return userStatuses.get(userId) || 'online';
    },
    [currentUser, userStatuses]
  );

  const typingUsers = Array.from(typingMap.values());
  const onlineUserIds = new Set(userStatuses.keys());

  return (
    <PresenceContext.Provider
      value={{
        typingUsers,
        sendTyping,
        getUserStatus,
        onlineUserIds,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) throw new Error('usePresence must be used within a PresenceProvider');
  return context;
};
