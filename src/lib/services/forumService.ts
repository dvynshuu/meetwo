import { supabase, isSupabaseConfigured } from '../supabase/client';
import { mockStore } from '../supabase/mockStore';
import { ForumPost, User } from '../../types';

export interface ForumReply {
  id: string;
  authorId: string;
  authorName: string;
  avatarUrl: string;
  content: string;
  createdAt: string;
  likes: number;
}

export class ForumService {
  /**
   * Fetches all forum posts for a given channel.
   */
  public static async getPosts(channelId: string): Promise<ForumPost[]> {
    if (isSupabaseConfigured && supabase && channelId) {
      try {
        const { data, error } = await supabase
          .from('forum_posts')
          .select(`
            *,
            author:profiles(*),
            replies:forum_replies(id)
          `)
          .eq('channel_id', channelId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((p: any) => ({
            id: p.id,
            channelId: p.channel_id,
            authorId: p.author_id,
            title: p.title,
            content: p.content,
            tags: Array.isArray(p.tags) ? p.tags : [],
            repliesCount: Array.isArray(p.replies) ? p.replies.length : 0,
            isSolved: Boolean(p.is_solved),
            createdAt: p.created_at,
            author: p.author
              ? {
                  id: p.author.id,
                  username: p.author.username,
                  displayName: p.author.display_name,
                  avatarUrl: p.author.avatar_url,
                  status: p.author.status || 'online',
                  createdAt: p.author.created_at,
                }
              : undefined,
          }));
        }
      } catch (err) {
        console.warn('[ForumService] Supabase getPosts failed, checking dev fallback:', err);
      }
    }

    return mockStore.getForumPosts(channelId);
  }

  /**
   * Creates a new forum post.
   */
  public static async createPost(
    channelId: string,
    author: User,
    title: string,
    content: string,
    tags: string[] = []
  ): Promise<ForumPost> {
    if (isSupabaseConfigured && supabase && author.id) {
      try {
        const { data, error } = await supabase
          .from('forum_posts')
          .insert({
            channel_id: channelId,
            author_id: author.id,
            title: title.trim(),
            content: content.trim(),
            tags,
            is_solved: false,
          })
          .select('*, author:profiles(*)')
          .single();

        if (!error && data) {
          return {
            id: data.id,
            channelId: data.channel_id,
            authorId: data.author_id,
            title: data.title,
            content: data.content,
            tags: data.tags || [],
            repliesCount: 0,
            isSolved: false,
            createdAt: data.created_at,
            author: data.author
              ? {
                  id: data.author.id,
                  username: data.author.username,
                  displayName: data.author.display_name,
                  avatarUrl: data.author.avatar_url,
                  status: data.author.status || 'online',
                  createdAt: data.author.created_at,
                }
              : author,
          };
        }
      } catch (err) {
        console.warn('[ForumService] Create post failed, using dev store:', err);
      }
    }

    const post = mockStore.createForumPost(channelId, author.id, title, content, tags);
    return { ...post, author };
  }

  /**
   * Fetches replies for a specific forum post.
   */
  public static async getReplies(postId: string): Promise<ForumReply[]> {
    if (isSupabaseConfigured && supabase && postId) {
      try {
        const { data, error } = await supabase
          .from('forum_replies')
          .select('*, author:profiles(*)')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map((r: any) => ({
            id: r.id,
            authorId: r.author_id,
            authorName: r.author?.display_name || r.author?.username || 'Member',
            avatarUrl: r.author?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.author_id}`,
            content: r.content,
            createdAt: r.created_at,
            likes: 0,
          }));
        }
      } catch (err) {
        console.warn('[ForumService] getReplies failed:', err);
      }
    }

    return [];
  }

  /**
   * Adds a reply to a forum post.
   */
  public static async addReply(postId: string, author: User, content: string): Promise<ForumReply> {
    if (isSupabaseConfigured && supabase && author.id) {
      try {
        const { data, error } = await supabase
          .from('forum_replies')
          .insert({
            post_id: postId,
            author_id: author.id,
            content: content.trim(),
          })
          .select('*, author:profiles(*)')
          .single();

        if (!error && data) {
          return {
            id: data.id,
            authorId: data.author_id,
            authorName: data.author?.display_name || author.displayName || author.username,
            avatarUrl: data.author?.avatar_url || author.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${data.author_id}`,
            content: data.content,
            createdAt: data.created_at,
            likes: 0,
          };
        }
      } catch (err) {
        console.warn('[ForumService] Add reply failed:', err);
      }
    }

    return {
      id: `rep-${Date.now()}`,
      authorId: author.id,
      authorName: author.displayName || author.username,
      avatarUrl: author.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${author.id}`,
      content: content.trim(),
      createdAt: 'Just now',
      likes: 0,
    };
  }

  /**
   * Marks a forum post as solved.
   */
  public static async markSolved(postId: string, isSolved: boolean): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('forum_posts')
          .update({ is_solved: isSolved, updated_at: new Date().toISOString() })
          .eq('id', postId);
      } catch {}
    }
  }
}
