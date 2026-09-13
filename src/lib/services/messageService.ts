import { supabase, isSupabaseConfigured } from '../supabase/client';
import { mockStore } from '../supabase/mockStore';
import { Message, Attachment, MessageReaction, User } from '../../types';

export const formatReactions = (rawReactions: any[]): MessageReaction[] => {
  if (!rawReactions || !Array.isArray(rawReactions)) return [];

  const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();

  for (const r of rawReactions) {
    if (!r || !r.emoji) continue;

    // Aggregated structure
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

    // Raw relational row from PostgreSQL
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

export class MessageService {
  /**
   * Fetches messages for a channel with authors, reactions, and attachments.
   */
  public static async getMessages(channelId: string): Promise<Message[]> {
    if (isSupabaseConfigured && supabase && channelId) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*, author:profiles(*), reactions:message_reactions(*), attachments(*)')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map((m: any) => ({
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
            attachments: (m.attachments || []).map((a: any) => ({
              id: a.id,
              fileName: a.file_name,
              fileUrl: a.file_url,
              fileSize: Number(a.file_size || 0),
              contentType: a.content_type,
            })),
          }));
        }
      } catch (err) {
        console.warn('[MessageService] getMessages error, checking fallback:', err);
      }
    }

    return mockStore.getMessages(channelId);
  }

  /**
   * Sends a message to a channel with optional attachments and reply parent.
   */
  public static async sendMessage(
    channelId: string,
    author: User,
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[]
  ): Promise<Message> {
    const cleanContent = content.trim();

    if (isSupabaseConfigured && supabase && author.id) {
      try {
        const { data: newMsg, error: msgErr } = await supabase
          .from('messages')
          .insert({
            channel_id: channelId,
            author_id: author.id,
            content: cleanContent,
            reply_to_id: replyToId || null,
          })
          .select('*, author:profiles(*)')
          .single();

        if (msgErr) throw msgErr;

        let savedAttachments: Attachment[] = [];
        if (attachments && attachments.length > 0 && newMsg?.id) {
          const insertPayloads = attachments.map((a) => ({
            message_id: newMsg.id,
            file_name: a.fileName,
            file_url: a.fileUrl,
            file_size: a.fileSize,
            content_type: a.contentType,
          }));

          const { data: attData } = await supabase
            .from('attachments')
            .insert(insertPayloads)
            .select('*');

          if (attData) {
            savedAttachments = attData.map((a: any) => ({
              id: a.id,
              fileName: a.file_name,
              fileUrl: a.file_url,
              fileSize: Number(a.file_size || 0),
              contentType: a.content_type,
            }));
          }
        }

        return {
          id: newMsg.id,
          channelId: newMsg.channel_id,
          authorId: newMsg.author_id,
          content: newMsg.content,
          createdAt: newMsg.created_at,
          isEdited: false,
          replyToId: newMsg.reply_to_id,
          reactions: [],
          attachments: savedAttachments.length > 0 ? savedAttachments : (attachments || []),
          author: newMsg.author
            ? {
                id: newMsg.author.id,
                username: newMsg.author.username,
                displayName: newMsg.author.display_name,
                avatarUrl: newMsg.author.avatar_url,
                bio: newMsg.author.bio,
                status: newMsg.author.status || 'online',
                createdAt: newMsg.author.created_at,
              }
            : author,
        };
      } catch (err) {
        console.warn('[MessageService] Supabase sendMessage failed, falling back:', err);
      }
    }

    const localMsg = mockStore.sendMessage(channelId, cleanContent, author.id, undefined, attachments);
    localMsg.author = author;
    if (replyToId) {
      localMsg.replyToId = replyToId;
    }
    return localMsg;
  }

  /**
   * Edits message content.
   */
  public static async editMessage(messageId: string, authorId: string, content: string): Promise<void> {
    const cleanContent = content.trim();
    if (!cleanContent) return;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('messages')
          .update({
            content: cleanContent,
            is_edited: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', messageId)
          .eq('author_id', authorId);
      } catch (err) {
        console.warn('[MessageService] editMessage error:', err);
      }
    }

    mockStore.editMessage(messageId, cleanContent);
  }

  /**
   * Deletes a message.
   */
  public static async deleteMessage(messageId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('messages').delete().eq('id', messageId);
      } catch (err) {
        console.warn('[MessageService] deleteMessage error:', err);
      }
    }

    mockStore.deleteMessage(messageId);
  }

  /**
   * Authoritative toggle reaction in Supabase.
   */
  public static async toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    if (isSupabaseConfigured && supabase && userId) {
      try {
        const { data: existing } = await supabase
          .from('message_reactions')
          .select('id')
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('emoji', emoji)
          .maybeSingle();

        if (existing) {
          await supabase.from('message_reactions').delete().eq('id', existing.id);
        } else {
          await supabase.from('message_reactions').insert({
            message_id: messageId,
            user_id: userId,
            emoji,
          });
        }
      } catch (err) {
        console.warn('[MessageService] toggleReaction error:', err);
      }
    }

    mockStore.toggleReaction(messageId, userId, emoji);
  }
}
