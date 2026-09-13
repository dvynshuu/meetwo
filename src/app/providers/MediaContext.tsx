import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  Participant,
  MediaDeviceSettings,
  ConnectionQuality,
  ConnectionStats,
  MediaLifecycleState,
  StageRole,
} from '../../types';
import { MediaSession } from '../../lib/webrtc/mediaSession';
import { PeerConnectionManager } from '../../lib/webrtc/peerConnection';
import { LiveKitSFUAdapter, ITransportAdapter } from '../../lib/webrtc/transportAdapter';
import { getLiveKitToken } from '../../lib/webrtc/livekitToken';
import { ReconnectionManager } from '../../lib/webrtc/reconnectionManager';
import { logger } from '../../lib/webrtc/observability';
import { mockStore } from '../../lib/supabase/mockStore';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { useAuth } from './AuthContext';

interface MediaContextType {
  activeRoomId: string | null;
  connectionState: MediaLifecycleState;
  connectionStats: ConnectionStats;
  reconnectMessage: string | null;
  deviceNotification: { kind: 'audio' | 'video'; action: 'disconnected' | 'reconnected'; label?: string } | null;
  dismissDeviceNotification: () => void;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  audioLevel: number;
  isSpeaking: boolean;
  participants: Participant[];
  pinnedParticipantId: string | null;
  setPinnedParticipantId: (id: string | null) => void;
  deviceSettings: MediaDeviceSettings;
  pendingRoomId: string | null;
  isPreJoinOpen: boolean;
  isDiagnosticsOpen: boolean;
  openDiagnostics: () => void;
  closeDiagnostics: () => void;
  toggleDiagnostics: () => void;
  openPreJoin: (roomId: string) => void;
  closePreJoin: () => void;
  joinVoiceRoom: (roomId: string, initialAudioMuted?: boolean, initialVideoMuted?: boolean) => Promise<void>;
  leaveVoiceRoom: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  switchCamera: (deviceId: string) => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;
  updateSettings: (settings: Partial<MediaDeviceSettings>) => void;
  raiseHand: () => Promise<void>;
  lowerHand: () => Promise<void>;
  setStageRole: (role: 'host' | 'speaker' | 'listener') => Promise<void>;
  inviteToStage: (targetUserId: string) => Promise<void>;
  demoteToListener: (targetUserId: string) => Promise<void>;
  lowerParticipantHand: (targetUserId: string) => Promise<void>;
  productionConfigError: string | null;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [isPreJoinOpen, setIsPreJoinOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const [connectionState, setConnectionState] = useState<MediaLifecycleState>('idle');
  const [reconnectMessage, setReconnectMessage] = useState<string | null>(null);
  const [deviceNotification, setDeviceNotification] = useState<{
    kind: 'audio' | 'video';
    action: 'disconnected' | 'reconnected';
    label?: string;
  } | null>(null);

  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    quality: 'unknown',
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);

  // Stage states for current user (strictly default to listener)
  const [myStageRole, setMyStageRole] = useState<'host' | 'speaker' | 'listener'>('listener');
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [productionConfigError, setProductionConfigError] = useState<string | null>(null);

  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, Participant>>(new Map());

  const mediaSessionRef = useRef<MediaSession>(new MediaSession());
  const transportRef = useRef<ITransportAdapter | null>(null);
  const reconnectionManagerRef = useRef<ReconnectionManager | null>(null);

  const lastAudioLevelUpdateRef = useRef<number>(0);
  const lastSpeakingRef = useRef<boolean>(false);

  const [deviceSettings, setDeviceSettings] = useState<MediaDeviceSettings>(
    mediaSessionRef.current.settings
  );

  const dismissDeviceNotification = useCallback(() => {
    setDeviceNotification(null);
  }, []);

  const openDiagnostics = useCallback(() => setIsDiagnosticsOpen(true), []);
  const closeDiagnostics = useCallback(() => setIsDiagnosticsOpen(false), []);
  const toggleDiagnostics = useCallback(() => setIsDiagnosticsOpen((prev) => !prev), []);

