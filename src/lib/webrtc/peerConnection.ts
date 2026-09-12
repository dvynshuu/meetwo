import {
  PeerSignalMessage,
  ConnectionQuality,
  ConnectionStats,
  MediaLifecycleState,
} from '../../types';
import { ISignalingTransport, createSignalingTransport } from './signaling';
import { ITransportAdapter, TransportCallbacks } from './transportAdapter';
import { mungeOpusSDP } from './audioProcessing';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 4,
};

interface PeerSession {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  connectionQuality: ConnectionQuality;
  lastStats?: {
    timestamp: number;
    bytesReceived: number;
    packetsReceived: number;
    packetsLost: number;
  };
}

export class PeerConnectionManager implements ITransportAdapter {
  private localPeerId: string;
  private roomId: string = '';
  private localStream: MediaStream | null = null;
  private peerSessions: Map<string, PeerSession> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private signaling: ISignalingTransport;
  private callbacks: TransportCallbacks;
  private unsubSignal?: () => void;
  private lifecycleState: MediaLifecycleState = 'idle';

  private screenStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private remoteScreenStreams: Map<string, MediaStream> = new Map();
  private peerScreenSharingState: Map<string, boolean> = new Map();
  private lastBitrateAdaptTime: number = 0;

  // Aggregate local connection stats
  private localStats: ConnectionStats = {
    quality: 'excellent',
  };

  private globalStatsInterval: number | null = null;
  private lastGlobalStats: {
    timestamp: number;
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
    packetsLost: number;
  } | null = null;

