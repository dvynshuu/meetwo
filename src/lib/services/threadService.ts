import { supabase, isSupabaseConfigured } from '../supabase/client';
import { User } from '../../types';

export interface ThreadReply {
  id: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
}

// In-memory fallback cache for development/offline testing
const devThreadCache = new Map<string, ThreadReply[]>();

export class ThreadService {
  /**
   * Fetches replies for a given parent message.
   */
  public static async getThreadReplies(parentMessageId: string, channelId: string): Promise<ThreadReply[]> {
    if (isSupabaseConfigured && supabase && parentMessageId) {
      try {
        // 1. Find or verify thread record for parent message
        let { data: thread } = await supabase
          .from('threads')
          .select('id')
          .eq('parent_message_id', parentMessageId)
          .maybeSingle();

        if (thread) {
          const { data: messages, error } = await supabase
            .from('thread_messages')
            .select('*, author:profiles(*)')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: true });

          if (!error && messages) {
            return messages.map((m: any) => ({
              id: m.id,
              authorId: m.author_id,
              authorName: m.author?.display_name || m.author?.username || 'Member',
              avatarUrl: m.author?.avatar_url,
              content: m.content,
              createdAt: m.created_at,
            }));
          }
        }
      } catch (err) {
        console.warn('[ThreadService] Supabase thread query failed, checking dev cache:', err);
      }
    }

    return devThreadCache.get(parentMessageId) || [];
  }

  /**
   * Posts a reply into a message thread.
   */
  public static async sendThreadReply(
    parentMessageId: string,
    channelId: string,
    author: User,
    content: string
  ): Promise<ThreadReply> {
    const cleanContent = content.trim();
    if (!cleanContent) throw new Error('Reply content cannot be empty.');

    const tempId = `trep-${Date.now()}`;
    const optimisticReply: ThreadReply = {
      id: tempId,
      authorId: author.id,
      authorName: author.displayName || author.username,
      avatarUrl: author.avatarUrl,
      content: cleanContent,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && author.id) {
      try {
        // 1. Ensure thread record exists
        let { data: thread } = await supabase
          .from('threads')
          .select('id')
          .eq('parent_message_id', parentMessageId)
          .maybeSingle();

        if (!thread) {
          const { data: newThread, error: threadErr } = await supabase
            .from('threads')
            .insert({
              parent_message_id: parentMessageId,
              channel_id: channelId,
            })
            .select('id')
            .single();

          if (threadErr && !threadErr.message?.includes('duplicate')) {
            throw threadErr;
          }
          thread = newThread;
        }

        if (thread?.id) {
          // 2. Insert reply message
          const { data: newMsg, error: msgErr } = await supabase
            .from('thread_messages')
            .insert({
              thread_id: thread.id,
              author_id: author.id,
              content: cleanContent,
            })
            .select('*, author:profiles(*)')
            .single();

          if (!msgErr && newMsg) {
            return {
              id: newMsg.id,
              authorId: newMsg.author_id,
              authorName: newMsg.author?.display_name || author.displayName || author.username,
              avatarUrl: newMsg.author?.avatar_url || author.avatarUrl,
              content: newMsg.content,
              createdAt: newMsg.created_at,
            };
          }
        }
      } catch (err) {
        console.warn('[ThreadService] Send thread reply failed, saving to dev cache:', err);
      }
    }

    // Dev fallback
    const list = devThreadCache.get(parentMessageId) || [];
    list.push(optimisticReply);
    devThreadCache.set(parentMessageId, list);

    return optimisticReply;
  }

  /**
   * Subscribes to real-time incoming thread replies.
   */
  public static subscribeToThread(
    parentMessageId: string,
    onNewReply: (reply: ThreadReply) => void
  ): () => void {
    if (!isSupabaseConfigured || !supabase) {
      return () => {};
    }

    let threadId: string | null = null;
    let channel: any = null;

    supabase
      .from('threads')
      .select('id')
      .eq('parent_message_id', parentMessageId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          threadId = data.id;
          channel = supabase!
            .channel(`thread:${threadId}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'thread_messages',
                filter: `thread_id=eq.${threadId}`,
              },
              async (payload) => {
                const newRow = payload.new as any;
                if (!newRow) return;

                const { data: profile } = await supabase!
                  .from('profiles')
                  .select('*')
                  .eq('id', newRow.author_id)
                  .maybeSingle();

                onNewReply({
                  id: newRow.id,
                  authorId: newRow.author_id,
                  authorName: profile?.display_name || profile?.username || 'Member',
                  avatarUrl: profile?.avatar_url,
                  content: newRow.content,
                  createdAt: newRow.created_at,
                });
              }
            )
            .subscribe();
        }
      });

    return () => {
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }
}