  // Bind AudioDSP listeners and hardware track change listeners
  useEffect(() => {
    mediaSessionRef.current.setEvents({
      onAudioLevel: (level, speaking) => {
        const now = performance.now();
        const speakingChanged = speaking !== lastSpeakingRef.current;
        const timeElapsed = now - lastAudioLevelUpdateRef.current >= 120;

        if (speakingChanged || timeElapsed) {
          lastAudioLevelUpdateRef.current = now;
          lastSpeakingRef.current = speaking;
          setAudioLevel(level);
          setIsSpeaking(speaking);
        }

        if (transportRef.current) {
          transportRef.current.sendSpeakingState(speaking, level).catch(() => {});
        }
      },
      onTrackChanged: async (kind, track) => {
        if (transportRef.current) {
          if (kind === 'audio' || kind === 'video') {
            await transportRef.current.replaceTrack(kind, track);
          }
        }
      },
      onDeviceUnplugged: async (kind) => {
        console.warn(`[MediaEngine] ${kind} hardware was disconnected/unplugged`);
        setDeviceNotification({ kind, action: 'disconnected' });
        setTimeout(() => setDeviceNotification(null), 5000);

        if (kind === 'video') {
          setIsVideoMuted(true);
          if (transportRef.current) {
            await transportRef.current.sendMuteState(isAudioMuted, true);
          }
        } else if (kind === 'audio') {
          setIsAudioMuted(true);
          if (transportRef.current) {
            await transportRef.current.sendMuteState(true, isVideoMuted);
          }
        }
      },
      onDeviceReconnected: async (kind, label) => {
        console.info(`[MediaEngine] ${kind} hardware reconnected: ${label}`);
        setDeviceNotification({ kind, action: 'reconnected', label });
        setTimeout(() => setDeviceNotification(null), 5000);

        if (kind === 'audio') {
          try {
            await mediaSessionRef.current.startMicrophone();
            setIsAudioMuted(false);
          } catch {}
        } else if (kind === 'video') {
          try {
            await mediaSessionRef.current.startCamera();
            setIsVideoMuted(false);
          } catch {}
        }
      },
    });

    return () => {
      mediaSessionRef.current.stopLocalMedia();
      reconnectionManagerRef.current?.destroy();
    };
  }, [isAudioMuted, isVideoMuted]);

  // Synchronize server-authoritative stage state machine
  useEffect(() => {
    const unsubStage = mockStore.on('STAGE_STATE_CHANGED', (stage: any) => {
      if (activeRoomId && stage.channelId === activeRoomId) {
        if (currentUser) {
          const isHost = stage.hostId === currentUser.id;
          const isSpeaker = stage.speakers.includes(currentUser.id);
          const role = isHost ? 'host' : isSpeaker ? 'speaker' : 'listener';
          setMyStageRole(role);
          setMyHandRaised(stage.handRaisedQueue.includes(currentUser.id));
        }

        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          next.forEach((participant, peerId) => {
            const pUserId = participant.userId || peerId;
            const isHost = stage.hostId === pUserId;
            const isSpeaker = stage.speakers.includes(pUserId);
            const pRole = isHost ? 'host' : isSpeaker ? 'speaker' : 'listener';
            next.set(peerId, {
              ...participant,
              stageRole: pRole,
              isStageSpeaker: isHost || isSpeaker,
              isHandRaised: stage.handRaisedQueue.includes(pUserId),
            });
          });
          return next;
        });
      }
    });

    const unsubApproved = mockStore.on('STAGE_ACTION_APPROVED', (data: { channelId: string; targetUserId: string; action: 'invite' | 'demote' }) => {
      if (activeRoomId && data.channelId === activeRoomId && currentUser && data.targetUserId === currentUser.id) {
        if (data.action === 'invite') {
          setMyStageRole('speaker');
          setMyHandRaised(false);
        } else if (data.action === 'demote') {
          setMyStageRole('listener');
        }
      }
    });

