import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Message, Attachment, MessageReaction } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { mockStore } from '../../lib/supabase/mockStore';
import { MessageService, formatReactions } from '../../lib/services/messageService';
import { ReadStateService } from '../../lib/services/readStateService';
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

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const { activeChannel } = useServer();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const isProduction =
    (import.meta as any).env?.VITE_APP_ENV === 'production' ||
    (import.meta as any).env?.PROD;

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
        const loaded = await MessageService.getMessages(activeChannel.id);
        if (isMounted) {
          setMessages(loaded);
          // Update read marker for active channel
          if (currentUser && loaded.length > 0) {
            const latest = loaded[loaded.length - 1];
            ReadStateService.markAsRead(currentUser.id, {
              channelId: activeChannel.id,
              messageId: latest.id,
            });
          }
        }
      } catch (err) {
        console.error('[ChatContext] Error fetching messages:', err);
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    };

    fetchMessages();

    // Setup Realtime listener for messages & reactions
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

              // Query author profile
              const { data: authorProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newMsg.author_id)
                .maybeSingle();

              // Fetch any attachments
              const { data: attData } = await supabase
                .from('attachments')
                .select('*')
                .eq('message_id', newMsg.id);

              const formattedMsg: Message = {
                id: newMsg.id,
                channelId: newMsg.channel_id,
                authorId: newMsg.author_id,
                content: newMsg.content,
                createdAt: newMsg.created_at,
                isEdited: newMsg.is_edited,
                replyToId: newMsg.reply_to_id,
                reactions: [],
                attachments: (attData || []).map((a: any) => ({
                  id: a.id,
                  fileName: a.file_name,
                  fileUrl: a.file_url,
                  fileSize: Number(a.file_size || 0),
                  contentType: a.content_type,
                })),
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
                // Idempotent deduplication: replace any matching optimistic message
                const optimisticMatch = prev.find(
                  (m) =>
                    m.isOptimistic &&
                    m.authorId === formattedMsg.authorId &&
                    m.content === formattedMsg.content
                );

                if (optimisticMatch) {
                  return prev.map((m) => (m.id === optimisticMatch.id ? formattedMsg : m));
                }

                if (prev.some((m) => m.id === formattedMsg.id)) return prev;
                return [...prev, formattedMsg];
              });

              // Mark read if channel is active
              if (currentUser) {
                ReadStateService.markAsRead(currentUser.id, {
                  channelId: activeChannel.id,
                  messageId: newMsg.id,
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as any;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === updated.id
                    ? {
                        ...m,
                        content: updated.content,
                        isEdited: true,
                        updatedAt: updated.updated_at,
                      }
                    : m
                )
              );
            } else if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as any)?.id;
              if (deletedId) {
                setMessages((prev) => prev.filter((m) => m.id !== deletedId));
              }
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
              if (!newRec) return;

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
      if (isProduction) return;
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
        mockStore.subscribe('MESSAGE_DELETED', (deletedId: string) => {
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
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
  }, [activeChannel?.id, currentUser?.id]);

  const sendMessage = useCallback(
    async (content: string, replyToId?: string | null, attachments?: Attachment[]) => {
      if (!activeChannel || !currentUser) return;
      const trimmed = content.trim();
      if (!trimmed && (!attachments || attachments.length === 0)) return;

      const optimisticId = `optimistic-${Date.now()}`;
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
        const saved = await MessageService.sendMessage(
          activeChannel.id,
          currentUser,
          trimmed,
          replyToId,
          attachments
        );

        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? saved : m))
        );
      } catch (err) {
        console.error('[ChatContext] Failed to send message:', err);
        // Rollback optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    },
    [activeChannel, currentUser, replyingTo]
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!currentUser) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content, isEdited: true } : m))
      );
      await MessageService.editMessage(messageId, currentUser.id, content);
    },
    [currentUser]
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await MessageService.deleteMessage(messageId);
  }, []);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUser) return;

      // Optimistic reaction update
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

      await MessageService.toggleReaction(messageId, currentUser.id, emoji);
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
