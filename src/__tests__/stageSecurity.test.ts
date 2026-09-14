import { describe, it, expect, beforeEach } from 'vitest';
import { MockStageRepository } from '../lib/repositories/mockRepository';
import { mockStore } from '../lib/supabase/mockStore';

describe('Stage Security & Speaker Promotion Workflow', () => {
  let stageRepo: MockStageRepository;
  const stageChannelId = 'stage-chan-101';
  const hostUser = {
    id: 'stage-host',
    username: 'host',
    displayName: 'Stage Host',
    status: 'online' as const,
    createdAt: new Date().toISOString(),
  };
  const listenerUser = {
    id: 'stage-listener',
    username: 'listener',
    displayName: 'Stage Listener',
    status: 'online' as const,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockStore.setCurrentUser(hostUser);
    stageRepo = new MockStageRepository();
    // Initialize stage channel with hostUser as host
    stageRepo.getStageState(stageChannelId);
  });

  it('allows audience member to raise hand and enqueue in handRaisedQueue', async () => {
    mockStore.setCurrentUser(listenerUser);
    await stageRepo.raiseHand(stageChannelId);

    const state = await stageRepo.getStageState(stageChannelId);
    expect(state).not.toBeNull();
    expect(state?.handRaisedQueue).toContain(listenerUser.id);
  });

  it('allows user or moderator to lower hand', async () => {
    mockStore.setCurrentUser(listenerUser);
    await stageRepo.raiseHand(stageChannelId);

    let state = await stageRepo.getStageState(stageChannelId);
    expect(state?.handRaisedQueue).toContain(listenerUser.id);

    await stageRepo.lowerHand(stageChannelId, listenerUser.id);
    state = await stageRepo.getStageState(stageChannelId);
    expect(state?.handRaisedQueue).not.toContain(listenerUser.id);
  });

  it('promotes queued listener to approved speaker when moderator invites them', async () => {
    // 1. Listener raises hand
    mockStore.setCurrentUser(listenerUser);
    await stageRepo.raiseHand(stageChannelId);

    // 2. Moderator approves
    mockStore.setCurrentUser(hostUser);
    await stageRepo.moderateSpeaker(stageChannelId, listenerUser.id, 'invite');

    const state = await stageRepo.getStageState(stageChannelId);
    expect(state?.speakers).toContain(listenerUser.id);
    expect(state?.handRaisedQueue).not.toContain(listenerUser.id);
  });

  it('demotes speaker back to audience when moderator revokes speaking rights', async () => {
    // 1. Promote to speaker
    mockStore.setCurrentUser(hostUser);
    await stageRepo.moderateSpeaker(stageChannelId, listenerUser.id, 'invite');

    let state = await stageRepo.getStageState(stageChannelId);
    expect(state?.speakers).toContain(listenerUser.id);

    // 2. Demote
    await stageRepo.moderateSpeaker(stageChannelId, listenerUser.id, 'demote');
    state = await stageRepo.getStageState(stageChannelId);
    expect(state?.speakers).not.toContain(listenerUser.id);
  });
});
