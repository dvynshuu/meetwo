import { Bookmark, Message } from '../../types';
import { bookmarkRepository } from '../repositories';

export class BookmarkService {
  private static cache: Map<string, Set<string>> = new Map();
  private static inflightLoads: Map<string, Promise<Set<string>>> = new Map();

  /**
   * Fetches all saved messages for a user with joined message content and author.
   * Also populates the bookmarked message IDs cache.
   */
  public static async getBookmarks(userId: string): Promise<Bookmark[]> {
    const bookmarks = await bookmarkRepository.getBookmarks(userId);
    const idSet = new Set<string>(bookmarks.map((b) => b.messageId));
    this.cache.set(userId, idSet);
    return bookmarks;
  }

  /**
   * Preloads and caches bookmarked message IDs for a user once to eliminate N+1 queries.
   */
  public static async preloadBookmarks(userId: string): Promise<Set<string>> {
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    if (this.inflightLoads.has(userId)) {
      return this.inflightLoads.get(userId)!;
    }

    const loadPromise = bookmarkRepository
      .getBookmarks(userId)
      .then((bookmarks) => {
        const idSet = new Set<string>(bookmarks.map((b) => b.messageId));
        this.cache.set(userId, idSet);
        this.inflightLoads.delete(userId);
        return idSet;
      })
      .catch((err) => {
        this.inflightLoads.delete(userId);
        throw err;
      });

    this.inflightLoads.set(userId, loadPromise);
    return loadPromise;
  }

  /**
   * Saves or removes a bookmark for a message. Returns true if added, false if removed.
   * Atomically updates in-memory cache.
   */
  public static async toggleBookmark(
    userId: string,
    message: Message,
    channelName: string = 'general'
  ): Promise<boolean> {
    const isAdded = await bookmarkRepository.toggleBookmark(userId, message, channelName);
    const userSet = this.cache.get(userId);
    if (userSet) {
      if (isAdded) {
        userSet.add(message.id);
      } else {
        userSet.delete(message.id);
      }
    } else {
      this.cache.set(userId, new Set(isAdded ? [message.id] : []));
    }
    return isAdded;
  }

  /**
   * Checks whether a message is bookmarked by user.
   * Uses memory cache if available, or falls back to preloading user bookmarks once.
   */
  public static async isBookmarked(userId: string, messageId: string): Promise<boolean> {
    const userSet = this.cache.get(userId);
    if (userSet) {
      return userSet.has(messageId);
    }

    try {
      const loadedSet = await this.preloadBookmarks(userId);
      return loadedSet.has(messageId);
    } catch {
      return bookmarkRepository.isBookmarked(userId, messageId);
    }
  }

  /**
   * Clears the bookmark ID cache for a specific user or all users.
   */
  public static clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
      this.inflightLoads.delete(userId);
    } else {
      this.cache.clear();
      this.inflightLoads.clear();
    }
  }
}
