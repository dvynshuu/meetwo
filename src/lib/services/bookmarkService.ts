import { supabase, isSupabaseConfigured } from '../supabase/client';
import { mockStore } from '../supabase/mockStore';
import { Bookmark, Message } from '../../types';

export class BookmarkService {
  /**
   * Fetches all saved messages for a user with joined message content and author.
   */
  public static async getBookmarks(userId: string): Promise<Bookmark[]> {
    if (isSupabaseConfigured && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('bookmarks')
          .select(`
            id,
            user_id,
            message_id,
            channel_name,
            created_at,
            message:messages(
              id,
              channel_id,
              author_id,
              content,
              created_at,
              is_edited,
              author:profiles(*)
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data
            .filter((row: any) => row.message)
            .map((row: any) => ({
              id: row.id,
              userId: row.user_id,
              messageId: row.message_id,
              channelName: row.channel_name || 'chat',
              createdAt: row.created_at,
              message: {
                id: row.message.id,
                channelId: row.message.channel_id,
                authorId: row.message.author_id,
                content: row.message.content,
                createdAt: row.message.created_at,
                isEdited: row.message.is_edited,
                author: row.message.author
                  ? {
                      id: row.message.author.id,
                      username: row.message.author.username,
                      displayName: row.message.author.display_name,
                      avatarUrl: row.message.author.avatar_url,
                      status: row.message.author.status || 'online',
                      createdAt: row.message.author.created_at,
                    }
                  : undefined,
              },
            }));
        }
      } catch (err) {
        console.warn('[BookmarkService] Supabase query failed, checking fallback:', err);
      }
    }

    // Isolated Dev / Demo fallback
    return mockStore.getBookmarks();
  }

  /**
   * Saves or removes a bookmark for a message. Returns true if added, false if removed.
   */
  public static async toggleBookmark(
    userId: string,
    message: Message,
    channelName: string = 'general'
  ): Promise<boolean> {
    if (isSupabaseConfigured && supabase && userId) {
      try {
        // Check if already bookmarked
        const { data: existing } = await supabase
          .from('bookmarks')
          .select('id')
          .eq('user_id', userId)
          .eq('message_id', message.id)
          .maybeSingle();

        if (existing) {
          // Remove bookmark
          await supabase.from('bookmarks').delete().eq('id', existing.id);
          mockStore.toggleBookmark(message, channelName);
          return false;
        } else {
          // Insert bookmark
          await supabase.from('bookmarks').insert({
            user_id: userId,
            message_id: message.id,
            channel_name: channelName,
          });
          mockStore.toggleBookmark(message, channelName);
          return true;
        }
      } catch (err) {
        console.warn('[BookmarkService] Toggle failed in Supabase:', err);
      }
    }

    // Dev / Demo fallback
    return mockStore.toggleBookmark(message, channelName);
  }

  /**
   * Checks whether a message is bookmarked by user.
   */
  public static async isBookmarked(userId: string, messageId: string): Promise<boolean> {
    if (isSupabaseConfigured && supabase && userId) {
      try {
        const { data } = await supabase
          .from('bookmarks')
          .select('id')
          .eq('user_id', userId)
          .eq('message_id', messageId)
          .maybeSingle();
        return Boolean(data);
      } catch {}
    }

    return mockStore.getBookmarks().some((b) => b.messageId === messageId);
  }
}
