import { supabase, isSupabaseConfigured } from '../supabase/client';

export interface ReadMarker {
  channelId?: string;
  conversationId?: string;
  lastReadMessageId?: string;
  lastReadAt: string;
}

export class ReadStateService {
  private static localReadCache = new Map<string, string>(); // Key: channelId or convoId -> lastReadAt

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

    // Save to localStorage for instant client recovery
    try {
      localStorage.setItem(`mw:read:${key}`, now);
    } catch {}

    if (isSupabaseConfigured && supabase && userId) {
      try {
        if (target.channelId) {
          await supabase.from('read_states').upsert({
            user_id: userId,
            channel_id: target.channelId,
            last_read_message_id: target.messageId || null,
            last_read_at: now,
          });
        } else if (target.conversationId) {
          await supabase.from('read_states').upsert({
            user_id: userId,
            conversation_id: target.conversationId,
            last_read_message_id: target.messageId || null,
            last_read_at: now,
          });
        }
      } catch (err) {
        console.warn('[ReadStateService] Upsert read state error:', err);
      }
    }
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
