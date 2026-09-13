import { PeerSignalMessage } from '../../types';
import { supabase, isSupabaseConfigured } from '../supabase/client';

export interface ISignalingTransport {
  join(
    roomId: string,
    peerId: string,
    profile?: { username?: string; displayName?: string; avatarUrl?: string }
  ): Promise<void>;
  leave(roomId: string, peerId: string): Promise<void>;
  sendSignal(message: PeerSignalMessage): Promise<void>;
  onSignal(callback: (message: PeerSignalMessage) => void): () => void;
  destroy(): void;
}

export class SupabaseSignalingTransport implements ISignalingTransport {
  private channel: any = null;
  private listeners: Set<(msg: PeerSignalMessage) => void> = new Set();
  private roomId: string = '';
  private peerId: string = '';
  private profile?: { username?: string; displayName?: string; avatarUrl?: string };
  private presenceKnownPeers: Set<string> = new Set();
  private handleUnload: () => void;

  constructor() {
    this.handleUnload = () => {
      if (this.channel && this.roomId && this.peerId) {
        try {
          this.channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
              type: 'leave-room',
              fromPeerId: this.peerId,
              roomId: this.roomId,
              payload: {},
            },
          });
          this.channel.untrack?.();
        } catch {}
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleUnload);
      window.addEventListener('pagehide', this.handleUnload);
    }
  }

  async join(
    roomId: string,
    peerId: string,
    profile?: { username?: string; displayName?: string; avatarUrl?: string }
  ): Promise<void> {
    this.roomId = roomId;
    this.peerId = peerId;
    this.profile = profile;
    if (!supabase) return;

    // Clean any prior channel subscription for this room
    if (this.channel) {
      try {
        supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }

    this.presenceKnownPeers.clear();

    this.channel = supabase.channel(`webrtc:${roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: peerId },
      },
    });

    // 1. Broadcast signal listener
    this.channel.on(
      'broadcast',
      { event: 'signal' },
      ({ payload }: { payload: PeerSignalMessage }) => {
        if (!payload || payload.fromPeerId === this.peerId) return;
        this.listeners.forEach((cb) => cb(payload));
      }
    );

    // 2. Realtime Presence sync & disconnect tracking
    this.channel.on('presence', { event: 'sync' }, () => {
      if (!this.channel) return;
      const state = this.channel.presenceState() || {};
      const currentRemoteKeys = new Set<string>();

      for (const key of Object.keys(state)) {
        if (key !== this.peerId) {
          currentRemoteKeys.add(key);
          const presences = state[key] as any[];
          const latestPres = presences?.[0];
          // If this active presence peer wasn't known yet, broadcast join to establish WebRTC
          if (!this.presenceKnownPeers.has(key) && latestPres) {
            this.listeners.forEach((cb) =>
              cb({
                type: 'join-room',
                fromPeerId: key,
                roomId: this.roomId,
                payload: {},
                userProfile: latestPres.userProfile,
              })
            );
          }
        }
      }

      // Evict any peer that was previously present but is missing now (tab closed / refreshed)
      for (const oldPeerId of this.presenceKnownPeers) {
        if (!currentRemoteKeys.has(oldPeerId)) {
          this.listeners.forEach((cb) =>
            cb({
              type: 'leave-room',
              fromPeerId: oldPeerId,
              roomId: this.roomId,
              payload: {},
            })
          );
        }
      }

      this.presenceKnownPeers = currentRemoteKeys;
    });

    this.channel.on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
      if (key && key !== this.peerId) {
        this.presenceKnownPeers.delete(key);
        this.listeners.forEach((cb) =>
          cb({
            type: 'leave-room',
            fromPeerId: key,
            roomId: this.roomId,
            payload: {},
          })
        );
      }
    });

    // 3. Subscribe and track presence + broadcast join
    this.channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        try {
          await this.channel.track({
            peerId: this.peerId,
            userProfile: this.profile,
            joinedAt: Date.now(),
          });
        } catch (e) {
          console.warn('[Signaling] Presence track error:', e);
        }

        await this.sendSignal({
          type: 'join-room',
          fromPeerId: peerId,
          roomId,
          payload: {},
          userProfile: this.profile,
        });
      }
    });
  }

  async leave(roomId: string, peerId: string): Promise<void> {
    try {
      await this.sendSignal({
        type: 'leave-room',
        fromPeerId: peerId,
        roomId,
        payload: {},
      });
      if (this.channel) {
        await this.channel.untrack?.();
      }
    } catch {}
    this.destroy();
  }

  async sendSignal(message: PeerSignalMessage): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            ...message,
            userProfile: message.userProfile || this.profile,
          },
        });
      } catch (err) {
        console.warn('[Signaling] sendSignal broadcast error:', err);
      }
    }
  }

  onSignal(callback: (message: PeerSignalMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleUnload);
      window.removeEventListener('pagehide', this.handleUnload);
    }
    if (this.channel && supabase) {
      try {
        supabase.removeChannel(this.channel);
      } catch {}
      this.channel = null;
    }
    this.presenceKnownPeers.clear();
    this.listeners.clear();
  }
}

export class MockSignalingTransport implements ISignalingTransport {
  private bc: BroadcastChannel | null = null;
  private listeners: Set<(msg: PeerSignalMessage) => void> = new Set();
  private profile?: { username?: string; displayName?: string; avatarUrl?: string };

  async join(
    roomId: string,
    peerId: string,
    profile?: { username?: string; displayName?: string; avatarUrl?: string }
  ): Promise<void> {
    this.profile = profile;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.bc = new BroadcastChannel(`meetwo_signaling_${roomId}`);
      this.bc.onmessage = (event) => {
        const msg = event.data as PeerSignalMessage;
        this.listeners.forEach((cb) => cb(msg));
      };
    }

    // Broadcast join with profile
    await this.sendSignal({
      type: 'join-room',
      fromPeerId: peerId,
      roomId,
      payload: {},
      userProfile: profile,
    });
  }

  async leave(roomId: string, peerId: string): Promise<void> {
    await this.sendSignal({
      type: 'leave-room',
      fromPeerId: peerId,
      roomId,
      payload: {},
    });
    this.destroy();
  }

  async sendSignal(message: PeerSignalMessage): Promise<void> {
    if (this.bc) {
      this.bc.postMessage({
        ...message,
        userProfile: message.userProfile || this.profile,
      });
    }
  }

  onSignal(callback: (message: PeerSignalMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  destroy(): void {
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    this.listeners.clear();
  }
}

export function createSignalingTransport(): ISignalingTransport {
  return isSupabaseConfigured && supabase
    ? new SupabaseSignalingTransport()
    : new MockSignalingTransport();
}