    return () => {
      unsubStage();
      unsubApproved();
    };
  }, [activeRoomId, currentUser]);

  const openPreJoin = useCallback((roomId: string) => {
    setPendingRoomId(roomId);
    setIsPreJoinOpen(true);
  }, []);

  const closePreJoin = useCallback(() => {
    setIsPreJoinOpen(false);
    setPendingRoomId(null);
  }, []);

  // Global keyboard shortcut for WebRTC diagnostics (Ctrl+Shift+D or Cmd+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDiagnosticsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const joinVoiceRoom = useCallback(
    async (roomId: string, initialAudioMuted: boolean = false, initialVideoMuted: boolean = false) => {
      if (!currentUser) return;
      if (activeRoomId === roomId) return;

      // Close pre-join if it was open
      setIsPreJoinOpen(false);
      setPendingRoomId(null);

      // Gracefully leave existing room
      if (activeRoomId) {
        await leaveVoiceRoom();
      }

      setActiveRoomId(roomId);
      setConnectionState('initializing');
      setIsAudioMuted(initialAudioMuted);
      setIsVideoMuted(initialVideoMuted);
      setIsScreenSharing(false);
      setPinnedParticipantId(null);
      setMyHandRaised(false);

      try {
        // 1. Initialize separated audio and video hardware tracks
        const stream = await mediaSessionRef.current.startLocalMedia(
          !initialAudioMuted,
          !initialVideoMuted,
          deviceSettings.videoQuality
        );
        setLocalStream(stream);

        // 2. Select appropriate transport (LiveKit SFU or Direct Enhanced Engine)
        const livekitUrl = (import.meta as any).env?.VITE_LIVEKIT_URL;
        let livekitToken = (import.meta as any).env?.VITE_LIVEKIT_TOKEN;

        if (livekitUrl) {
          const dynamicToken = await getLiveKitToken({
            roomId,
            userId: currentUser.id,
            username: currentUser.displayName || currentUser.username,
          });
          if (dynamicToken) {
            livekitToken = dynamicToken;
          }
        }

        // Check stage state if active room is a stage channel
        const stageState = mockStore.getStageState(roomId);
        const isHost = stageState.hostId === currentUser.id;
        const isSpeaker = stageState.speakers.includes(currentUser.id);
        const initialRole: StageRole = isHost ? 'host' : isSpeaker ? 'speaker' : 'listener';
        setMyStageRole(initialRole);
        setMyHandRaised(stageState.handRaisedQueue.includes(currentUser.id));

        // Initialize dedicated Reconnection Manager
        reconnectionManagerRef.current = new ReconnectionManager({
          onStateChange: (state, userMessage) => {
            setConnectionState(state);
            setReconnectMessage(userMessage || null);
          },
          onPerformIceRestart: async () => {
            if (transportRef.current && (transportRef.current as any).recoverConnections) {
              (transportRef.current as any).recoverConnections('reconnection_engine');
              return true;
            }
            return false;
          },
        });

        const resolvePeerProfile = async (peerId: string) => {
          if (!isSupabaseConfigured || !supabase || !peerId) return;
          try {
            const { data } = await supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .eq('id', peerId)
              .maybeSingle();

            if (data) {
              setRemoteParticipants((prev) => {
                const target = prev.get(peerId);
                if (target) {
                  const next = new Map(prev);
                  next.set(peerId, {
                    ...target,
                    username: (data as any).username || target.username,
                    displayName: (data as any).display_name || (data as any).username || target.displayName,
                    avatarUrl: (data as any).avatar_url || target.avatarUrl,
                  });
                  return next;
                }
                return prev;
              });
            }
          } catch {}
        };

        const callbacks = {
          onRemoteStream: (peerId: string, remoteStream: MediaStream) => {
            if (peerId === currentUser.id) return;
            resolvePeerProfile(peerId);
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(peerId);
              next.set(peerId, {
                id: peerId,
                userId: peerId,
                username: existing?.username || `User`,
                displayName: existing?.displayName || `User`,
                avatarUrl: existing?.avatarUrl,
                stream: remoteStream,
                screenStream: existing?.screenStream,
                isAudioMuted: existing?.isAudioMuted || false,
                isVideoMuted: existing?.isVideoMuted || false,
                isScreenSharing: existing?.isScreenSharing || false,
                isSpeaking: existing?.isSpeaking || false,
                stageRole: existing?.stageRole || 'listener',
                isStageSpeaker: existing?.isStageSpeaker ?? false,
                isHandRaised: existing?.isHandRaised || false,
                audioLevel: existing?.audioLevel || 0,
                connectionQuality: existing?.connectionQuality || 'unknown',
              });
              return next;
            });
          },
          onRemoteScreenStream: (peerId: string, remoteScreenStream: MediaStream | null) => {
            if (peerId === currentUser.id) return;
            resolvePeerProfile(peerId);
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(peerId);
              if (existing) {
                next.set(peerId, {
                  ...existing,
                  screenStream: remoteScreenStream || undefined,
                  isScreenSharing: Boolean(remoteScreenStream),
                });
              } else if (remoteScreenStream) {
                next.set(peerId, {
                  id: peerId,
                  userId: peerId,
                  username: `User`,
                  displayName: `User`,
                  screenStream: remoteScreenStream,
                  isScreenSharing: true,
                  isAudioMuted: false,
                  isVideoMuted: true,
                  isSpeaking: false,
                  stageRole: 'listener',
                  isStageSpeaker: false,
                  isHandRaised: false,
                  audioLevel: 0,
                  connectionQuality: 'unknown',
                });
              }
              return next;
            });
          },
          onPeerLeft: (peerId: string) => {
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              next.delete(peerId);
              return next;
            });
            setPinnedParticipantId((curr) => (curr === peerId ? null : curr));
          },
          onPeerStateChanged: (peerId: string, state: any) => {
            if (peerId === currentUser.id) return;
            if (!state.displayName && !state.username) {
              resolvePeerProfile(peerId);
            }
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const target = next.get(peerId);
              if (target) {
                const updated = { ...target, ...state };
                if (state.stageRole) {
                  updated.isStageSpeaker = state.stageRole === 'host' || state.stageRole === 'speaker';
                }
                next.set(peerId, updated);
              } else if (state.isScreenSharing || state.stream || state.displayName || state.username) {
                // Only spawn new remote participant for real presence/media/identity signals, not arbitrary noise
                next.set(peerId, {
                  id: peerId,
                  userId: peerId,
                  username: state.username || `User`,
                  displayName: state.displayName || state.username || `User`,
                  avatarUrl: state.avatarUrl,
                  isAudioMuted: false,
                  isVideoMuted: true,
                  isSpeaking: false,
                  stageRole: 'listener',
                  isStageSpeaker: false,
                  isHandRaised: false,
                  audioLevel: 0,
                  connectionQuality: 'unknown',
                  ...state,
                });
              }
              return next;
            });
          },
          onConnectionQualityChanged: (
            peerId: string,
            quality: ConnectionQuality,
            stats?: ConnectionStats
          ) => {
            if (peerId === currentUser.id) return;
            if (stats) {
              setConnectionStats(stats);
              reconnectionManagerRef.current?.evaluateMetrics(stats.rtt, stats.packetLoss);
            }
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const target = next.get(peerId);
              if (target) {
                next.set(peerId, { ...target, connectionQuality: quality, stats });
              }
              return next;
            });
          },
          onConnectionStateChanged: (state: MediaLifecycleState) => {
            setConnectionState(state);
            if (state === 'connected') {
              reconnectionManagerRef.current?.setConnected();
              setReconnectMessage(null);
            }
          },
          onTargetedStageAction: (action: 'invite' | 'demote' | 'lower-hand', targetUserId: string) => {
            if (targetUserId === currentUser.id) {
              if (action === 'invite') {
                setMyStageRole('speaker');
                setMyHandRaised(false);
              } else if (action === 'demote') {
                setMyStageRole('listener');
              } else if (action === 'lower-hand') {
                setMyHandRaised(false);
              }
            } else {
              setRemoteParticipants((prev) => {
                const next = new Map(prev);
                const target = next.get(targetUserId);
                if (target) {
                  const updated = { ...target };
                  if (action === 'invite') {
                    updated.stageRole = 'speaker';
                    updated.isStageSpeaker = true;
                    updated.isHandRaised = false;
                  } else if (action === 'demote') {
                    updated.stageRole = 'listener';
                    updated.isStageSpeaker = false;
                  } else if (action === 'lower-hand') {
                    updated.isHandRaised = false;
                  }
                  next.set(targetUserId, updated);
                }
                return next;
              });
            }
          },
        };

        let transport: ITransportAdapter;
        if (livekitUrl && livekitToken) {
          console.info('[MediaEngine] Initializing LiveKit SFU Transport (Primary Production Transport)');
          setProductionConfigError(null);
          transport = new LiveKitSFUAdapter(livekitUrl, livekitToken, callbacks);
        } else {
          // Graceful fallback to Enhanced Direct Media Engine (WebRTC Mesh)
          if (livekitUrl && !livekitToken) {
            console.warn(
              '[MediaEngine] LiveKit URL configured but token unavailable. Gracefully falling back to Direct WebRTC Engine.'
            );
            setProductionConfigError(
              'Notice: LiveKit SFU token unavailable. Connected via Direct WebRTC Engine.'
            );
          } else {
            setProductionConfigError(null);
          }
          console.info('[MediaEngine] Initializing Enhanced Direct Media Engine (Direct WebRTC Mesh)');
          transport = new PeerConnectionManager(currentUser.id, callbacks);
        }

        transportRef.current = transport;
        await transport.join(roomId, stream, {
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
        });
      } catch (err) {
        console.error('[MediaEngine] Failed to connect to room:', err);
        setConnectionState('failed');
      }
    },
    [activeRoomId, currentUser, deviceSettings.videoQuality]
  );

  const leaveVoiceRoom = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.leave();
      transportRef.current = null;
    }

    reconnectionManagerRef.current?.reset();
    setReconnectMessage(null);
    mediaSessionRef.current.stopLocalMedia();
    setLocalStream(null);
    setScreenStream(null);
    setActiveRoomId(null);
    setPendingRoomId(null);
    setIsPreJoinOpen(false);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
    setAudioLevel(0);
    setIsSpeaking(false);
    setPinnedParticipantId(null);
    setConnectionState('idle');
    setMyHandRaised(false);
    setMyStageRole('listener');
    setProductionConfigError(null);
    setRemoteParticipants(new Map());
  }, []);

  // Clean room disconnect when user closes tab or refreshes
  useEffect(() => {
    const handleUnload = () => {
      if (activeRoomId) {
        leaveVoiceRoom();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [activeRoomId, leaveVoiceRoom]);

  // In-call Track Muting
  const toggleAudio = useCallback(() => {
    const nextMuted = !isAudioMuted;
    mediaSessionRef.current.setMicrophoneMute(nextMuted);
    setIsAudioMuted(nextMuted);
    if (transportRef.current) {
      transportRef.current.setTrackEnabled('audio', !nextMuted).catch(() => {});
      transportRef.current.sendMuteState(nextMuted, isVideoMuted).catch(() => {});
    }
  }, [isAudioMuted, isVideoMuted]);

  const toggleVideo = useCallback(async () => {
    const nextMuted = !isVideoMuted;
    mediaSessionRef.current.setCameraMute(nextMuted);
    setIsVideoMuted(nextMuted);
    if (transportRef.current) {
      transportRef.current.setTrackEnabled('video', !nextMuted).catch(() => {});
      transportRef.current.sendMuteState(isAudioMuted, nextMuted).catch(() => {});
    }
  }, [isAudioMuted, isVideoMuted]);

  // In-call Seamless Device Switching (via RTCRtpSender.replaceTrack)
  const switchCamera = useCallback(async (deviceId: string) => {
    try {
      const newTrack = await mediaSessionRef.current.switchCamera(deviceId);
      setLocalStream(new MediaStream(mediaSessionRef.current.getLocalStream().getTracks()));
      if (transportRef.current) {
        await transportRef.current.replaceTrack('video', newTrack);
      }
    } catch (err) {
      console.warn('[MediaEngine] switchCamera failed:', err);
    }
  }, []);

  const switchMicrophone = useCallback(async (deviceId: string) => {
    try {
      const newTrack = await mediaSessionRef.current.switchMicrophone(deviceId);
      setLocalStream(new MediaStream(mediaSessionRef.current.getLocalStream().getTracks()));
      if (transportRef.current) {
        await transportRef.current.replaceTrack('audio', newTrack);
      }
    } catch (err) {
      console.warn('[MediaEngine] switchMicrophone failed:', err);
    }
  }, []);

  // Screen Sharing (Independent presentation track — camera is NOT replaced!)
  const stopScreenSharing = useCallback(async () => {
    mediaSessionRef.current.stopScreenShare();
    setScreenStream(null);
    setIsScreenSharing(false);
    if (transportRef.current) {
      await transportRef.current.unpublishScreenTrack();
    }
  }, []);

  const startScreenSharing = useCallback(async () => {
    try {
      const { videoTrack, audioTrack } = await mediaSessionRef.current.startScreenShare(true);
      const scrStream = mediaSessionRef.current.getScreenStream();
      setScreenStream(scrStream);
      setIsScreenSharing(true);

      videoTrack.onended = () => {
        stopScreenSharing();
      };

      if (transportRef.current) {
        await transportRef.current.publishScreenTrack(videoTrack, audioTrack);
      }
    } catch (err) {
      console.warn('[MediaEngine] Screen share cancelled or denied:', err);
    }
  }, [stopScreenSharing]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenSharing();
    } else {
      await startScreenSharing();
    }
  }, [isScreenSharing, stopScreenSharing, startScreenSharing]);

  // Server-Authoritative Stage Hand-Raising (Phases 11 & 12)
  const raiseHand = useCallback(async () => {
    if (!activeRoomId || !currentUser) return;
    mockStore.requestToSpeak(activeRoomId, currentUser.id);
    setMyHandRaised(true);
    if (transportRef.current) {
      await transportRef.current.sendStageRole(myStageRole, true);
    }
  }, [activeRoomId, currentUser, myStageRole]);

  const lowerHand = useCallback(async () => {
    if (!activeRoomId || !currentUser) return;
    mockStore.lowerHand(activeRoomId, currentUser.id, currentUser.id);
    setMyHandRaised(false);
    if (transportRef.current) {
      await transportRef.current.sendStageRole(myStageRole, false);
    }
  }, [activeRoomId, currentUser, myStageRole]);

  const setStageRole = useCallback(async (role: 'host' | 'speaker' | 'listener') => {
    if (!activeRoomId || !currentUser) return;
    if (role === 'listener') {
      mockStore.demoteSpeaker(activeRoomId, currentUser.id, currentUser.id);
    }
    setMyStageRole(role);
    if (transportRef.current) {
      await transportRef.current.sendStageRole(role, myHandRaised);
    }
  }, [activeRoomId, currentUser, myHandRaised]);

  // Targeted Stage Moderation Actions validated through server mockStore
  const inviteToStage = useCallback(async (targetUserId: string) => {
    if (!activeRoomId || !currentUser) return;
    const res = mockStore.approveSpeaker(activeRoomId, currentUser.id, targetUserId);
    if (!res.success) {
      console.warn('[MediaContext] Unauthorized stage invitation:', res.error);
      return;
    }

    if (transportRef.current) {
      await transportRef.current.sendTargetedStageAction(targetUserId, 'invite');
    }
    setRemoteParticipants((prev) => {
      const next = new Map(prev);
      const target = next.get(targetUserId);
      if (target) {
        next.set(targetUserId, {
          ...target,
          stageRole: 'speaker',
          isStageSpeaker: true,
          isHandRaised: false,
        });
      }
      return next;
    });
  }, [activeRoomId, currentUser]);

  const demoteToListener = useCallback(async (targetUserId: string) => {
    if (!activeRoomId || !currentUser) return;
    const res = mockStore.demoteSpeaker(activeRoomId, currentUser.id, targetUserId);
    if (!res.success) {
      console.warn('[MediaContext] Unauthorized stage demotion:', res.error);
      return;
    }

    if (transportRef.current) {
      await transportRef.current.sendTargetedStageAction(targetUserId, 'demote');
    }
    setRemoteParticipants((prev) => {
      const next = new Map(prev);
      const target = next.get(targetUserId);
      if (target) {
        next.set(targetUserId, {
          ...target,
          stageRole: 'listener',
          isStageSpeaker: false,
        });
      }
      return next;
    });
  }, [activeRoomId, currentUser]);

  const lowerParticipantHand = useCallback(async (targetUserId: string) => {
    if (!activeRoomId || !currentUser) return;
    const res = mockStore.lowerHand(activeRoomId, currentUser.id, targetUserId);
    if (!res.success) {
      console.warn('[MediaContext] Unauthorized lowerHand:', res.error);
      return;
    }

    if (transportRef.current) {
      await transportRef.current.sendTargetedStageAction(targetUserId, 'lower-hand');
    }
    setRemoteParticipants((prev) => {
      const next = new Map(prev);
      const target = next.get(targetUserId);
      if (target) {
        next.set(targetUserId, {
          ...target,
          isHandRaised: false,
        });
      }
      return next;
    });
  }, [activeRoomId, currentUser]);

  // Device settings update
  const updateSettings = useCallback((newSettings: Partial<MediaDeviceSettings>) => {
    setDeviceSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      mediaSessionRef.current.settings = updated;
      if (newSettings.inputVolume !== undefined) {
        mediaSessionRef.current.setInputVolume(newSettings.inputVolume);
      }
      mediaSessionRef.current.savePreferences();

      // If video quality was updated and camera is live, apply it immediately
      if (newSettings.videoQuality && !isVideoMuted && activeRoomId) {
        mediaSessionRef.current.startCamera(undefined, newSettings.videoQuality).then(async (newTrack) => {
          setLocalStream(new MediaStream(mediaSessionRef.current.getLocalStream().getTracks()));
          if (transportRef.current) {
            await transportRef.current.replaceTrack('video', newTrack);
          }
        }).catch((e) => console.warn('[MediaContext] Quality switch warning:', e));
      }

      return updated;
    });
  }, [activeRoomId, isVideoMuted]);

  // Combine local participant with remote participants
  const participants: Participant[] = [];
  if (currentUser && activeRoomId) {
    participants.push({
      id: currentUser.id,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl,
      stream: localStream || undefined,
      screenStream: screenStream || undefined,
      isAudioMuted,
      isVideoMuted,
      isScreenSharing,
      isSpeaking,
      stageRole: myStageRole,
      isStageSpeaker: myStageRole === 'host' || myStageRole === 'speaker',
      isHandRaised: myHandRaised,
      audioLevel,
      connectionQuality: connectionStats.quality,
      stats: connectionStats,
      isPinned: pinnedParticipantId === currentUser.id,
    });
  }

  remoteParticipants.forEach((p) => {
    participants.push({
      ...p,
      isPinned: pinnedParticipantId === p.id,
    });
  });

  return (
    <MediaContext.Provider
      value={{
        activeRoomId,
        connectionState,
        connectionStats,
        reconnectMessage,
        deviceNotification,
        dismissDeviceNotification,
        localStream,
        screenStream,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
        audioLevel,
        isSpeaking,
        participants,
        pinnedParticipantId,
        setPinnedParticipantId,
        deviceSettings,
        pendingRoomId,
        isPreJoinOpen,
        isDiagnosticsOpen,
        openDiagnostics,
        closeDiagnostics,
        toggleDiagnostics,
        openPreJoin,
        closePreJoin,
        joinVoiceRoom,
        leaveVoiceRoom,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        switchCamera,
        switchMicrophone,
        updateSettings,
        raiseHand,
        lowerHand,
        setStageRole,
        inviteToStage,
        demoteToListener,
        lowerParticipantHand,
        productionConfigError,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) throw new Error('useMedia must be used within a MediaProvider');
  return context;
};
