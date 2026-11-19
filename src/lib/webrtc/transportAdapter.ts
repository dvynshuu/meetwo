import { ConnectionQuality, ConnectionStats, MediaLifecycleState, AudioCompressionProfile } from '../../types';

export interface TransportCallbacks {
  onRemoteStream: (peerId: string, stream: MediaStream) => void;
  onRemoteScreenStream?: (peerId: string, stream: MediaStream | null) => void;
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
      displayName?: string;
      username?: string;
      avatarUrl?: string;
    }
  ) => void;
  onConnectionQualityChanged?: (peerId: string, quality: ConnectionQuality, stats?: ConnectionStats) => void;
  onConnectionStateChanged?: (state: MediaLifecycleState) => void;
  onTargetedStageAction?: (action: 'invite' | 'demote' | 'lower-hand', targetUserId: string) => void;
  onCallReaction?: (reaction: { emoji: string; senderId: string; senderName: string }) => void;
}

export interface ITransportAdapter {
  readonly kind?: 'livekit' | 'p2p';
  join(
    roomId: string,
    localStream: MediaStream | null,
    profile?: { username?: string; displayName?: string; avatarUrl?: string }
  ): Promise<void>;
  leave(): Promise<void>;
  replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<void>;
  updateLocalStream(stream: MediaStream | null): Promise<void>;
  setTrackEnabled(kind: 'audio' | 'video', enabled: boolean): Promise<void>;
  publishScreenTrack(videoTrack: MediaStreamTrack | null, audioTrack?: MediaStreamTrack | null): Promise<void>;
  unpublishScreenTrack(): Promise<void>;
  sendMuteState(isAudioMuted: boolean, isVideoMuted: boolean): Promise<void>;
  sendSpeakingState(isSpeaking: boolean, level: number): Promise<void>;
  sendStageRole(role: 'host' | 'speaker' | 'listener', isHandRaised?: boolean): Promise<void>;
  sendTargetedStageAction(targetUserId: string, action: 'invite' | 'demote' | 'lower-hand'): Promise<void>;
  sendCallReaction?(emoji: string, senderName?: string): Promise<void>;
  setAudioProfile?(profile: AudioCompressionProfile, stereo?: boolean): Promise<void> | void;
  getConnectionQuality(): ConnectionQuality;
  getConnectionStats(): ConnectionStats;
  destroy(): void;
}
