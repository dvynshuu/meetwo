import { describe, it, expect } from 'vitest';
import { Message } from '../types';

describe('Realtime State Idempotency & Deduplication', () => {
  const reduceMessages = (prev: Message[], incoming: Message): Message[] => {
    if (prev.some((m) => m.id === incoming.id)) {
      return prev.map((m) => (m.id === incoming.id ? { ...m, ...incoming } : m));
    }
    return [...prev, incoming];
  };

  it('deduplicates duplicate message broadcasts without appending duplicates', () => {
    const originalMsg: Message = {
      id: 'msg-abc-123',
      channelId: 'chan-1',
      authorId: 'user-1',
      content: 'Hello world',
      createdAt: new Date().toISOString(),
      reactions: [],
      attachments: [],
      author: {
        id: 'user-1',
        username: 'user1',
        displayName: 'User 1',
        status: 'online',
        createdAt: new Date().toISOString(),
      },
    };

    let state = [originalMsg];

    // Simulate receiving the same broadcast a second time (e.g. network retry or multiple tabs)
    state = reduceMessages(state, originalMsg);

    expect(state).toHaveLength(1);
    expect(state[0].id).toBe('msg-abc-123');
    expect(state[0].content).toBe('Hello world');
  });

  it('updates edited message attributes in-place without duplicating the entry', () => {
    const originalMsg: Message = {
      id: 'msg-abc-123',
      channelId: 'chan-1',
      authorId: 'user-1',
      content: 'Initial text',
      createdAt: new Date().toISOString(),
      reactions: [],
      attachments: [],
      author: {
        id: 'user-1',
        username: 'user1',
        displayName: 'User 1',
        status: 'online',
        createdAt: new Date().toISOString(),
      },
    };

    let state = [originalMsg];

    const editedMsg: Message = {
      ...originalMsg,
      content: 'Updated text content',
      isEdited: true,
    };

    state = reduceMessages(state, editedMsg);

    expect(state).toHaveLength(1);
    expect(state[0].content).toBe('Updated text content');
    expect(state[0].isEdited).toBe(true);
  });

  it('appends distinct messages correctly', () => {
    const msg1: Message = {
      id: 'msg-1',
      channelId: 'chan-1',
      authorId: 'user-1',
      content: 'Message 1',
      createdAt: new Date().toISOString(),
      reactions: [],
      attachments: [],
      author: {
        id: 'user-1',
        username: 'user1',
        displayName: 'User 1',
        status: 'online',
        createdAt: new Date().toISOString(),
      },
    };

    const msg2: Message = {
      id: 'msg-2',
      channelId: 'chan-1',
      authorId: 'user-2',
      content: 'Message 2',
      createdAt: new Date().toISOString(),
      reactions: [],
      attachments: [],
      author: {
        id: 'user-2',
        username: 'user2',
        displayName: 'User 2',
        status: 'online',
        createdAt: new Date().toISOString(),
      },
    };

    let state = [msg1];
    state = reduceMessages(state, msg2);

    expect(state).toHaveLength(2);
    expect(state.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
  });
});
