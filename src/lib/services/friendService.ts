import { supabase, isSupabaseConfigured } from '../supabase/client';
import { Friend, User } from '../../types';

export class FriendService {
  /**
   * Fetches all friends and pending requests for the user.
   */
  public static async getFriends(userId: string): Promise<Friend[]> {
    if (isSupabaseConfigured && supabase && userId) {
      try {
        const { data: friendsData, error: friendsErr } = await supabase
          .from('friends')
          .select('*, friend:profiles!friends_friend_id_fkey(*)')
          .eq('user_id', userId);

        if (!friendsErr && friendsData) {
          return friendsData.map((f: any) => ({
            id: f.friend?.id || f.friend_id,
            status: f.status || 'accepted',
            createdAt: f.created_at,
            user: {
              id: f.friend?.id || f.friend_id,
              username: f.friend?.username || 'member',
              displayName: f.friend?.display_name || f.friend?.username || 'Member',
              avatarUrl: f.friend?.avatar_url,
              status: f.friend?.status || 'online',
              createdAt: f.friend?.created_at,
            },
          }));
        }
      } catch (err) {
        console.warn('[FriendService] getFriends error:', err);
      }
    }

    try {
      const saved = localStorage.getItem('mw:dm:friends');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Searches existing user profiles in Supabase to add friends or start conversations.
   */
  public static async searchUsers(query: string, currentUserId: string): Promise<User[]> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
          .neq('id', currentUserId)
          .limit(10);

        if (!error && data) {
          return data.map((p: any) => ({
            id: p.id,
            username: p.username,
            displayName: p.display_name,
            avatarUrl: p.avatar_url,
            bio: p.bio,
            status: p.status || 'online',
            createdAt: p.created_at,
          }));
        }
      } catch (err) {
        console.warn('[FriendService] searchUsers error:', err);
      }
    }

    return [];
  }

  /**
   * Adds or requests a friend by username.
   */
  public static async addFriendByUsername(
    currentUserId: string,
    targetUsername: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanName = targetUsername.trim();
    if (!cleanName) return { success: false, error: 'Please enter a username.' };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: targetProfile, error: searchErr } = await supabase
          .from('profiles')
          .select('*')
          .ilike('username', cleanName)
          .maybeSingle();

        if (searchErr || !targetProfile) {
          return { success: false, error: `User "@${cleanName}" was not found.` };
        }

        if (targetProfile.id === currentUserId) {
          return { success: false, error: 'You cannot add yourself as a friend.' };
        }

        // Add to friends table
        await supabase.from('friends').upsert([
          { user_id: currentUserId, friend_id: targetProfile.id, status: 'accepted' },
          { user_id: targetProfile.id, friend_id: currentUserId, status: 'accepted' },
        ]);

        const friendUser: User = {
          id: targetProfile.id,
          username: targetProfile.username,
          displayName: targetProfile.display_name,
          avatarUrl: targetProfile.avatar_url,
          status: targetProfile.status || 'online',
          createdAt: targetProfile.created_at,
        };

        return { success: true, user: friendUser };
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to add friend.' };
      }
    }

    return { success: false, error: 'Supabase is not configured.' };
  }

  /**
   * Accepts a pending friend request.
   */
  public static async acceptFriendRequest(userId: string, friendId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
      } catch (err) {
        console.warn('[FriendService] acceptFriendRequest error:', err);
      }
    }
  }

  /**
   * Removes a friend.
   */
  public static async removeFriend(userId: string, friendId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('friends')
          .delete()
          .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
      } catch (err) {
        console.warn('[FriendService] removeFriend error:', err);
      }
    }
  }
}
