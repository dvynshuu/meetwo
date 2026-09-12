import { ConnectionQuality, ConnectionStats, MediaLifecycleState } from '../../types';
import { Room, RoomEvent, Track, RemoteParticipant, RemoteTrackPublication } from 'livekit-client';

export interface TransportCallbacks {
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onPeerLeft: (peerId: string) => void;
  onPeerStateChanged?: (
    peerId: string,
    state: {
      isAudioMuted?: boolean;
      isVideoMuted?: boolean;
      isScreenSharing?: boolean;
      isSpeaking?: boolean;
      stageRole?: 'host' | 'speaker' | 'listener';
      isHandRaised?: boolean;
      audioLevel?: number;
    }
  ) => void;
  onConnectionQualityChanged?: (peerId: string, quality: ConnectionQuality, stats?: ConnectionStats) => void;
  onConnectionStateChanged?: (state: MediaLifecycleState) => void;
}

export interface ITransportAdapter {
  join(roomId: string, localStream: MediaStream | null): Promise<void>;
  leave(): Promise<void>;
  replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<void>;
  updateLocalStream(stream: MediaStream | null): Promise<void>;
  setTrackEnabled(kind: 'audio' | 'video', enabled: boolean): Promise<void>;
  sendMuteState(isAudioMuted: boolean, isVideoMuted: boolean): Promise<void>;
  sendSpeakingState(isSpeaking: boolean, level: number): Promise<void>;
  sendStageRole(role: 'host' | 'speaker' | 'listener', isHandRaised?: boolean): Promise<void>;
  getConnectionQuality(): ConnectionQuality;
  getConnectionStats(): ConnectionStats;
  destroy(): void;
}

/**
 * LiveKitSFUAdapter
 * Production-ready SFU integration powered by livekit-client.
 * Uploads once, handles server-side selective forwarding, adaptive simulcast, and dynacast.
 */
export class LiveKitSFUAdapter implements ITransportAdapter {
  private serverUrl: string;
  private token: string;
  private callbacks: TransportCallbacks;
  private room: Room | null = null;
  private currentQuality: ConnectionQuality = 'excellent';
  private currentStats: ConnectionStats = {
    rtt: 25,
    packetLoss: 0,
    jitter: 4,
    bitrate: 1800,
    quality: 'excellent',
  };

  constructor(serverUrl: string, token: string, callbacks: TransportCallbacks) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.callbacks = callbacks;
  }

  async join(roomId: string, localStream: MediaStream | null): Promise<void> {
    this.callbacks.onConnectionStateChanged?.('connecting');

    try {
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1920, height: 1080, frameRate: 30 },
        },
        publishDefaults: {
          simulcast: true,
          audioPreset: {
            maxBitrate: 128000,
          },
        },
      });

      // Handle remote track subscriptions
      this.room.on(
        RoomEvent.TrackSubscribed,
        (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.mediaStream) {
            this.callbacks.onRemoteStream(participant.identity, track.mediaStream);
          }
        }
      );

      this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        this.callbacks.onPeerLeft(participant.identity);
      });

      this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        speakers.forEach((s) => {
          this.callbacks.onPeerStateChanged?.(s.identity, {
            isSpeaking: s.isSpeaking,
            audioLevel: Math.round(s.audioLevel * 100),
          });
        });
      });

      this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
        let mappedQuality: ConnectionQuality = 'good';
        const qStr = String(quality).toLowerCase();
        if (qStr.includes('excellent')) mappedQuality = 'excellent';
        else if (qStr.includes('good')) mappedQuality = 'good';
        else if (qStr.includes('poor')) mappedQuality = 'poor';

        if (participant) {
          this.callbacks.onConnectionQualityChanged?.(participant.identity, mappedQuality);
        } else {
          this.currentQuality = mappedQuality;
        }
      });

      this.room.on(RoomEvent.Disconnected, () => {
        this.callbacks.onConnectionStateChanged?.('idle');
      });

      this.room.on(RoomEvent.Reconnecting, () => {
        this.callbacks.onConnectionStateChanged?.('reconnecting');
      });

      this.room.on(RoomEvent.Reconnected, () => {
        this.callbacks.onConnectionStateChanged?.('connected');
      });

      await this.room.connect(this.serverUrl, this.token);
      this.callbacks.onConnectionStateChanged?.('connected');

      // Publish local tracks
      if (localStream) {
        for (const track of localStream.getTracks()) {
          await this.room.localParticipant.publishTrack(track);
        }
      }
    } catch (err) {
      console.error('[LiveKitSFUAdapter] Connection error:', err);
      this.callbacks.onConnectionStateChanged?.('failed');
      throw err;
    }
  }

  async leave(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    this.callbacks.onConnectionStateChanged?.('idle');
  }

  async replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<void> {
    if (!this.room) return;
    const pubs = kind === 'audio' 
      ? this.room.localParticipant.audioTrackPublications 
      : this.room.localParticipant.videoTrackPublications;

    pubs.forEach(async (pub) => {
      if (pub.track) {
        if (newTrack) {
          await pub.track.replaceTrack(newTrack);
        } else {
          await pub.track.mute();
        }
      }
    });
  }

  async updateLocalStream(stream: MediaStream | null): Promise<void> {
    if (!this.room || !stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];
    if (audioTrack) await this.replaceTrack('audio', audioTrack);
    if (videoTrack) await this.replaceTrack('video', videoTrack);
  }

  async setTrackEnabled(kind: 'audio' | 'video', enabled: boolean): Promise<void> {
    if (!this.room) return;
    if (kind === 'audio') {
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
    } else {
      await this.room.localParticipant.setCameraEnabled(enabled);
    }
  }

  async sendMuteState(isAudioMuted: boolean, isVideoMuted: boolean): Promise<void> {
    await this.setTrackEnabled('audio', !isAudioMuted);
    await this.setTrackEnabled('video', !isVideoMuted);
  }

  async sendSpeakingState(isSpeaking: boolean, level: number): Promise<void> {
    // LiveKit automatically tracks active speakers via VAD on the SFU
  }

  async sendStageRole(role: 'host' | 'speaker' | 'listener', isHandRaised?: boolean): Promise<void> {
    // Send metadata to SFU
    if (this.room) {
      await this.room.localParticipant.setMetadata(JSON.stringify({ role, isHandRaised }));
    }
  }

  getConnectionQuality(): ConnectionQuality {
    return this.currentQuality;
  }

  getConnectionStats(): ConnectionStats {
    return this.currentStats;
  }

  destroy(): void {
    this.leave();
  }
}
