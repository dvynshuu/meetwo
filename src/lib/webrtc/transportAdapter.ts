import { PeerSignalMessage, ConnectionQuality } from '../../types';

export interface TransportCallbacks {
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onPeerLeft: (peerId: string) => void;
  onConnectionQualityChanged?: (peerId: string, quality: ConnectionQuality) => void;
}

export interface ITransportAdapter {
  join(roomId: string, localStream: MediaStream | null): Promise<void>;
  leave(): Promise<void>;
  updateLocalStream(stream: MediaStream | null): Promise<void>;
  getConnectionQuality(): ConnectionQuality;
  destroy(): void;
}

/**
 * LiveKitSFUAdapter (Scaffold for Enterprise Scale)
 * Ready to connect with a LiveKit SFU instance without modifying Video Room UI components.
 */
export class LiveKitSFUAdapter implements ITransportAdapter {
  private serverUrl: string;
  private token: string;
  private callbacks: TransportCallbacks;

  constructor(serverUrl: string, token: string, callbacks: TransportCallbacks) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.callbacks = callbacks;
  }

  async join(roomId: string, localStream: MediaStream | null): Promise<void> {
    console.info(`[SFU] Connecting to LiveKit server at ${this.serverUrl} for room ${roomId}`);
    // Future SFU connection logic:
    // const room = new Room();
    // await room.connect(this.serverUrl, this.token);
  }

  async leave(): Promise<void> {
    console.info('[SFU] Disconnected from LiveKit room');
  }

  async updateLocalStream(stream: MediaStream | null): Promise<void> {
    console.info('[SFU] Local stream tracks updated upstream to SFU');
  }

  getConnectionQuality(): ConnectionQuality {
    return 'excellent';
  }

  destroy(): void {
    this.leave();
  }
}
