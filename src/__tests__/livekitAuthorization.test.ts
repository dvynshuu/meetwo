import { describe, it, expect } from 'vitest';

describe('LiveKit SFU Room Authorization & Scopes', () => {
  interface TokenGrant {
    room: string;
    roomJoin: boolean;
    canPublish: boolean;
    canSubscribe: boolean;
  }

  const computeTokenGrants = (roomType: 'voice' | 'stage' | 'dm', isSpeakerOrHost: boolean): TokenGrant => {
    if (roomType === 'stage') {
      return {
        room: 'stage-room',
        roomJoin: true,
        canPublish: isSpeakerOrHost,
        canSubscribe: true,
      };
    }
    // Normal voice channel or DM call
    return {
      room: 'voice-room',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    };
  };

  it('restricts stage audience members from publishing media tracks', () => {
    const audienceGrant = computeTokenGrants('stage', false);
    expect(audienceGrant.roomJoin).toBe(true);
    expect(audienceGrant.canPublish).toBe(false);
    expect(audienceGrant.canSubscribe).toBe(true);
  });

  it('allows stage hosts and approved speakers to publish media tracks', () => {
    const speakerGrant = computeTokenGrants('stage', true);
    expect(speakerGrant.roomJoin).toBe(true);
    expect(speakerGrant.canPublish).toBe(true);
    expect(speakerGrant.canSubscribe).toBe(true);
  });

  it('allows voice channel participants full two-way audio/video publishing', () => {
    const voiceGrant = computeTokenGrants('voice', false);
    expect(voiceGrant.canPublish).toBe(true);
    expect(voiceGrant.canSubscribe).toBe(true);
  });

  it('allows DM participants full two-way audio/video publishing', () => {
    const dmGrant = computeTokenGrants('dm', false);
    expect(dmGrant.canPublish).toBe(true);
    expect(dmGrant.canSubscribe).toBe(true);
  });
});
