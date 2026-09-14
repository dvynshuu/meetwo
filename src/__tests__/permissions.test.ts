import { describe, it, expect, beforeEach } from 'vitest';
import { MockServerRepository } from '../lib/repositories/mockRepository';
import { mockStore } from '../lib/supabase/mockStore';

describe('Server & Invite Permission Boundaries', () => {
  let serverRepo: MockServerRepository;

  beforeEach(() => {
    // Reset mockStore state for clean test run
    mockStore.setCurrentUser({
      id: 'owner-user',
      username: 'owner',
      displayName: 'Owner User',
      status: 'online',
      createdAt: new Date().toISOString(),
    });
    serverRepo = new MockServerRepository();
  });

  it('generates unique uppercase invite codes with optional maxUses and expiration', async () => {
    const server = await serverRepo.createServer('Test Server', 'owner-user');
    const invite = await serverRepo.createInvite(server.id, 'owner-user', {
      maxUses: 5,
      expiresInHours: 24,
    });

    expect(invite.code).toBeTruthy();
    expect(invite.code).toBe(invite.code.toUpperCase());
    expect(invite.serverId).toBe(server.id);
    expect(invite.maxUses).toBe(5);
    expect(invite.expiresAt).toBeDefined();
  });

  it('resolves active invites with server metadata and member counts', async () => {
    const server = await serverRepo.createServer('Resolve Server', 'owner-user');
    const invite = await serverRepo.createInvite(server.id, 'owner-user');

    const resolved = await serverRepo.resolveInvite(invite.code);
    expect(resolved).not.toBeNull();
    expect(resolved?.server.id).toBe(server.id);
    expect(resolved?.server.name).toBe('Resolve Server');
    expect(resolved?.memberCount).toBeGreaterThanOrEqual(1);
  });

  it('increments invite usage and adds member on acceptInvite', async () => {
    const server = await serverRepo.createServer('Community Workspace', 'owner-user');
    const invite = await serverRepo.createInvite(server.id, 'owner-user');

    // Switch to a joining user
    mockStore.setCurrentUser({
      id: 'joiner-user',
      username: 'joiner',
      displayName: 'Joiner User',
      status: 'online',
      createdAt: new Date().toISOString(),
    });

    const result = await serverRepo.acceptInvite(invite.code);
    expect(result.server.id).toBe(server.id);

    const members = await serverRepo.getServerMembers(server.id);
    expect(members.some((m) => m.userId === 'joiner-user')).toBe(true);

    const updatedInvite = mockStore.getInviteByCode(invite.code);
    expect(updatedInvite?.usesCount).toBe(1);
  });

  it('throws error when accepting a non-existent invite', async () => {
    await expect(serverRepo.acceptInvite('INVALIDCODE')).rejects.toThrow('Invite not found');
  });
});
