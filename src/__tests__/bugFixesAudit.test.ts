import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SupabaseDMRepository,
  SupabaseSearchRepository,
  SupabaseFriendRepository,
  SupabaseMessageRepository,
  SupabaseReadStateRepository,
} from '../lib/repositories/supabaseRepository';
import { supabase } from '../lib/supabase/client';

describe('Audited Bug Fixes & Resiliency', () => {
  describe('SupabaseDMRepository.startConversation', () => {
    it('creates DM conversation using pre-generated UUID avoiding RLS RETURNING filter', async () => {
      const dmRepo = new SupabaseDMRepository();

      const currentUser = {
        id: 'user-alice-123',
        username: 'alice',
        displayName: 'Alice',
        status: 'online' as const,
        createdAt: new Date().toISOString(),
      };

      const targetUser = {
        id: 'user-bob-456',
        username: 'bob',
        displayName: 'Bob',
        status: 'online' as const,
        createdAt: new Date().toISOString(),
      };

      // Mock supabase dm_participants and dm_conversations
      const insertMock = vi.fn().mockReturnValue({ error: null });
      const selectMock = vi.fn().mockReturnThis();
      const inMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });

      const fromSpy = vi.spyOn(supabase as any, 'from').mockImplementation((...args: any[]) => {
        const table = args[0];
        if (table === 'dm_participants') {
          return {
            select: selectMock,
            in: inMock,
            eq: eqMock,
            maybeSingle: maybeSingleMock,
            insert: insertMock,
          };
        }
        if (table === 'dm_conversations') {
          return {
            insert: (payload: any) => {
              expect(payload.id).toBeDefined();
              expect(typeof payload.id).toBe('string');
              return { error: null };
            },
          };
        }
        return {} as any;
      });

      const convoId = await dmRepo.startConversation(currentUser, targetUser);
      expect(convoId).toBeDefined();
      expect(typeof convoId).toBe('string');
      expect(insertMock).toHaveBeenCalledWith([
        { conversation_id: convoId, user_id: currentUser.id },
        { conversation_id: convoId, user_id: targetUser.id },
      ]);

      fromSpy.mockRestore();
    });
  });

  describe('SupabaseFriendRepository.searchUsers', () => {
    it('sanitizes commas and parentheses from search string to prevent PostgREST grammar errors', async () => {
      const repo = new SupabaseFriendRepository();
      let capturedOrClause = '';

      const fromSpy = vi.spyOn(supabase as any, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: (clause: string) => {
            capturedOrClause = clause;
            return {
              neq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          },
        }),
      } as any);

      await repo.searchUsers('alice, (admin)', 'user-me');

      expect(capturedOrClause).toBe('username.ilike.%alice   admin%,display_name.ilike.%alice   admin%');

      fromSpy.mockRestore();
    });
  });

  describe('SupabaseMessageRepository.toggleReaction', () => {
    it('silently recovers from 23505 duplicate key conflict during rapid clicking', async () => {
      const repo = new SupabaseMessageRepository();

      const fromSpy = vi.spyOn(supabase as any, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        insert: vi.fn().mockResolvedValue({
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        }),
      } as any);

      // Should not throw REACTION_FAILED
      await expect(repo.toggleReaction('msg-1', 'usr-1', '👍')).resolves.toBeUndefined();

      fromSpy.mockRestore();
    });
  });

  describe('SupabaseReadStateRepository.markAsRead', () => {
    it('specifies onConflict for channel and DM read states to prevent 409 duplicate errors', async () => {
      const repo = new SupabaseReadStateRepository();
      const upsertCalls: any[] = [];

      const fromSpy = vi.spyOn(supabase as any, 'from').mockReturnValue({
        upsert: (payload: any, options: any) => {
          upsertCalls.push({ payload, options });
          return Promise.resolve({ error: null });
        },
      } as any);

      await repo.markAsRead('usr-1', { channelId: 'chan-123' });
      await repo.markAsRead('usr-1', { conversationId: 'dm-456' });

      expect(upsertCalls).toHaveLength(2);
      expect(upsertCalls[0].options).toEqual({ onConflict: 'user_id,channel_id' });
      expect(upsertCalls[1].options).toEqual({ onConflict: 'user_id,conversation_id' });

      fromSpy.mockRestore();
    });
  });
});
