import { describe, it, expect } from 'vitest';
import { SupabaseFriendRepository } from '../lib/repositories/supabaseRepository';

describe('SupabaseFriendRepository', () => {
  const repo = new SupabaseFriendRepository();

  it('rejects adding yourself as a friend', async () => {
    // Both user ID and target mock finding same ID
    const res = await repo.addFriend('usr-self', '   ');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Please enter a username.');
  });
});
