import { ConnectionQuality, ConnectionStats, MediaLifecycleState } from '../../types';
import { logger } from './observability';
import {
  Room,
  RoomEvent,
  Track,
  TrackPublication,
  RemoteParticipant,
  RemoteTrackPublication,
  LocalTrackPublication,
  ConnectionState,
  VideoPresets,
} from 'livekit-client';

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
}

export interface ITransportAdapter {
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
  getConnectionQuality(): ConnectionQuality;
  getConnectionStats(): ConnectionStats;
  destroy(): void;
}

/**
 * LiveKitSFUAdapter
 * Production-ready SFU integration powered by livekit-client.
 * Uploads once, handles server-side selective forwarding, adaptive simulcast, dynacast,
 * independent screen sharing, and real measured WebRTC statistics.
 */
export class LiveKitSFUAdapter implements ITransportAdapter {
  private serverUrl: string;
  private token: string;
  private callbacks: TransportCallbacks;
  private room: Room | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private remoteScreenStreams: Map<string, MediaStream> = new Map();
  private statsInterval: number | null = null;
  private currentQuality: ConnectionQuality = 'unknown';
  private currentStats: ConnectionStats = {
    quality: 'unknown',
    transportType: 'livekit',
  };
  private lastStats: {
    timestamp: number;
    bytesReceived: number;
    packetsReceived: number;
    packetsLost: number;
  } | null = null;

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
          resolution: { width: 1920, height: 1080, frameRate: 60 },
        },
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 2,
        },
        publishDefaults: {
          simulcast: true,
          videoSimulcastLayers: [
            VideoPresets.h360,
            VideoPresets.h720,
          ],
          videoEncoding: {
            maxBitrate: 6_000_000,
            maxFramerate: 60,
          },
          backupCodec: true,
          audioPreset: {
            maxBitrate: 320_000,
          },
          dtx: true,
          red: true,
          forceStereo: true,
          degradationPreference: 'maintain-framerate',
          screenShareEncoding: {
            maxBitrate: 6_000_000,
            maxFramerate: 60,
          },
        },
      });

      // 1. Handle remote track subscriptions (isolating Camera/Mic vs Screen Share)
      this.room.on(
        RoomEvent.TrackSubscribed,
        (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.source === Track.Source.ScreenShare) {
            const screenStream = new MediaStream([track.mediaStreamTrack]);
            this.remoteScreenStreams.set(participant.identity, screenStream);
            this.callbacks.onRemoteScreenStream?.(participant.identity, screenStream);
            this.callbacks.onPeerStateChanged?.(participant.identity, { isScreenSharing: true });
          } else {
            let stream = this.remoteStreams.get(participant.identity);
            if (!stream) {
              stream = new MediaStream();
              this.remoteStreams.set(participant.identity, stream);
            }
            // Remove existing track of same kind if present to prevent duplicates
            stream.getTracks().forEach((t) => {
              if (t.kind === track.kind) stream!.removeTrack(t);
            });
            stream.addTrack(track.mediaStreamTrack);
            this.callbacks.onRemoteStream(participant.identity, stream);

            if (track.kind === Track.Kind.Video) {
              this.callbacks.onPeerStateChanged?.(participant.identity, { isVideoMuted: false });
            } else if (track.kind === Track.Kind.Audio) {
              this.callbacks.onPeerStateChanged?.(participant.identity, { isAudioMuted: false });
            }
          }
        }
      );

      // 2. Handle remote track unsubscriptions
      this.room.on(
        RoomEvent.TrackUnsubscribed,
        (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.source === Track.Source.ScreenShare) {
            this.remoteScreenStreams.delete(participant.identity);
            this.callbacks.onRemoteScreenStream?.(participant.identity, null);
            this.callbacks.onPeerStateChanged?.(participant.identity, { isScreenSharing: false });
          } else {
            const stream = this.remoteStreams.get(participant.identity);
            if (stream) {
              stream.removeTrack(track.mediaStreamTrack);
              this.callbacks.onRemoteStream(participant.identity, stream);
            }
          }
        }
      );

      // 3. Track mute / unmute events
      this.room.on(RoomEvent.TrackMuted, (pub: TrackPublication, participant: any) => {
        if (pub.kind === Track.Kind.Audio) {
          this.callbacks.onPeerStateChanged?.(participant.identity, { isAudioMuted: true });
        } else if (pub.kind === Track.Kind.Video) {
          this.callbacks.onPeerStateChanged?.(participant.identity, { isVideoMuted: true });
        }
      });

      this.room.on(RoomEvent.TrackUnmuted, (pub: TrackPublication, participant: any) => {
        if (pub.kind === Track.Kind.Audio) {
          this.callbacks.onPeerStateChanged?.(participant.identity, { isAudioMuted: false });
        } else if (pub.kind === Track.Kind.Video) {
          this.callbacks.onPeerStateChanged?.(participant.identity, { isVideoMuted: false });
        }
      });

      // 4. Participant lifecycle
      this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        this.remoteStreams.delete(participant.identity);
        this.remoteScreenStreams.delete(participant.identity);
        this.callbacks.onPeerLeft(participant.identity);
      });

      // 5. Active speaker detection
      this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        speakers.forEach((s) => {
          this.callbacks.onPeerStateChanged?.(s.identity, {
            isSpeaking: s.isSpeaking,
            audioLevel: Math.round(s.audioLevel * 100),
          });
        });
      });

      // 6. Participant metadata (for Stage roles)
      this.room.on(RoomEvent.ParticipantMetadataChanged, (metadata, participant) => {
        if (metadata) {
          try {
            const parsed = JSON.parse(metadata);
            this.callbacks.onPeerStateChanged?.(participant.identity, {
              stageRole: parsed.role,
              isHandRaised: parsed.isHandRaised,
            });
          } catch {}
        }
      });

      // 7. Targeted moderation signals received via reliable data packets
      this.room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const text = new TextDecoder().decode(payload);
          const data = JSON.parse(text);
          if (data.type === 'stage-action' && data.targetUserId && data.action) {
            this.callbacks.onTargetedStageAction?.(data.action, data.targetUserId);
          }
        } catch {}
      });

      // 8. Participant-level connection quality updates from LiveKit
      this.room.on(RoomEvent.ConnectionQualityChanged, (quality: any, participant: any) => {
        let qStr: ConnectionQuality = 'good';
        const qUpper = String(quality).toLowerCase();
        if (qUpper.includes('poor')) qStr = 'poor';
        else if (qUpper.includes('good')) qStr = 'good';
        else if (qUpper.includes('excellent')) qStr = 'excellent';
        this.callbacks.onConnectionQualityChanged?.(participant.identity, qStr);
      });

      // 9. Reconnection state handling
      this.room.on(RoomEvent.Disconnected, () => {
        this.stopStatsPolling();
        logger.log('transport_failed', { reason: 'disconnected', transport: 'livekit' });
        this.callbacks.onConnectionStateChanged?.('idle');
      });

      this.room.on(RoomEvent.Reconnecting, () => {
        logger.log('reconnect_started', { transport: 'livekit' });
        this.callbacks.onConnectionStateChanged?.('reconnecting');
      });

      this.room.on(RoomEvent.Reconnected, () => {
        logger.log('reconnect_success', { transport: 'livekit' });
        this.callbacks.onConnectionStateChanged?.('connected');
      });

      await this.room.connect(this.serverUrl, this.token);
      logger.log('call_joined', { roomId, transport: 'livekit' });
      logger.log('transport_connected', { transport: 'livekit' });
      this.callbacks.onConnectionStateChanged?.('connected');

      // Publish initial local tracks with max quality settings & slow-network resilience
      if (localStream) {
        for (const track of localStream.getTracks()) {
          const isVideo = track.kind === 'video';
          await this.room.localParticipant.publishTrack(track, {
            source: isVideo ? Track.Source.Camera : Track.Source.Microphone,
            simulcast: isVideo,
            videoSimulcastLayers: isVideo ? [VideoPresets.h360, VideoPresets.h720] : undefined,
            videoEncoding: isVideo ? { maxBitrate: 6_000_000, maxFramerate: 60 } : undefined,
            audioPreset: !isVideo ? { maxBitrate: 320_000 } : undefined,
            dtx: !isVideo,
            red: !isVideo,
            forceStereo: !isVideo,
          });
        }
      }

      // Start collecting real WebRTC statistics from LiveKit engine
      this.startStatsPolling();
    } catch (err) {
      console.error('[LiveKitSFUAdapter] Connection error:', err);
      logger.log('transport_failed', { error: String(err), transport: 'livekit' });
      this.callbacks.onConnectionStateChanged?.('failed');
      throw err;
    }
  }

  async leave(): Promise<void> {
    this.stopStatsPolling();
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    this.remoteStreams.clear();
    this.remoteScreenStreams.clear();
    logger.log('call_left', { transport: 'livekit' });
    this.callbacks.onConnectionStateChanged?.('idle');
  }

  async replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<void> {
    if (!this.room) return;

    const pubs = kind === 'audio'
      ? Array.from(this.room.localParticipant.audioTrackPublications.values())
      : Array.from(this.room.localParticipant.videoTrackPublications.values()).filter(
          (p) => p.source === Track.Source.Camera
        );

    if (pubs.length > 0) {
      for (const pub of pubs) {
        if (pub.track) {
          if (newTrack) {
            await pub.track.replaceTrack(newTrack);
            await pub.track.unmute();
          } else {
            await pub.track.mute();
          }
        }
      }
    } else if (newTrack) {
      // No active publication of this kind yet; publish it with high quality defaults
      const isVideo = kind === 'video';
      await this.room.localParticipant.publishTrack(newTrack, {
        source: isVideo ? Track.Source.Camera : Track.Source.Microphone,
        simulcast: isVideo,
        videoSimulcastLayers: isVideo ? [VideoPresets.h360, VideoPresets.h720] : undefined,
        videoEncoding: isVideo ? { maxBitrate: 6_000_000, maxFramerate: 60 } : undefined,
        audioPreset: !isVideo ? { maxBitrate: 320_000 } : undefined,
        dtx: !isVideo,
        red: !isVideo,
        forceStereo: !isVideo,
      });
    }
  }

  async updateLocalStream(stream: MediaStream | null): Promise<void> {
    if (!this.room || !stream) return;
    const audioTrack = stream.getAudioTracks()[0] || null;
    const videoTrack = stream.getVideoTracks()[0] || null;
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

  async publishScreenTrack(videoTrack: MediaStreamTrack | null, audioTrack?: MediaStreamTrack | null): Promise<void> {
    if (!this.room || !videoTrack) return;
    try {
      await this.room.localParticipant.publishTrack(videoTrack, {
        source: Track.Source.ScreenShare,
        name: 'screen_share',
        simulcast: false,
        degradationPreference: 'maintain-resolution',
        videoEncoding: {
          maxBitrate: 6_000_000,
          maxFramerate: 60,
        },
      });
      if (audioTrack) {
        await this.room.localParticipant.publishTrack(audioTrack, {
          source: Track.Source.ScreenShareAudio,
          name: 'screen_audio',
          audioPreset: {
            maxBitrate: 320_000,
          },
          forceStereo: true,
        });
      }
    } catch (err) {
      console.warn('[LiveKitSFUAdapter] publishScreenTrack failed:', err);
    }
  }

  async unpublishScreenTrack(): Promise<void> {
    if (!this.room) return;
    const pubs = Array.from(this.room.localParticipant.videoTrackPublications.values());
    for (const pub of pubs) {
      if (pub.source === Track.Source.ScreenShare && pub.track) {
        await this.room.localParticipant.unpublishTrack(pub.track);
      }
    }
    const audioPubs = Array.from(this.room.localParticipant.audioTrackPublications.values());
    for (const pub of audioPubs) {
      if (pub.source === Track.Source.ScreenShareAudio && pub.track) {
        await this.room.localParticipant.unpublishTrack(pub.track);
      }
    }
  }

  async sendMuteState(isAudioMuted: boolean, isVideoMuted: boolean): Promise<void> {
    await this.setTrackEnabled('audio', !isAudioMuted);
    await this.setTrackEnabled('video', !isVideoMuted);
  }

  async sendSpeakingState(_isSpeaking: boolean, _level: number): Promise<void> {
    // LiveKit tracks active speakers server-side via SFU VAD
  }

  async sendStageRole(role: 'host' | 'speaker' | 'listener', isHandRaised?: boolean): Promise<void> {
    if (this.room) {
      await this.room.localParticipant.setMetadata(JSON.stringify({ role, isHandRaised }));
    }
  }

  async sendTargetedStageAction(targetUserId: string, action: 'invite' | 'demote' | 'lower-hand'): Promise<void> {
    if (!this.room) return;
    try {
      const data = JSON.stringify({ type: 'stage-action', targetUserId, action });
      const payload = new TextEncoder().encode(data);
      await this.room.localParticipant.publishData(payload, { reliable: true });
    } catch (e) {
      console.warn('[LiveKitSFUAdapter] sendTargetedStageAction failed:', e);
    }
  }

  // ==========================================
  // REAL STATS MEASUREMENT FROM LIVEKIT WEBRTC
  // ==========================================

  private startStatsPolling(): void {
    this.stopStatsPolling();
    this.statsInterval = window.setInterval(async () => {
      await this.collectLiveKitStats();
    }, 2000);
  }

  private stopStatsPolling(): void {
    if (this.statsInterval !== null) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private async collectLiveKitStats(): Promise<void> {
    if (!this.room || this.room.state !== ConnectionState.Connected) return;

    try {
      const now = Date.now();
      const localParticipant = this.room.localParticipant;

      // 1. Inspect local hardware track settings
      let localRes: string | undefined;
      let localFps: number | undefined;

      if (localParticipant) {
        const localVideoPub = Array.from(localParticipant.videoTrackPublications.values()).find(
          (p) => p.track && p.track.mediaStreamTrack
        );

        if (localVideoPub?.track?.mediaStreamTrack) {
          const settings = localVideoPub.track.mediaStreamTrack.getSettings();
          if (settings.width && settings.height) {
            localRes = `${settings.width}x${settings.height}`;
          }
          if (settings.frameRate) {
            localFps = Math.round(settings.frameRate);
          }
        }
      }

      // 2. Query RTCPeerConnection statistics from LiveKit PCTransportManager (Publisher & Subscriber)
      const reports: RTCStatsReport[] = [];
      const pcManager = (this.room as any).engine?.pcManager;

      if (pcManager) {
        try {
          if (pcManager.publisher?.getStats) {
            const r = await pcManager.publisher.getStats();
            if (r) reports.push(r);
          } else if (pcManager.publisher?._pc?.getStats) {
            const r = await pcManager.publisher._pc.getStats();
            if (r) reports.push(r);
          }
        } catch {}

        try {
          if (pcManager.subscriber?.getStats) {
            const r = await pcManager.subscriber.getStats();
            if (r) reports.push(r);
          } else if (pcManager.subscriber?._pc?.getStats) {
            const r = await pcManager.subscriber._pc.getStats();
            if (r) reports.push(r);
          }
        } catch {}
      } else {
        try {
          if (typeof (this.room as any).getRTCStats === 'function') {
            const r = await (this.room as any).getRTCStats();
            if (r) reports.push(r);
          } else if ((this.room as any).engine?.publisher?.pc?.getStats) {
            const r = await (this.room as any).engine.publisher.pc.getStats();
            if (r) reports.push(r);
          }
        } catch {}
      }

      // Check track publications senders if reports are still empty
      if (reports.length === 0 && localParticipant) {
        for (const pub of localParticipant.trackPublications.values()) {
          if (pub.track && (pub.track as any).sender?.getStats) {
            try {
              const r = await (pub.track as any).sender.getStats();
              if (r) reports.push(r);
            } catch {}
          }
        }
      }

      let measuredRtt: number | undefined;
      let packetsLost = 0;
      let packetsReceived = 0;
      let hasPacketData = false;
      let measuredJitter: number | undefined;
      let bytesReceived = 0;
      let bytesSent = 0;
      let hasBytesData = false;
      let measuredFrameDropRate: number | undefined;
      let measuredRes: string | undefined = localRes;
      let measuredFps: number | undefined = localFps;
      let audioCodec: string | undefined = undefined;
      let videoCodec: string | undefined = undefined;
      let candidateType: string | undefined = undefined;

      for (const statsReport of reports) {
        // Resolve Codec ID Map to actual negotiated codec MIME types
        const codecMap = new Map<string, string>();
        statsReport.forEach((report: any) => {
          if (report.type === 'codec') {
            const mime = report.mimeType || '';
            if (mime.toLowerCase().includes('opus')) {
              codecMap.set(report.id, 'Opus 48kHz');
            } else if (mime.toLowerCase().includes('h264')) {
              codecMap.set(report.id, 'H.264');
            } else if (mime.toLowerCase().includes('vp8')) {
              codecMap.set(report.id, 'VP8');
            } else if (mime.toLowerCase().includes('vp9')) {
              codecMap.set(report.id, 'VP9');
            } else if (mime.toLowerCase().includes('av1') || mime.toLowerCase().includes('av01')) {
              codecMap.set(report.id, 'AV1');
            } else if (mime) {
              codecMap.set(report.id, mime.split('/')[1] || mime);
            }
          }
        });

        // Parse candidate-pair, inbound-rtp, and outbound-rtp
        statsReport.forEach((report: any) => {
          if (report.type === 'candidate-pair' && (report.nominated || report.state === 'succeeded' || report.selected)) {
            if (report.currentRoundTripTime !== undefined) {
              measuredRtt = Math.round(report.currentRoundTripTime * 1000);
            }
            if (report.candidatePairType || report.remoteCandidateType) {
              candidateType = report.candidatePairType || report.remoteCandidateType;
            }
          }

          if (report.type === 'remote-inbound-rtp') {
            if (measuredRtt === undefined && report.roundTripTime !== undefined) {
              measuredRtt = Math.round(report.roundTripTime * 1000);
            }
            if (report.jitter !== undefined) {
              measuredJitter = Math.max(measuredJitter || 0, Math.round(report.jitter * 1000));
            }
          }

          if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') {
            const kind = report.kind || report.mediaType;
            if (kind === 'audio') {
              const resolved = (report.codecId && codecMap.get(report.codecId)) || (report.mimeType ? report.mimeType.split('/')[1] : undefined);
              if (resolved) audioCodec = resolved;
            } else if (kind === 'video') {
              const resolved = (report.codecId && codecMap.get(report.codecId)) || (report.mimeType ? report.mimeType.split('/')[1] : undefined);
              if (resolved) videoCodec = resolved;
              if (report.frameWidth && report.frameHeight) {
                measuredRes = `${report.frameWidth}x${report.frameHeight}`;
              }
              if (report.framesPerSecond !== undefined && report.framesPerSecond > 0) {
                measuredFps = Math.round(report.framesPerSecond);
              }
              if (report.framesDropped !== undefined && report.framesReceived) {
                measuredFrameDropRate = Math.round((report.framesDropped / (report.framesDropped + report.framesReceived)) * 100);
              }
            }

            if (report.type === 'inbound-rtp') {
              if (report.packetsLost !== undefined) {
                packetsLost += report.packetsLost;
                hasPacketData = true;
              }
              if (report.packetsReceived !== undefined) {
                packetsReceived += report.packetsReceived;
                hasPacketData = true;
              }
              if (report.jitter !== undefined) {
                measuredJitter = Math.max(measuredJitter || 0, Math.round(report.jitter * 1000));
              }
              if (report.bytesReceived !== undefined) {
                bytesReceived += report.bytesReceived;
                hasBytesData = true;
              }
            }

            if (report.type === 'outbound-rtp') {
              if (report.bytesSent !== undefined) {
                bytesSent += report.bytesSent;
                hasBytesData = true;
              }
            }
          }
        });
      }

      // Calculate instantaneous bitrate (kbps) and packet loss percentage truthfully
      let measuredBitrate: number | undefined;
      let packetLossPercent: number | undefined;

      const totalBytes = bytesReceived + bytesSent;
      if (this.lastStats) {
        const timeDelta = (now - this.lastStats.timestamp) / 1000;
        if (timeDelta > 0) {
          if (hasBytesData) {
            const bytesDelta = totalBytes - this.lastStats.bytesReceived;
            if (bytesDelta >= 0) {
              measuredBitrate = Math.round((bytesDelta * 8) / (timeDelta * 1000));
            }
          }

          if (hasPacketData) {
            const lossDelta = Math.max(0, packetsLost - this.lastStats.packetsLost);
            const recvDelta = Math.max(0, packetsReceived - this.lastStats.packetsReceived);
            const totalPackets = lossDelta + recvDelta;
            if (totalPackets > 0) {
              packetLossPercent = Math.min(100, Math.round((lossDelta / totalPackets) * 100));
            }
          }
        }
      }

      this.lastStats = {
        timestamp: now,
        bytesReceived: totalBytes,
        packetsReceived,
        packetsLost,
      };

      // Holistic connection quality calculation based strictly on actual measurements
      let quality: ConnectionQuality = 'unknown';
      if (measuredRtt !== undefined || packetLossPercent !== undefined) {
        const rttVal = measuredRtt ?? 0;
        const lossVal = packetLossPercent ?? 0;
        if (rttVal > 350 || lossVal > 12) {
          quality = 'poor';
        } else if (rttVal > 220 || lossVal > 5) {
          quality = 'fair';
        } else if (rttVal > 100 || lossVal > 2) {
          quality = 'good';
        } else {
          quality = 'excellent';
        }
      }

      this.currentQuality = quality;
      this.currentStats = {
        rtt: measuredRtt,
        packetLoss: packetLossPercent,
        jitter: measuredJitter,
        bitrate: measuredBitrate ?? (hasBytesData ? 0 : undefined),
        fps: measuredFps,
        frameDropRate: measuredFrameDropRate,
        resolution: measuredRes,
        audioCodec,
        videoCodec,
        candidateType,
        transportType: 'livekit',
        packetsReceived: hasPacketData ? packetsReceived : undefined,
        packetsLost: hasPacketData ? packetsLost : undefined,
        bytesReceived: hasBytesData ? bytesReceived : undefined,
        bytesSent: hasBytesData ? bytesSent : undefined,
        quality,
      };

      if (this.room.localParticipant) {
        this.callbacks.onConnectionQualityChanged?.(
          this.room.localParticipant.identity,
          quality,
          this.currentStats
        );
      }
    } catch {}
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
