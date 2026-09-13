import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Message, Attachment, MessageReaction } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { mockStore } from '../../lib/supabase/mockStore';
import { useAuth } from './AuthContext';
import { useServer } from './ServerContext';

interface ChatContextType {
  messages: Message[];
  isLoadingMessages: boolean;
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;
  sendMessage: (content: string, replyToId?: string | null, attachments?: Attachment[]) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
}

const formatReactions = (rawReactions: any[]): MessageReaction[] => {
  if (!rawReactions || !Array.isArray(rawReactions)) return [];

  const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();

  for (const r of rawReactions) {
    if (!r || !r.emoji) continue;

    // If it's already an aggregated reaction object: { emoji, count, userIds }
    if (Array.isArray(r.userIds)) {
      const existing = map.get(r.emoji);
      if (existing) {
        for (const uid of r.userIds) {
          if (uid && !existing.userIds.includes(uid)) {
            existing.userIds.push(uid);
          }
        }
        existing.count = existing.userIds.length;
      } else {
        map.set(r.emoji, {
          emoji: r.emoji,
          count: r.count || r.userIds.length,
          userIds: [...r.userIds],
        });
      }
      continue;
    }

    // It's a raw Supabase relational row: { id, message_id, user_id, emoji }
    const uid = r.user_id || r.userId;
    const existing = map.get(r.emoji);
    if (existing) {
      if (uid && !existing.userIds.includes(uid)) {
        existing.userIds.push(uid);
        existing.count += 1;
      }
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        userIds: uid ? [uid] : [],
      });
    }
  }

  return Array.from(map.values());
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { activeChannel } = useServer();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Load messages whenever active channel changes
  useEffect(() => {
    if (!activeChannel || activeChannel.type === 'voice') {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);

    const fetchMessages = async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase
            .from('messages')
            .select('*, author:profiles(*), reactions:message_reactions(*), attachments(*)')
            .eq('channel_id', activeChannel.id)
            .order('created_at', { ascending: true });

          if (error) throw error;
          if (isMounted && data) {
            setMessages(
              data.map((m: any) => ({
                id: m.id,
                channelId: m.channel_id,
                authorId: m.author_id,
                content: m.content,
                createdAt: m.created_at,
                updatedAt: m.updated_at,
                isEdited: m.is_edited,
                replyToId: m.reply_to_id,
                author: m.author
                  ? {
                      id: m.author.id,
                      username: m.author.username,
                      displayName: m.author.display_name,
                      avatarUrl: m.author.avatar_url,
                      bio: m.author.bio,
                      status: m.author.status || 'online',
                      createdAt: m.author.created_at,
                    }
                  : undefined,
                reactions: formatReactions(m.reactions),
                attachments: m.attachments || [],
              }))
            );
          }
        } else {
          // Demo mode
          const localMessages = mockStore.getMessages(activeChannel.id);
          if (isMounted) {
            setMessages(localMessages);
          }
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    };

    fetchMessages();

    // Setup Realtime listener
    if (isSupabaseConfigured && supabase) {
      const channelSub = supabase
        .channel(`chat:${activeChannel.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${activeChannel.id}`,
          },
          async (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new as any;
              if (!supabase) return;
              const { data: authorProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newMsg.author_id)
                .single();

              const formattedMsg: Message = {
                id: newMsg.id,
                channelId: newMsg.channel_id,
                authorId: newMsg.author_id,
                content: newMsg.content,
                createdAt: newMsg.created_at,
                isEdited: newMsg.is_edited,
                replyToId: newMsg.reply_to_id,
                reactions: [],
                attachments: [],
                author: authorProfile
                  ? {
                      id: authorProfile.id,
                      username: authorProfile.username,
                      displayName: authorProfile.display_name,
                      avatarUrl: authorProfile.avatar_url,
                      bio: authorProfile.bio,
                      status: authorProfile.status || 'online',
                      createdAt: authorProfile.created_at,
                    }
                  : undefined,
              };

              setMessages((prev) => {
                if (prev.some((m) => m.id === formattedMsg.id)) return prev;
                return [...prev, formattedMsg];
              });
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as any;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === updated.id
                    ? { ...m, content: updated.content, isEdited: true, updatedAt: updated.updated_at }
                    : m
                )
              );
            } else if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as any).id;
              setMessages((prev) => prev.filter((m) => m.id !== deletedId));
            }
          }
        )
        .subscribe();

      const reactionsSub = supabase
        .channel(`reactions:${activeChannel.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions',
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newRec = payload.new as any;
              if (!newRec || newRec.user_id === currentUser?.id) return;
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== newRec.message_id) return msg;
                  const curReactions = msg.reactions || [];
                  const existing = curReactions.find((r) => r.emoji === newRec.emoji);
                  if (existing) {
                    const userIds = Array.isArray(existing.userIds) ? existing.userIds : [];
                    if (userIds.includes(newRec.user_id)) return msg;
                    const nextUserIds = [...userIds, newRec.user_id];
                    return {
                      ...msg,
                      reactions: curReactions.map((r) =>
                        r.emoji === newRec.emoji
                          ? { ...r, count: nextUserIds.length, userIds: nextUserIds }
                          : r
                      ),
                    };
                  } else {
                    return {
                      ...msg,
                      reactions: [
                        ...curReactions,
                        { emoji: newRec.emoji, count: 1, userIds: [newRec.user_id] },
                      ],
                    };
                  }
                })
              );
            } else if (payload.eventType === 'DELETE') {
              const oldRec = payload.old as any;
              if (oldRec && oldRec.message_id && oldRec.emoji && oldRec.user_id) {
                if (oldRec.user_id === currentUser?.id) return;
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== oldRec.message_id) return msg;
                    const curReactions = msg.reactions || [];
                    const existing = curReactions.find((r) => r.emoji === oldRec.emoji);
                    if (!existing) return msg;
                    const userIds = Array.isArray(existing.userIds) ? existing.userIds : [];
                    const nextUserIds = userIds.filter((id) => id !== oldRec.user_id);
                    if (nextUserIds.length === 0) {
                      return {
                        ...msg,
                        reactions: curReactions.filter((r) => r.emoji !== oldRec.emoji),
                      };
                    }
                    return {
                      ...msg,
                      reactions: curReactions.map((r) =>
                        r.emoji === oldRec.emoji
                          ? { ...r, count: nextUserIds.length, userIds: nextUserIds }
                          : r
                      ),
                    };
                  })
                );
              }
            }
          }
        )
        .subscribe();

      return () => {
        isMounted = false;
        if (supabase) {
          supabase.removeChannel(channelSub);
          supabase.removeChannel(reactionsSub);
        }
      };
    } else {
      // Demo store multi-tab subscriptions
      const unsubs = [
        mockStore.subscribe('NEW_MESSAGE', (newMsg: Message) => {
          if (newMsg.channelId === activeChannel.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }),
        mockStore.subscribe('MESSAGE_EDITED', (editedMsg: Message) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === editedMsg.id ? { ...m, ...editedMsg } : m))
          );
        }),
        mockStore.subscribe('MESSAGE_DELETED', ({ messageId }: { messageId: string }) => {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        }),
        mockStore.subscribe('REACTION_TOGGLED', ({ messageId, reactions }: any) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
          );
        }),
      ];

      return () => {
        isMounted = false;
        unsubs.forEach((u) => u());
      };
    }
  }, [activeChannel?.id, activeChannel?.type]);

  const sendMessage = useCallback(
    async (content: string, replyToId?: string | null, attachments?: Attachment[]) => {
      if (!activeChannel || !currentUser || (!content.trim() && (!attachments || attachments.length === 0))) {
        return;
      }

      const trimmed = content.trim();
      const optimisticId = `temp-${Date.now()}`;
      const optimisticMsg: Message = {
        id: optimisticId,
        channelId: activeChannel.id,
        authorId: currentUser.id,
        content: trimmed,
        replyToId: replyToId || null,
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              authorName: replyingTo.author?.displayName || replyingTo.author?.username || 'User',
              content: replyingTo.content.slice(0, 60),
            }
          : null,
        attachments: attachments || [],
        reactions: [],
        createdAt: new Date().toISOString(),
        author: currentUser,
        isOptimistic: true,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setReplyingTo(null);

      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase
            .from('messages')
            .insert({
              channel_id: activeChannel.id,
              author_id: currentUser.id,
              content: trimmed,
              reply_to_id: replyToId || null,
            })
            .select('*, author:profiles(*)')
            .single();

          if (error) throw error;
          if (data) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === optimisticId
                  ? {
                      id: data.id,
                      channelId: data.channel_id,
                      authorId: data.author_id,
                      content: data.content,
                      createdAt: data.created_at,
                      author: currentUser,
                      replyToId: data.reply_to_id,
                      isOptimistic: false,
                    }
                  : m
              )
            );
          }
        } else {
          // Demo mode send
          const actualMsg = mockStore.sendMessage(activeChannel.id, trimmed, currentUser.id, replyingTo, attachments);
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticId ? actualMsg : m))
          );
        }
      } catch (err) {
        console.error('Failed to send message:', err);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    },
    [activeChannel, currentUser, replyingTo]
  );

  const editMessage = useCallback(async (messageId: string, content: string) => {
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('messages')
        .update({ content, is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', messageId);
    } else {
      mockStore.editMessage(messageId, content);
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, content, isEdited: true } : m))
    );
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('messages').delete().eq('id', messageId);
    } else {
      mockStore.deleteMessage(messageId);
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUser) return;
      if (isSupabaseConfigured && supabase) {
        // Optimistic UI update
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== messageId) return msg;
            const curReactions = msg.reactions || [];
            const existing = curReactions.find((r) => r.emoji === emoji);
            let nextReactions: MessageReaction[];

            if (existing) {
              const userIds = Array.isArray(existing.userIds) ? existing.userIds : [];
              const hasReacted = userIds.includes(currentUser.id);
              if (hasReacted) {
                const nextUserIds = userIds.filter((id) => id !== currentUser.id);
                if (nextUserIds.length === 0) {
                  nextReactions = curReactions.filter((r) => r.emoji !== emoji);
                } else {
                  nextReactions = curReactions.map((r) =>
                    r.emoji === emoji
                      ? { ...r, count: nextUserIds.length, userIds: nextUserIds }
                      : r
                  );
                }
              } else {
                const nextUserIds = [...userIds, currentUser.id];
                nextReactions = curReactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: nextUserIds.length, userIds: nextUserIds }
                    : r
                );
              }
            } else {
              nextReactions = [
                ...curReactions,
                { emoji, count: 1, userIds: [currentUser.id] },
              ];
            }
            return { ...msg, reactions: nextReactions };
          })
        );

        try {
          // Toggle reaction in DB
          const { data: existing } = await supabase
            .from('message_reactions')
            .select('id')
            .eq('message_id', messageId)
            .eq('user_id', currentUser.id)
            .eq('emoji', emoji)
            .maybeSingle();

          if (existing) {
            await supabase.from('message_reactions').delete().eq('id', existing.id);
          } else {
            await supabase.from('message_reactions').insert({
              message_id: messageId,
              user_id: currentUser.id,
              emoji,
            });
          }
        } catch (err) {
          console.error('Error toggling reaction in database:', err);
        }
      } else {
        const updated = mockStore.toggleReaction(messageId, emoji, currentUser.id);
        if (updated) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, reactions: updated.reactions } : m))
          );
        }
      }
    },
    [currentUser]
  );

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoadingMessages,
        replyingTo,
        setReplyingTo,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
