import { Friend, User } from '../../types';
import { friendRepository } from '../repositories';

export class FriendService {
  /**
   * Fetches all friends and pending requests for the user.
   */
  public static async getFriends(userId: string): Promise<Friend[]> {
    return friendRepository.getFriends(userId);
  }

  /**
   * Searches existing user profiles in Supabase to add friends or start conversations.
   */
  public static async searchUsers(query: string, currentUserId: string): Promise<User[]> {
    return friendRepository.searchUsers(query, currentUserId);
  }

  /**
   * Adds or requests a friend by username.
   */
  public static async addFriendByUsername(
    currentUserId: string,
    targetUsername: string
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    return friendRepository.addFriend(currentUserId, targetUsername);
  }

  /**
   * Accepts a pending friend request.
   */
  public static async acceptFriendRequest(userId: string, friendId: string): Promise<void> {
    return friendRepository.acceptFriendRequest(userId, friendId);
  }

  /**
   * Removes a friend.
   */
  public static async removeFriend(userId: string, friendId: string): Promise<void> {
    return friendRepository.removeFriend(userId, friendId);
  }
}
