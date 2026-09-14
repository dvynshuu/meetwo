import { Bookmark, Message } from '../../types';
import { bookmarkRepository } from '../repositories';

export class BookmarkService {
  /**
   * Fetches all saved messages for a user with joined message content and author.
   */
  public static async getBookmarks(userId: string): Promise<Bookmark[]> {
    return bookmarkRepository.getBookmarks(userId);
  }

  /**
   * Saves or removes a bookmark for a message. Returns true if added, false if removed.
   */
  public static async toggleBookmark(
    userId: string,
    message: Message,
    channelName: string = 'general'
  ): Promise<boolean> {
    return bookmarkRepository.toggleBookmark(userId, message, channelName);
  }

  /**
   * Checks whether a message is bookmarked by user.
   */
  public static async isBookmarked(userId: string, messageId: string): Promise<boolean> {
    return bookmarkRepository.isBookmarked(userId, messageId);
  }
}
