import { readStateRepository } from '../repositories';

export interface ReadMarker {
  channelId?: string;
  conversationId?: string;
  lastReadMessageId?: string;
  lastReadAt: string;
}

export class ReadStateService {
  private static localReadCache = new Map<string, string>(); // Key: channelId or convoId -> lastReadAt
  private static isHydrated = false;

  /**
   * Hydrates the read state cache from the authoritative PostgreSQL database.
   */
  public static async hydrate(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const serverReads = await readStateRepository.getReadStates(userId);
      for (const [k, v] of Object.entries(serverReads)) {
        this.localReadCache.set(k, v);
      }
      this.isHydrated = true;
    } catch (e) {
      console.warn('[ReadStateService] Failed to hydrate read states:', e);
    }
  }

  /**
   * Records that a user has read up to a certain point in a channel or DM conversation.
   */
  public static async markAsRead(
    userId: string,
    target: { channelId?: string; conversationId?: string; messageId?: string }
  ): Promise<void> {
    const key = target.channelId || target.conversationId;
    if (!key) return;

    const now = new Date().toISOString();
    this.localReadCache.set(key, now);

    try {
      localStorage.setItem(`mw:read:${key}`, now);
    } catch {}

    await readStateRepository.markAsRead(userId, target);
  }

  /**
   * Retrieves the last read timestamp for a channel or conversation.
   */
  public static getLastRead(key: string): string | null {
    if (this.localReadCache.has(key)) {
      return this.localReadCache.get(key)!;
    }

    try {
      const stored = localStorage.getItem(`mw:read:${key}`);
      if (stored) {
        this.localReadCache.set(key, stored);
        return stored;
      }
    } catch {}

    return null;
  }
}