  // Event handlers for auto-recovery
  private handleOnline = () => this.recoverConnections('online');
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.recoverConnections('visibility');
    }
  };

  constructor(localPeerId: string, callbacks: TransportCallbacks) {
    this.localPeerId = localPeerId;
    this.callbacks = callbacks;
    this.signaling = createSignalingTransport();

    // Attach browser auto-recovery listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public async join(roomId: string, localStream: MediaStream | null): Promise<void> {
    this.roomId = roomId;
    this.localStream = localStream;
    this.setLifecycleState('connecting');

    this.startGlobalStatsPolling();

    this.unsubSignal = this.signaling.onSignal(async (signal: PeerSignalMessage) => {
      if (signal.fromPeerId === this.localPeerId || signal.roomId !== this.roomId) return;
      if (signal.toPeerId && signal.toPeerId !== this.localPeerId) return;

      await this.handleSignal(signal);
    });

    await this.signaling.join(roomId, this.localPeerId);
  }

  // ==========================================
  // IN-CALL TRACK MANAGEMENT (replaceTrack)
  // ==========================================

  public async replaceTrack(
    kind: 'audio' | 'video',
    newTrack: MediaStreamTrack | null
  ): Promise<void> {
    for (const [peerId, session] of this.peerSessions.entries()) {
      const senders = session.pc.getSenders();
      const sender = senders.find((s) => s.track && s.track.kind === kind);

      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (err) {
          console.warn(`[WebRTC] replaceTrack error for peer ${peerId}:`, err);
        }
      } else if (newTrack && this.localStream) {
        // No sender exists for this kind yet, add track and renegotiate
        try {
          session.pc.addTrack(newTrack, this.localStream);
        } catch (e) {
          console.warn('[WebRTC] addTrack error:', e);
        }
      }
    }
    this.collectGlobalStats().catch(() => {});
  }

  public async updateLocalStream(newStream: MediaStream | null): Promise<void> {
    this.localStream = newStream;
    this.collectGlobalStats().catch(() => {});
    if (!newStream) return;

    const audioTrack = newStream.getAudioTracks()[0] || null;
    const videoTrack = newStream.getVideoTracks()[0] || null;

    await this.replaceTrack('audio', audioTrack);
    await this.replaceTrack('video', videoTrack);
  }

  public async setTrackEnabled(kind: 'audio' | 'video', enabled: boolean): Promise<void> {
    if (!this.localStream) return;
    const tracks = kind === 'audio' ? this.localStream.getAudioTracks() : this.localStream.getVideoTracks();
    tracks.forEach((t) => (t.enabled = enabled));
    this.collectGlobalStats().catch(() => {});
  }

  // ==========================================
  // SCREEN SHARING TRACK MANAGEMENT
  // ==========================================

  public async publishScreenTrack(
    videoTrack: MediaStreamTrack | null,
    audioTrack?: MediaStreamTrack | null
  ): Promise<void> {
    if (!videoTrack) return;

    this.screenStream = new MediaStream();
    this.screenStream.addTrack(videoTrack);
    if (audioTrack) {
      this.screenStream.addTrack(audioTrack);
    }

    // Add screen tracks to all peer sessions
    for (const [peerId, session] of this.peerSessions.entries()) {
      try {
        session.pc.addTrack(videoTrack, this.screenStream);
        if (audioTrack) {
          session.pc.addTrack(audioTrack, this.screenStream);
        }
      } catch (err) {
        console.warn(`[WebRTC] Failed to add screen track to peer ${peerId}:`, err);
      }
    }

    this.collectGlobalStats().catch(() => {});

    await this.signaling.sendSignal({
      type: 'track-update',
      fromPeerId: this.localPeerId,
      roomId: this.roomId,
      payload: { isScreenSharing: true },
    });
  }

  public async unpublishScreenTrack(): Promise<void> {
    if (this.screenStream) {
      const screenTracks = this.screenStream.getTracks();
      for (const [, session] of this.peerSessions.entries()) {
        const senders = session.pc.getSenders();
        for (const sender of senders) {
          if (sender.track && screenTracks.includes(sender.track)) {
            try {
              session.pc.removeTrack(sender);
            } catch {}
          }
        }
      }
      this.screenStream = null;
    }

    this.collectGlobalStats().catch(() => {});

    await this.signaling.sendSignal({
      type: 'track-update',
      fromPeerId: this.localPeerId,
      roomId: this.roomId,
      payload: { isScreenSharing: false },
    });
  }

  // ==========================================
  // STATE SIGNALING BROADCASTS
  // ==========================================

  public async sendMuteState(isAudioMuted: boolean, isVideoMuted: boolean): Promise<void> {
    await this.signaling.sendSignal({
      type: 'mute-state',
      fromPeerId: this.localPeerId,
      roomId: this.roomId,
      payload: { isAudioMuted, isVideoMuted },
    });
  }

  public async sendSpeakingState(isSpeaking: boolean, level: number): Promise<void> {
    await this.signaling.sendSignal({
      type: 'speaking-state',
      fromPeerId: this.localPeerId,
      roomId: this.roomId,
      payload: { isSpeaking, level },
    });
  }

  public async sendStageRole(
    role: 'host' | 'speaker' | 'listener',
    isHandRaised?: boolean
  ): Promise<void> {
    await this.signaling.sendSignal({
      type: 'stage-role',
      fromPeerId: this.localPeerId,
      roomId: this.roomId,
      payload: { role, isHandRaised },
    });
  }

  public async sendTargetedStageAction(
    targetUserId: string,
    action: 'invite' | 'demote' | 'lower-hand'
  ): Promise<void> {
    const type =
      action === 'invite'
        ? 'stage-invite'
        : action === 'demote'
        ? 'stage-demote'
        : 'stage-hand-dismiss';

    await this.signaling.sendSignal({
      type,
      fromPeerId: this.localPeerId,
      roomId: this.roomId,
      payload: { targetUserId },
    });
  }

  // ==========================================
  // PERFECT NEGOTIATION WITH OPUS OPTIMIZATION
  // ==========================================

  private async handleSignal(signal: PeerSignalMessage): Promise<void> {
    const { fromPeerId, type, payload } = signal;

    // Handle participant state updates
    if (type === 'mute-state') {
      this.callbacks.onPeerStateChanged?.(fromPeerId, {
        isAudioMuted: payload.isAudioMuted,
        isVideoMuted: payload.isVideoMuted,
      });
      return;
    }

    if (type === 'speaking-state') {
      this.callbacks.onPeerStateChanged?.(fromPeerId, {
        isSpeaking: payload.isSpeaking,
        audioLevel: payload.level,
      });
      return;
    }

    if (type === 'stage-role') {
      this.callbacks.onPeerStateChanged?.(fromPeerId, {
        stageRole: payload.role,
        isHandRaised: payload.isHandRaised,
      });
      return;
    }

    if (type === 'stage-invite') {
      this.callbacks.onTargetedStageAction?.('invite', payload.targetUserId);
      return;
    }

    if (type === 'stage-demote') {
      this.callbacks.onTargetedStageAction?.('demote', payload.targetUserId);
      return;
    }

    if (type === 'stage-hand-dismiss') {
      this.callbacks.onTargetedStageAction?.('lower-hand', payload.targetUserId);
      return;
    }

    if (type === 'track-update') {
      this.peerScreenSharingState.set(fromPeerId, payload.isScreenSharing);
      this.callbacks.onPeerStateChanged?.(fromPeerId, {
        isScreenSharing: payload.isScreenSharing,
      });
      if (!payload.isScreenSharing) {
        this.remoteScreenStreams.delete(fromPeerId);
        this.callbacks.onRemoteScreenStream?.(fromPeerId, null);
      }
      return;
    }

    const session = this.getOrCreatePeerSession(fromPeerId);
    const pc = session.pc;

    try {
      switch (type) {
        case 'join-room': {
          // Existing peers initiate offer
          session.makingOffer = true;
          const offer = await pc.createOffer();
          // Apply studio Opus audio munging
          offer.sdp = mungeOpusSDP(offer.sdp || '');
          await pc.setLocalDescription(offer);

          await this.signaling.sendSignal({
            type: 'offer',
            fromPeerId: this.localPeerId,
            toPeerId: fromPeerId,
            roomId: this.roomId,
            payload: offer,
          });
          session.makingOffer = false;
          break;
        }

        case 'offer': {
          const offerCollision =
            session.makingOffer || pc.signalingState !== 'stable';

          session.ignoreOffer = !session.polite && offerCollision;
          if (session.ignoreOffer) {
            console.warn(`[WebRTC] Glare handled: Impolite peer ${this.localPeerId} ignored offer from ${fromPeerId}`);
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          await this.flushPendingCandidates(fromPeerId, pc);

          const answer = await pc.createAnswer();
          answer.sdp = mungeOpusSDP(answer.sdp || '');
          await pc.setLocalDescription(answer);

          await this.signaling.sendSignal({
            type: 'answer',
            fromPeerId: this.localPeerId,
            toPeerId: fromPeerId,
            roomId: this.roomId,
            payload: answer,
          });
          break;
        }

        case 'answer': {
          if (pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            await this.flushPendingCandidates(fromPeerId, pc);
          }
          break;
        }

        case 'ice-candidate': {
          try {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(payload));
            } else {
              if (!this.pendingCandidates.has(fromPeerId)) {
                this.pendingCandidates.set(fromPeerId, []);
              }
              this.pendingCandidates.get(fromPeerId)!.push(payload);
            }
          } catch (err) {
            if (!session.ignoreOffer) {
              console.warn('[WebRTC] ICE candidate exception:', err);
            }
          }
          break;
        }

        case 'leave-room': {
          this.closePeer(fromPeerId);
          break;
        }
      }
    } catch (err) {
      console.error('[WebRTC] Signal handling exception:', err);
    }
  }

  private getOrCreatePeerSession(peerId: string): PeerSession {
    if (this.peerSessions.has(peerId)) {
      return this.peerSessions.get(peerId)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const polite = this.localPeerId < peerId;

    const session: PeerSession = {
      pc,
      polite,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      connectionQuality: 'good',
    };

    this.peerSessions.set(peerId, session);

    // Publish local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE Candidate Generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendSignal({
          type: 'ice-candidate',
          fromPeerId: this.localPeerId,
          toPeerId: peerId,
          roomId: this.roomId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Remote Stream Delivery with Camera vs Screen Share Stream Isolation
    pc.ontrack = (event) => {
      const track = event.track;
      const [remoteStream] = event.streams;
      const isScreenSharing = this.peerScreenSharingState.get(peerId);

      // If peer is actively screen sharing and already has camera stream, route second video to screen
      const currentCamStream = this.remoteStreams.get(peerId);
      if (
        isScreenSharing &&
        currentCamStream &&
        currentCamStream.getVideoTracks().length > 0 &&
        track.kind === 'video'
      ) {
        let scrStream = this.remoteScreenStreams.get(peerId);
        if (!scrStream) {
          scrStream = new MediaStream();
          this.remoteScreenStreams.set(peerId, scrStream);
        }
        if (!scrStream.getTracks().includes(track)) {
          scrStream.addTrack(track);
        }
        this.callbacks.onRemoteScreenStream?.(peerId, scrStream);
      } else {
        let camStream = this.remoteStreams.get(peerId);
        if (!camStream) {
          camStream = remoteStream || new MediaStream();
          this.remoteStreams.set(peerId, camStream);
        }
        if (!camStream.getTracks().includes(track)) {
          camStream.addTrack(track);
        }
        this.callbacks.onRemoteStream(peerId, camStream);
      }
    };

    // Connection Lifecycle State Handling
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.updateQuality(peerId, 'excellent');
        this.evaluateOverallLifecycle();
      } else if (state === 'connecting') {
        this.updateQuality(peerId, 'reconnecting');
      } else if (state === 'disconnected') {
        this.updateQuality(peerId, 'poor');
        this.setLifecycleState('degraded');
        // Graceful ICE restart
        this.restartPeerIce(session, peerId);
      } else if (state === 'failed') {
        this.updateQuality(peerId, 'poor');
        this.setLifecycleState('reconnecting');
        this.restartPeerIce(session, peerId);
      } else if (state === 'closed') {
        this.closePeer(peerId);
      }
    };

    // Trigger initial stats collection for the newly established peer session
    this.collectGlobalStats().catch(() => {});

    return session;
  }

  // ==========================================
  // REAL STATS & DYNAMIC BANDWIDTH ADAPTATION
  // ==========================================

  private startGlobalStatsPolling(): void {
    this.stopGlobalStatsPolling();
    // Run an immediate collection so telemetry is available instantly without a 2s delay
    this.collectGlobalStats().catch(() => {});
    this.globalStatsInterval = window.setInterval(async () => {
      await this.collectGlobalStats();
    }, 2000);
  }

  private stopGlobalStatsPolling(): void {
    if (this.globalStatsInterval !== null) {
      clearInterval(this.globalStatsInterval);
      this.globalStatsInterval = null;
    }
    this.lastGlobalStats = null;
  }

  private async collectGlobalStats(): Promise<void> {
    try {
      const now = Date.now();

      // 1. Inspect active local hardware tracks (camera / mic / screen)
      const activeVideoTrack =
        this.screenStream?.getVideoTracks().find((t) => t.readyState === 'live') ||
        this.localStream?.getVideoTracks().find((t) => t.readyState === 'live');
      const activeAudioTrack = this.localStream?.getAudioTracks().find((t) => t.readyState === 'live');

      let localRes: string | undefined;
      let localFps: number | undefined;

      if (activeVideoTrack && activeVideoTrack.enabled) {
        const settings = activeVideoTrack.getSettings();
        if (settings.width && settings.height) {
          localRes = `${settings.width}x${settings.height}`;
        }
        if (settings.frameRate) {
          localFps = Math.round(settings.frameRate);
        }
      }

      const defaultAudioCodec = activeAudioTrack && activeAudioTrack.enabled ? 'Opus 48kHz' : undefined;
      const defaultVideoCodec = activeVideoTrack && activeVideoTrack.enabled ? 'VP8 / H.264' : undefined;

      // 2. Solo mode: User is in the room without remote peers (waiting for friends)
      if (this.peerSessions.size === 0) {
        this.localStats = {
          rtt: undefined,
          packetLoss: undefined,
          jitter: undefined,
          bitrate: 0,
          fps: localFps,
          resolution: localRes,
          audioCodec: defaultAudioCodec,
          videoCodec: defaultVideoCodec,
          quality: 'excellent',
        };
        this.callbacks.onConnectionQualityChanged?.(this.localPeerId, 'excellent', this.localStats);
        return;
      }

      // 3. Multi-peer mode: Query RTCPeerConnection statistics across all connected sessions
      let totalRttSum = 0;
      let rttCount = 0;
      let maxJitter: number | undefined;
      let totalPacketsLost = 0;
      let totalPacketsReceived = 0;
      let totalPacketsSent = 0;
      let totalBytesReceived = 0;
      let totalBytesSent = 0;
      let hasPacketData = false;
      let hasBytesData = false;
      let measuredRes: string | undefined = localRes;
      let measuredFps: number | undefined = localFps;
      let audioCodec: string | undefined = defaultAudioCodec;
      let videoCodec: string | undefined = defaultVideoCodec;
      let measuredFrameDropRate: number | undefined;

      for (const [peerId, session] of this.peerSessions.entries()) {
        if (session.pc.connectionState !== 'connected') continue;

        try {
          const stats = await session.pc.getStats();

          // Codec map for this session
          const codecMap = new Map<string, string>();
          stats.forEach((report) => {
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

          let sessionRtt: number | undefined;
          let sessionLoss: number | undefined;

          stats.forEach((report) => {
            // Selected candidate-pair (RTT)
            if (
              report.type === 'candidate-pair' &&
              (report.nominated || report.state === 'succeeded' || report.selected)
            ) {
              if (report.currentRoundTripTime !== undefined) {
                const rttMs = Math.round(report.currentRoundTripTime * 1000);
                totalRttSum += rttMs;
                rttCount++;
                sessionRtt = rttMs;
              }
            }

            // Remote inbound RTP (RTCP RTT feedback)
            if (report.type === 'remote-inbound-rtp') {
              if (sessionRtt === undefined && report.roundTripTime !== undefined) {
                const rttMs = Math.round(report.roundTripTime * 1000);
                totalRttSum += rttMs;
                rttCount++;
                sessionRtt = rttMs;
              }
              if (report.jitter !== undefined) {
                const jMs = Math.round(report.jitter * 1000);
                maxJitter = Math.max(maxJitter ?? 0, jMs);
              }
            }

            // Inbound & Outbound RTP
            if (report.type === 'inbound-rtp' || report.type === 'outbound-rtp') {
              const kind = report.kind || report.mediaType;
              if (kind === 'audio') {
                const resolved =
                  (report.codecId && codecMap.get(report.codecId)) ||
                  (report.mimeType ? report.mimeType.split('/')[1] : undefined);
                if (resolved) audioCodec = resolved;
              } else if (kind === 'video') {
                const resolved =
                  (report.codecId && codecMap.get(report.codecId)) ||
                  (report.mimeType ? report.mimeType.split('/')[1] : undefined);
                if (resolved) videoCodec = resolved;
                if (report.frameWidth && report.frameHeight) {
                  measuredRes = `${report.frameWidth}x${report.frameHeight}`;
                }
                if (report.framesPerSecond !== undefined && report.framesPerSecond > 0) {
                  measuredFps = Math.round(report.framesPerSecond);
                }
                if (report.framesDropped !== undefined && report.framesReceived) {
                  measuredFrameDropRate = Math.round(
                    (report.framesDropped / (report.framesDropped + report.framesReceived)) * 100
                  );
                }
              }

              if (report.type === 'inbound-rtp') {
                if (report.packetsLost !== undefined) {
                  totalPacketsLost += report.packetsLost;
                  hasPacketData = true;
                }
                if (report.packetsReceived !== undefined) {
                  totalPacketsReceived += report.packetsReceived;
                  hasPacketData = true;
                }
                if (report.jitter !== undefined) {
                  maxJitter = Math.max(maxJitter ?? 0, Math.round(report.jitter * 1000));
                }
                if (report.bytesReceived !== undefined) {
                  totalBytesReceived += report.bytesReceived;
                  hasBytesData = true;
                }
              }

              if (report.type === 'outbound-rtp') {
                if (report.bytesSent !== undefined) {
                  totalBytesSent += report.bytesSent;
                  hasBytesData = true;
                }
                if (report.packetsSent !== undefined) {
                  totalPacketsSent += report.packetsSent;
                }
              }
            }
          });

          // Session-level quality calculation
          let sessionQuality: ConnectionQuality = session.connectionQuality;
          if (sessionRtt !== undefined || sessionLoss !== undefined) {
            const rttVal = sessionRtt ?? 0;
            const lossVal = sessionLoss ?? 0;
            if (rttVal > 350 || lossVal > 12) sessionQuality = 'poor';
            else if (rttVal > 220 || lossVal > 5) sessionQuality = 'fair';
            else if (rttVal > 120 || lossVal > 2) sessionQuality = 'good';
            else sessionQuality = 'excellent';
          }
          session.connectionQuality = sessionQuality;

          // Bandwidth adaptation for this peer
          if (sessionQuality === 'poor' || sessionQuality === 'fair') {
            this.adaptVideoSenderBitrate(session.pc, sessionQuality === 'poor' ? 300000 : 600000);
          } else {
            this.adaptVideoSenderBitrate(session.pc, 2500000);
          }
        } catch (err) {
          console.warn(`[WebRTC] Error collecting stats for peer ${peerId}:`, err);
        }
      }

      // Aggregate bandwidth & packet loss calculation
      const measuredRtt = rttCount > 0 ? Math.round(totalRttSum / rttCount) : undefined;
      let measuredBitrate: number | undefined;
      let packetLossPercent: number | undefined;

      const currentTotalBytes = totalBytesReceived + totalBytesSent;
      if (this.lastGlobalStats) {
        const timeDelta = (now - this.lastGlobalStats.timestamp) / 1000;
        if (timeDelta > 0) {
          if (hasBytesData) {
            const bytesDelta = currentTotalBytes - (this.lastGlobalStats.bytesReceived + this.lastGlobalStats.bytesSent);
            if (bytesDelta >= 0) {
              measuredBitrate = Math.round((bytesDelta * 8) / (timeDelta * 1000));
            }
          }

          if (hasPacketData) {
            const lossDelta = Math.max(0, totalPacketsLost - this.lastGlobalStats.packetsLost);
            const recvDelta = Math.max(0, totalPacketsReceived - this.lastGlobalStats.packetsReceived);
            const totalPackets = lossDelta + recvDelta;
            if (totalPackets > 0) {
              packetLossPercent = Math.min(100, Math.round((lossDelta / totalPackets) * 100));
            }
          }
        }
      }

      this.lastGlobalStats = {
        timestamp: now,
        bytesReceived: totalBytesReceived,
        bytesSent: totalBytesSent,
        packetsReceived: totalPacketsReceived,
        packetsSent: totalPacketsSent,
        packetsLost: totalPacketsLost,
      };

      // Aggregate holistic quality
      let overallQuality: ConnectionQuality = 'excellent';
      if (measuredRtt !== undefined || packetLossPercent !== undefined) {
        const rttVal = measuredRtt ?? 0;
        const lossVal = packetLossPercent ?? 0;
        if (rttVal > 350 || lossVal > 12) overallQuality = 'poor';
        else if (rttVal > 220 || lossVal > 5) overallQuality = 'fair';
        else if (rttVal > 120 || lossVal > 2) overallQuality = 'good';
        else overallQuality = 'excellent';
      }

      this.localStats = {
        rtt: measuredRtt,
        packetLoss: packetLossPercent,
        jitter: maxJitter,
        bitrate: measuredBitrate ?? (hasBytesData ? 0 : undefined),
        fps: measuredFps,
        frameDropRate: measuredFrameDropRate,
        resolution: measuredRes,
        audioCodec: audioCodec || defaultAudioCodec,
        videoCodec: videoCodec || defaultVideoCodec,
        quality: overallQuality,
      };

      this.callbacks.onConnectionQualityChanged?.(this.localPeerId, overallQuality, this.localStats);
    } catch (err) {
      console.warn('[WebRTC] Error during global stats collection:', err);
    }
  }

  private async adaptVideoSenderBitrate(pc: RTCPeerConnection, maxBitrateBps: number): Promise<void> {
    const now = Date.now();
    // 4-second hysteresis hold time prevents rapid quality oscillation
    if (now - this.lastBitrateAdaptTime < 4000 && maxBitrateBps > 300000) return;
    this.lastBitrateAdaptTime = now;

    const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (!videoSender || !videoSender.getParameters) return;

    try {
      const params = videoSender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      if (params.encodings[0].maxBitrate !== maxBitrateBps) {
        params.encodings[0].maxBitrate = maxBitrateBps;
        await videoSender.setParameters(params);
      }
    } catch {}
  }

  private updateQuality(peerId: string, quality: ConnectionQuality, stats?: ConnectionStats) {
    const session = this.peerSessions.get(peerId);
    if (session) {
      session.connectionQuality = quality;
      this.callbacks.onConnectionQualityChanged?.(peerId, quality, stats);
    }
  }

  private setLifecycleState(state: MediaLifecycleState) {
    if (this.lifecycleState !== state) {
      this.lifecycleState = state;
      this.callbacks.onConnectionStateChanged?.(state);
    }
  }

  private evaluateOverallLifecycle() {
    if (this.peerSessions.size === 0) {
      this.setLifecycleState('connected');
      return;
    }

    let hasPoor = false;
    let hasConnecting = false;
    let connectedCount = 0;

    this.peerSessions.forEach((s) => {
      if (s.pc.connectionState === 'connected') connectedCount++;
      if (s.pc.connectionState === 'connecting') hasConnecting = true;
      if (s.connectionQuality === 'poor') hasPoor = true;
    });

    if (hasConnecting) {
      this.setLifecycleState('reconnecting');
    } else if (hasPoor) {
      this.setLifecycleState('degraded');
    } else if (connectedCount > 0) {
      this.setLifecycleState('connected');
    }
  }

  // ==========================================
  // RECONNECTION & RECOVERY LOGIC
  // ==========================================

  private async restartPeerIce(session: PeerSession, peerId: string) {
    try {
      session.pc.restartIce();
      const offer = await session.pc.createOffer({ iceRestart: true });
      offer.sdp = mungeOpusSDP(offer.sdp || '');
      await session.pc.setLocalDescription(offer);

      await this.signaling.sendSignal({
        type: 'offer',
        fromPeerId: this.localPeerId,
        toPeerId: peerId,
        roomId: this.roomId,
        payload: offer,
      });
    } catch (err) {
      console.warn(`[WebRTC] ICE restart failed for peer ${peerId}:`, err);
    }
  }

  private recoverConnections(trigger: string) {
    console.info(`[WebRTC] Auto-recovering connections triggered by: ${trigger}`);
    this.peerSessions.forEach((session, peerId) => {
      if (session.pc.connectionState !== 'connected') {
        this.restartPeerIce(session, peerId);
      }
    });
  }

  private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection) {
    const candidates = this.pendingCandidates.get(peerId);
    if (candidates && candidates.length > 0) {
      for (const cand of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Candidate flush warning:', e);
        }
      }
      this.pendingCandidates.delete(peerId);
    }
  }

  private closePeer(peerId: string) {
    const session = this.peerSessions.get(peerId);
    if (session) {
      session.pc.close();
      this.peerSessions.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
    this.remoteStreams.delete(peerId);
    this.remoteScreenStreams.delete(peerId);
    this.peerScreenSharingState.delete(peerId);
    this.callbacks.onPeerLeft(peerId);
    this.evaluateOverallLifecycle();
    this.collectGlobalStats().catch(() => {});
  }

  public async leave(): Promise<void> {
    this.stopGlobalStatsPolling();

    if (this.unsubSignal) {
      this.unsubSignal();
      this.unsubSignal = undefined;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    await this.signaling.leave(this.roomId, this.localPeerId);

    for (const [, session] of this.peerSessions.entries()) {
      session.pc.close();
    }
    this.peerSessions.clear();
    this.pendingCandidates.clear();
    this.remoteStreams.clear();
    this.remoteScreenStreams.clear();
    this.peerScreenSharingState.clear();
    this.screenStream = null;
    this.signaling.destroy();
    this.setLifecycleState('idle');
  }

  public getConnectionQuality(): ConnectionQuality {
    return this.localStats.quality;
  }

  public getConnectionStats(): ConnectionStats {
    return this.localStats;
  }

  public destroy(): void {
    this.leave();
  }
}
