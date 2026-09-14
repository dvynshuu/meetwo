import { User } from '../../types';
import { supabase, isSupabaseConfigured } from '../supabase/client';
import { threadRepository, ThreadReplyItem } from '../repositories';

export type ThreadReply = ThreadReplyItem;

export class ThreadService {
  /**
   * Fetches replies for a given parent message.
   */
  public static async getThreadReplies(parentMessageId: string, channelId: string): Promise<ThreadReply[]> {
    return threadRepository.getReplies(parentMessageId, channelId);
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
    return threadRepository.sendReply(parentMessageId, channelId, author, content);
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

    let channel: any = null;

    supabase
      .from('threads')
      .select('id')
      .eq('parent_message_id', parentMessageId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id && supabase) {
          const threadId = data.id;
          channel = supabase
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
