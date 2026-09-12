import { PeerSignalMessage } from '../../types';
import { supabase, isSupabaseConfigured } from '../supabase/client';

export interface ISignalingTransport {
  join(roomId: string, peerId: string): Promise<void>;
  leave(roomId: string, peerId: string): Promise<void>;
  sendSignal(message: PeerSignalMessage): Promise<void>;
  onSignal(callback: (message: PeerSignalMessage) => void): () => void;
  destroy(): void;
}

export class SupabaseSignalingTransport implements ISignalingTransport {
  private channel: any = null;
  private listeners: Set<(msg: PeerSignalMessage) => void> = new Set();
  private roomId: string = '';

  async join(roomId: string, peerId: string): Promise<void> {
    this.roomId = roomId;
    if (!supabase) return;

    this.channel = supabase.channel(`webrtc:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, ({ payload }: { payload: PeerSignalMessage }) => {
        this.listeners.forEach((cb) => cb(payload));
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.sendSignal({
            type: 'join-room',
            fromPeerId: peerId,
            roomId,
            payload: {},
          });
        }
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
    if (this.channel) {
      await this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: message,
      });
    }
  }

  onSignal(callback: (message: PeerSignalMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  destroy(): void {
    if (this.channel && supabase) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners.clear();
  }
}

export class MockSignalingTransport implements ISignalingTransport {
  private bc: BroadcastChannel | null = null;
  private listeners: Set<(msg: PeerSignalMessage) => void> = new Set();

  async join(roomId: string, peerId: string): Promise<void> {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.bc = new BroadcastChannel(`meetwo_signaling_${roomId}`);
      this.bc.onmessage = (event) => {
        const msg = event.data as PeerSignalMessage;
        this.listeners.forEach((cb) => cb(msg));
      };
    }

    // Broadcast join
    await this.sendSignal({
      type: 'join-room',
      fromPeerId: peerId,
      roomId,
      payload: {},
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
      this.bc.postMessage(message);
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
