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
} from '../../types';
import { MediaSession } from '../../lib/webrtc/mediaSession';
import { PeerConnectionManager } from '../../lib/webrtc/peerConnection';
import { LiveKitSFUAdapter, ITransportAdapter } from '../../lib/webrtc/transportAdapter';
import { getLiveKitToken } from '../../lib/webrtc/livekitToken';
import { useAuth } from './AuthContext';

interface MediaContextType {
  activeRoomId: string | null;
  connectionState: MediaLifecycleState;
  connectionStats: ConnectionStats;
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
  openPreJoin: (roomId: string) => void;
  closePreJoin: () => void;
  joinVoiceRoom: (roomId: string) => Promise<void>;
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
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [isPreJoinOpen, setIsPreJoinOpen] = useState(false);

  const [connectionState, setConnectionState] = useState<MediaLifecycleState>('idle');
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    rtt: 25,
    packetLoss: 0,
    jitter: 3,
    bitrate: 1800,
    audioCodec: 'Opus 48kHz (Mono FEC)',
    videoCodec: 'VP8/H.264 HD',
    quality: 'excellent',
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);

  // Stage states for current user
  const [myStageRole, setMyStageRole] = useState<'host' | 'speaker' | 'listener'>('host');
  const [myHandRaised, setMyHandRaised] = useState(false);

  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, Participant>>(new Map());

  const mediaSessionRef = useRef<MediaSession>(new MediaSession());
  const transportRef = useRef<ITransportAdapter | null>(null);

  const [deviceSettings, setDeviceSettings] = useState<MediaDeviceSettings>(
    mediaSessionRef.current.settings
  );

  // Bind AudioDSP listeners and hardware track change listeners
  useEffect(() => {
    mediaSessionRef.current.setEvents({
      onAudioLevel: (level, speaking) => {
        setAudioLevel(level);
        setIsSpeaking(speaking);

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
    });

    return () => {
      mediaSessionRef.current.stopLocalMedia();
    };
  }, [isAudioMuted, isVideoMuted]);

  const openPreJoin = useCallback((roomId: string) => {
    setPendingRoomId(roomId);
    setIsPreJoinOpen(true);
  }, []);

  const closePreJoin = useCallback(() => {
    setIsPreJoinOpen(false);
    setPendingRoomId(null);
  }, []);

  const joinVoiceRoom = useCallback(
    async (roomId: string) => {
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
      setIsAudioMuted(false);
      setIsVideoMuted(false);
      setIsScreenSharing(false);
      setPinnedParticipantId(null);
      setMyHandRaised(false);

      try {
        // 1. Initialize separated audio and video hardware tracks
        const stream = await mediaSessionRef.current.startLocalMedia(
          true,
          true,
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

        const callbacks = {
          onRemoteStream: (peerId: string, remoteStream: MediaStream) => {
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(peerId);
              next.set(peerId, {
                id: peerId,
                userId: peerId,
                username: existing?.username || `Friend ${peerId.slice(-4)}`,
                displayName: existing?.displayName || `User ${peerId.slice(-4)}`,
                avatarUrl: existing?.avatarUrl,
                stream: remoteStream,
                screenStream: existing?.screenStream,
                isAudioMuted: existing?.isAudioMuted || false,
                isVideoMuted: existing?.isVideoMuted || false,
                isScreenSharing: existing?.isScreenSharing || false,
                isSpeaking: existing?.isSpeaking || false,
                stageRole: existing?.stageRole || 'speaker',
                isStageSpeaker: existing?.isStageSpeaker ?? true,
                isHandRaised: existing?.isHandRaised || false,
                audioLevel: existing?.audioLevel || 0,
                connectionQuality: existing?.connectionQuality || 'excellent',
              });
              return next;
            });
          },
          onRemoteScreenStream: (peerId: string, remoteScreenStream: MediaStream | null) => {
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(peerId);
              if (existing) {
                next.set(peerId, {
                  ...existing,
                  screenStream: remoteScreenStream || undefined,
                  isScreenSharing: Boolean(remoteScreenStream),
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
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const target = next.get(peerId);
              if (target) {
                const updated = { ...target, ...state };
                if (state.stageRole) {
                  updated.isStageSpeaker = state.stageRole === 'host' || state.stageRole === 'speaker';
                }
                next.set(peerId, updated);
              }
              return next;
            });
          },
          onConnectionQualityChanged: (
            peerId: string,
            quality: ConnectionQuality,
            stats?: ConnectionStats
          ) => {
            if (stats) {
              setConnectionStats(stats);
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
          transport = new LiveKitSFUAdapter(livekitUrl, livekitToken, callbacks);
        } else {
          console.info('[MediaEngine] Initializing Enhanced Direct Media Engine (Opus Mono FEC/DTX)');
          transport = new PeerConnectionManager(currentUser.id, callbacks);
        }

        transportRef.current = transport;
        await transport.join(roomId, stream);
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
    setRemoteParticipants(new Map());
  }, []);

  // In-call Track Muting
  const toggleAudio = useCallback(() => {
    const nextMuted = !isAudioMuted;
    mediaSessionRef.current.setMicrophoneMute(nextMuted);
    setIsAudioMuted(nextMuted);
    if (transportRef.current) {
      transportRef.current.sendMuteState(nextMuted, isVideoMuted).catch(() => {});
    }
  }, [isAudioMuted, isVideoMuted]);

  const toggleVideo = useCallback(async () => {
    const nextMuted = !isVideoMuted;
    mediaSessionRef.current.setCameraMute(nextMuted);
    setIsVideoMuted(nextMuted);
    if (transportRef.current) {
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
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      mediaSessionRef.current.stopScreenShare();
      setScreenStream(null);
      setIsScreenSharing(false);
      if (transportRef.current) {
        await transportRef.current.unpublishScreenTrack();
      }
    } else {
      try {
        const { videoTrack, audioTrack } = await mediaSessionRef.current.startScreenShare(true);
        const scrStream = mediaSessionRef.current.getScreenStream();
        setScreenStream(scrStream);
        setIsScreenSharing(true);

        videoTrack.onended = () => {
          toggleScreenShare();
        };

        if (transportRef.current) {
          await transportRef.current.publishScreenTrack(videoTrack, audioTrack);
        }
      } catch (err) {
        console.warn('[MediaEngine] Screen share cancelled or denied:', err);
      }
    }
  }, [isScreenSharing]);

  // Stage Hand-Raising
  const raiseHand = useCallback(async () => {
    setMyHandRaised(true);
    if (transportRef.current) {
      await transportRef.current.sendStageRole(myStageRole, true);
    }
  }, [myStageRole]);

  const lowerHand = useCallback(async () => {
    setMyHandRaised(false);
    if (transportRef.current) {
      await transportRef.current.sendStageRole(myStageRole, false);
    }
  }, [myStageRole]);

  const setStageRole = useCallback(async (role: 'host' | 'speaker' | 'listener') => {
    setMyStageRole(role);
    if (transportRef.current) {
      await transportRef.current.sendStageRole(role, myHandRaised);
    }
  }, [myHandRaised]);

  // Targeted Stage Moderation Actions (Fixed: alex -> speaker, not moderator!)
  const inviteToStage = useCallback(async (targetUserId: string) => {
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
  }, []);

  const demoteToListener = useCallback(async (targetUserId: string) => {
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
  }, []);

  const lowerParticipantHand = useCallback(async (targetUserId: string) => {
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
  }, []);

  // Device settings update
  const updateSettings = useCallback((newSettings: Partial<MediaDeviceSettings>) => {
    setDeviceSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      mediaSessionRef.current.settings = updated;
      if (newSettings.inputVolume !== undefined) {
        mediaSessionRef.current.setInputVolume(newSettings.inputVolume);
      }
      mediaSessionRef.current.savePreferences();
      return updated;
    });
  }, []);

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
