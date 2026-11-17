import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookmarkService } from '../lib/services/bookmarkService';
import { bookmarkRepository } from '../lib/repositories';
import { soundEffects } from '../lib/utils/soundEffects';
import { Message } from '../types';

describe('Performance Optimizations & Feature Expansions Suite', () => {
  beforeEach(() => {
    BookmarkService.clearCache();
    vi.clearAllMocks();
  });

  describe('BookmarkService Caching (N+1 Query Elimination)', () => {
    it('caches bookmarked IDs for user and avoids multiple roundtrips to repository', async () => {
      const getBookmarksSpy = vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([
        {
          id: 'bm-1',
          userId: 'u123',
          messageId: 'msg-456',
          channelName: 'general',
          createdAt: new Date().toISOString(),
          message: { id: 'msg-456', content: 'Pinned note' } as Message,
        },
      ]);

      // First check: loads and populates cache
      const isFirst = await BookmarkService.isBookmarked('u123', 'msg-456');
      expect(isFirst).toBe(true);
      expect(getBookmarksSpy).toHaveBeenCalledTimes(1);

      // Second check: resolves synchronously from cache, repository NOT called again
      const isSecond = await BookmarkService.isBookmarked('u123', 'msg-456');
      expect(isSecond).toBe(true);
      expect(getBookmarksSpy).toHaveBeenCalledTimes(1);

      // Non-bookmarked ID check: resolves from cache
      const isNotBookmarked = await BookmarkService.isBookmarked('u123', 'msg-999');
      expect(isNotBookmarked).toBe(false);
      expect(getBookmarksSpy).toHaveBeenCalledTimes(1);

      getBookmarksSpy.mockRestore();
    });

    it('updates in-memory cache when toggleBookmark is called', async () => {
      vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue([]);
      const toggleSpy = vi.spyOn(bookmarkRepository, 'toggleBookmark').mockResolvedValue(true);

      const msg = {
        id: 'msg-789',
        content: 'Important message',
        authorId: 'u1',
        channelId: 'c1',
        createdAt: new Date().toISOString(),
      } as Message;

      // Initially not bookmarked
      const initial = await BookmarkService.isBookmarked('u123', 'msg-789');
      expect(initial).toBe(false);

      // Toggle bookmark -> add
      const added = await BookmarkService.toggleBookmark('u123', msg, 'dev-chat');
      expect(added).toBe(true);
      expect(toggleSpy).toHaveBeenCalledTimes(1);

      // Check cache -> immediately true without repository query
      const afterAdd = await BookmarkService.isBookmarked('u123', 'msg-789');
      expect(afterAdd).toBe(true);

      // Toggle bookmark -> remove
      toggleSpy.mockResolvedValueOnce(false);
      const removed = await BookmarkService.toggleBookmark('u123', msg, 'dev-chat');
      expect(removed).toBe(false);

      // Check cache -> immediately false without repository query
      const afterRemove = await BookmarkService.isBookmarked('u123', 'msg-789');
      expect(afterRemove).toBe(false);

      toggleSpy.mockRestore();
    });
  });

  describe('SoundEffects Engine', () => {
    it('allows toggling sound feedback on and off', () => {
      soundEffects.setEnabled(false);
      expect(soundEffects.getEnabled()).toBe(false);

      soundEffects.setEnabled(true);
      expect(soundEffects.getEnabled()).toBe(true);
    });

    it('gracefully executes audio feedback triggers without crashing', () => {
      // In Node/Vitest headless environment, Web Audio methods should safely execute or no-op
      expect(() => soundEffects.playJoin()).not.toThrow();
      expect(() => soundEffects.playLeave()).not.toThrow();
      expect(() => soundEffects.playMute()).not.toThrow();
      expect(() => soundEffects.playUnmute()).not.toThrow();
      expect(() => soundEffects.playReaction()).not.toThrow();
      expect(() => soundEffects.playNotification()).not.toThrow();
    });
  });
});
