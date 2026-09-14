import { describe, it, expect } from 'vitest';
import { ServiceError } from '../lib/repositories/types';
import { SupabaseMessageRepository, SupabaseServerRepository } from '../lib/repositories/supabaseRepository';

describe('Auth & Service Error Handling', () => {
  it('creates typed ServiceError instances with descriptive codes', () => {
    const err = new ServiceError('SUPABASE_NOT_INITIALIZED', 'Supabase client is not initialized.');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.code).toBe('SUPABASE_NOT_INITIALIZED');
    expect(err.message).toContain('not initialized');
  });

  it('preserves ServiceError code and actionable details without falling back silently', async () => {
    const err = new ServiceError('AUTH_REQUIRED', 'User must be authenticated to perform this operation', { status: 401 });
    expect(err.name).toBe('ServiceError');
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(err.details?.status).toBe(401);
  });

  it('rejects message sending when unauthenticated in Supabase repository', async () => {
    const msgRepo = new SupabaseMessageRepository();
    const fakeAuthor = {
      id: 'usr-test',
      username: 'tester',
      displayName: 'Tester',
      status: 'online' as const,
      createdAt: new Date().toISOString(),
    };
    await expect(
      msgRepo.sendMessage('chan-1', fakeAuthor, 'Hello test')
    ).rejects.toThrow();
  });
});
