import { supabase, isSupabaseConfigured } from '../supabase/client';
import { mockStore } from '../supabase/mockStore';
import { SearchResult } from '../../types';

export interface GlobalSearchFilters {
  query: string;
  fromUser?: string;
  inChannel?: string;
}

export interface DetailedSearchResult extends SearchResult {
  messageContent?: string;
  authorName?: string;
  authorAvatar?: string;
  timestamp?: string;
}

export class SearchService {
  /**
   * Searches across real messages, channels, and forum posts in Supabase.
   */
  public static async search(
    filters: GlobalSearchFilters,
    accessibleChannelIds: string[] = []
  ): Promise<DetailedSearchResult[]> {
    const cleanQuery = filters.query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const results: DetailedSearchResult[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Search Messages in accessible channels
        let queryBuilder = supabase
          .from('messages')
          .select(`
            id,
            channel_id,
            content,
            created_at,
            author:profiles(id, username, display_name, avatar_url),
            channel:channels(id, name, server_id)
          `)
          .ilike('content', `%${cleanQuery}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (accessibleChannelIds.length > 0) {
          queryBuilder = queryBuilder.in('channel_id', accessibleChannelIds);
        }

        const { data: messagesData } = await queryBuilder;

        if (messagesData) {
          for (const m of messagesData) {
            const author = (m as any).author;
            const channel = (m as any).channel;

            // Optional filter by author
            if (
              filters.fromUser &&
              !author?.username?.toLowerCase().includes(filters.fromUser.toLowerCase()) &&
              !author?.display_name?.toLowerCase().includes(filters.fromUser.toLowerCase())
            ) {
              continue;
            }

            // Optional filter by channel
            if (
              filters.inChannel &&
              !channel?.name?.toLowerCase().includes(filters.inChannel.toLowerCase())
            ) {
              continue;
            }

            results.push({
              id: m.id,
              type: 'message',
              title: author?.display_name || author?.username || 'Member',
              subtitle: m.content,
              channelId: m.channel_id,
              serverId: channel?.server_id,
              messageContent: m.content,
              authorName: author?.display_name || author?.username,
              authorAvatar: author?.avatar_url,
              timestamp: m.created_at,
            });
          }
        }

        // 2. Search Channels
        const { data: channelsData } = await supabase
          .from('channels')
          .select('id, name, type, topic, server_id')
          .ilike('name', `%${cleanQuery}%`)
          .limit(6);

        if (channelsData) {
          for (const c of channelsData) {
            results.push({
              id: c.id,
              type: 'channel',
              title: `#${c.name}`,
              subtitle: c.topic || `${c.type} channel`,
              channelId: c.id,
              serverId: c.server_id,
            });
          }
        }

        // 3. Search Forum Posts
        const { data: forumData } = await supabase
          .from('forum_posts')
          .select('id, channel_id, title, content, created_at, author:profiles(display_name, username)')
          .or(`title.ilike.%${cleanQuery}%,content.ilike.%${cleanQuery}%`)
          .limit(6);

        if (forumData) {
          for (const f of forumData) {
            results.push({
              id: f.id,
              type: 'message',
              title: `[Forum] ${f.title}`,
              subtitle: f.content.slice(0, 100),
              channelId: f.channel_id,
              messageContent: f.content,
              authorName: (f.author as any)?.display_name || (f.author as any)?.username,
              timestamp: f.created_at,
            });
          }
        }
      } catch (err) {
        console.warn('[SearchService] Supabase global search error:', err);
      }
    }

    // Fallback: If no results found from Supabase or if Supabase is not configured, search mockStore
    if (results.length === 0) {
      try {
        const allChannels = mockStore.getChannels();
        const channelsToSearch =
          accessibleChannelIds.length > 0
            ? allChannels.filter((c) => accessibleChannelIds.includes(c.id))
            : allChannels;

        for (const ch of channelsToSearch) {
          if (filters.inChannel && !ch.name.toLowerCase().includes(filters.inChannel.toLowerCase())) {
            continue;
          }

          // Search channel messages
          const msgs = mockStore.getMessages(ch.id);
          for (const m of msgs) {
            const matchesQuery = (m.content || '').toLowerCase().includes(cleanQuery);
            const author = m.author?.displayName || m.author?.username || '';
            const matchesUser = filters.fromUser
              ? author.toLowerCase().includes(filters.fromUser.toLowerCase())
              : true;

            if (matchesQuery && matchesUser) {
              results.push({
                id: m.id,
                type: 'message',
                title: author || 'Member',
                subtitle: m.content,
                channelId: ch.id,
                serverId: ch.serverId,
                messageContent: m.content,
                authorName: author,
                authorAvatar: m.author?.avatarUrl,
                timestamp: m.createdAt,
              });
            }
          }

          // Search forum posts
          if (ch.type === 'forum') {
            const posts = mockStore.getForumPosts(ch.id);
            for (const p of posts) {
              const matchesPost =
                (p.title || '').toLowerCase().includes(cleanQuery) ||
                (p.content || '').toLowerCase().includes(cleanQuery);
              if (matchesPost) {
                results.push({
                  id: p.id,
                  type: 'message',
                  title: `[Forum] ${p.title}`,
                  subtitle: p.content.slice(0, 100),
                  channelId: ch.id,
                  serverId: ch.serverId,
                  messageContent: p.content,
                  authorName: p.author?.displayName || p.author?.username,
                  timestamp: p.createdAt,
                });
              }
            }
          }
        }
      } catch {}
    }

    return results;
  }
}

