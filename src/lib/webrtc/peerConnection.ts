import { PeerSignalMessage, ConnectionQuality } from '../../types';
import { ISignalingTransport, createSignalingTransport } from './signaling';
import { ITransportAdapter, TransportCallbacks } from './transportAdapter';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface PeerSession {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  connectionQuality: ConnectionQuality;
  statsInterval?: number;
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

  constructor(localPeerId: string, callbacks: TransportCallbacks) {
    this.localPeerId = localPeerId;
    this.callbacks = callbacks;
    this.signaling = createSignalingTransport();
  }

  public async join(roomId: string, localStream: MediaStream | null): Promise<void> {
    this.roomId = roomId;
    this.localStream = localStream;

    this.unsubSignal = this.signaling.onSignal(async (signal: PeerSignalMessage) => {
      if (signal.fromPeerId === this.localPeerId || signal.roomId !== this.roomId) return;
      if (signal.toPeerId && signal.toPeerId !== this.localPeerId) return;

      await this.handleSignal(signal);
    });

    await this.signaling.join(roomId, this.localPeerId);
  }

  public async updateLocalStream(newStream: MediaStream | null): Promise<void> {
    this.localStream = newStream;

    for (const [peerId, session] of this.peerSessions.entries()) {
      const senders = session.pc.getSenders();

      if (newStream) {
        newStream.getTracks().forEach((track) => {
          const sender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch((err) => console.warn('replaceTrack error:', err));
          } else {
            session.pc.addTrack(track, newStream);
          }
        });
      }
    }
  }

  // Glare-Free Perfect Negotiation Pattern
  private async handleSignal(signal: PeerSignalMessage): Promise<void> {
    const { fromPeerId, type, payload } = signal;
    const session = this.getOrCreatePeerSession(fromPeerId);
    const pc = session.pc;

    try {
      switch (type) {
        case 'join-room': {
          // Existing peers send initial offer
          session.makingOffer = true;
          const offer = await pc.createOffer();
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
            console.warn(`[WebRTC] Glare detected. Impolite peer ${this.localPeerId} ignoring offer from ${fromPeerId}`);
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(payload));
          this.flushPendingCandidates(fromPeerId, pc);

          const answer = await pc.createAnswer();
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
            this.flushPendingCandidates(fromPeerId, pc);
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
              console.warn('[WebRTC] ICE candidate error:', err);
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
      console.error('[WebRTC] Signal handling error:', err);
    }
  }

  private getOrCreatePeerSession(peerId: string): PeerSession {
    if (this.peerSessions.has(peerId)) {
      return this.peerSessions.get(peerId)!;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    // Determine politeness deterministically based on string ID comparison
    const polite = this.localPeerId < peerId;

    const session: PeerSession = {
      pc,
      polite,
      makingOffer: false,
      ignoreOffer: false,
      connectionQuality: 'good',
    };

    this.peerSessions.set(peerId, session);

    // Add local tracks
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

    // Remote stream detection
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        this.callbacks.onRemoteStream(peerId, remoteStream);
      }
    };

    // Connection state & auto-recovery
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        this.updateQuality(peerId, 'excellent');
      } else if (state === 'connecting') {
        this.updateQuality(peerId, 'reconnecting');
      } else if (state === 'disconnected' || state === 'failed') {
        this.updateQuality(peerId, 'poor');
        // Auto attempt ICE restart if failed
        if (state === 'failed') {
          pc.restartIce();
        }
      } else if (state === 'closed') {
        this.closePeer(peerId);
      }
    };

    // Real Connection Quality Statistics via getStats()
    session.statsInterval = window.setInterval(async () => {
      if (pc.connectionState !== 'connected') return;
      try {
        const stats = await pc.getStats();
        let rtt = 0;
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
            rtt = report.currentRoundTripTime * 1000;
          }
        });

        if (rtt > 0) {
          const quality: ConnectionQuality = rtt < 120 ? 'excellent' : rtt < 280 ? 'good' : 'poor';
          this.updateQuality(peerId, quality);
        }
      } catch {
        // Stats failed
      }
    }, 3000);

    return session;
  }

  private updateQuality(peerId: string, quality: ConnectionQuality) {
    const session = this.peerSessions.get(peerId);
    if (session && session.connectionQuality !== quality) {
      session.connectionQuality = quality;
      if (this.callbacks.onConnectionQualityChanged) {
        this.callbacks.onConnectionQualityChanged(peerId, quality);
      }
    }
  }

  private async flushPendingCandidates(peerId: string, pc: RTCPeerConnection) {
    const candidates = this.pendingCandidates.get(peerId);
    if (candidates && candidates.length > 0) {
      for (const cand of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Candidate flush error:', e);
        }
      }
      this.pendingCandidates.delete(peerId);
    }
  }

  private closePeer(peerId: string) {
    const session = this.peerSessions.get(peerId);
    if (session) {
      if (session.statsInterval) clearInterval(session.statsInterval);
      session.pc.close();
      this.peerSessions.delete(peerId);
    }
    this.pendingCandidates.delete(peerId);
    this.callbacks.onPeerLeft(peerId);
  }

  public async leave(): Promise<void> {
    if (this.unsubSignal) {
      this.unsubSignal();
      this.unsubSignal = undefined;
    }

    await this.signaling.leave(this.roomId, this.localPeerId);

    for (const [peerId, session] of this.peerSessions.entries()) {
      if (session.statsInterval) clearInterval(session.statsInterval);
      session.pc.close();
    }
    this.peerSessions.clear();
    this.pendingCandidates.clear();
    this.signaling.destroy();
  }

  public getConnectionQuality(): ConnectionQuality {
    return 'excellent';
  }

  public destroy(): void {
    this.leave();
  }
}
