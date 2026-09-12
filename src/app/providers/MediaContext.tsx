import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Participant, MediaDeviceSettings, ConnectionQuality } from '../../types';
import { MediaSession } from '../../lib/webrtc/mediaSession';
import { PeerConnectionManager } from '../../lib/webrtc/peerConnection';
import { useAuth } from './AuthContext';

interface MediaContextType {
  activeRoomId: string | null;
  localStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  audioLevel: number;
  participants: Participant[];
  pinnedParticipantId: string | null;
  setPinnedParticipantId: (id: string | null) => void;
  deviceSettings: MediaDeviceSettings;
  joinVoiceRoom: (roomId: string) => Promise<void>;
  leaveVoiceRoom: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  updateSettings: (settings: Partial<MediaDeviceSettings>) => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, Participant>>(new Map());

  const mediaSessionRef = useRef<MediaSession>(new MediaSession());
  const peerManagerRef = useRef<PeerConnectionManager | null>(null);

  const [deviceSettings, setDeviceSettings] = useState<MediaDeviceSettings>({
    audioInputId: '',
    audioOutputId: '',
    videoInputId: '',
    videoQuality: '1080p',
    echoCancellation: true,
    noiseSuppression: true,
  });

  // Wire audio level listener
  useEffect(() => {
    mediaSessionRef.current.onAudioLevel((level) => {
      setAudioLevel(level);
    });

    return () => {
      mediaSessionRef.current.stopLocalMedia();
    };
  }, []);

  const joinVoiceRoom = useCallback(
    async (roomId: string) => {
      if (!currentUser) return;
      if (activeRoomId === roomId) return;

      // Leave existing room if any
      if (activeRoomId) {
        await leaveVoiceRoom();
      }

      setActiveRoomId(roomId);
      setIsAudioMuted(false);
      setIsVideoMuted(false);
      setIsScreenSharing(false);
      setPinnedParticipantId(null);

      try {
        // Start local media (camera & mic with 1080p fallback)
        const stream = await mediaSessionRef.current.startLocalMedia(
          true,
          true,
          deviceSettings.videoQuality
        );
        setLocalStream(stream);

        // Initialize Peer Manager
        const peerManager = new PeerConnectionManager(currentUser.id, {
          onRemoteStream: (peerId: string, remoteStream: MediaStream) => {
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const existing = next.get(peerId);
              next.set(peerId, {
                id: peerId,
                userId: peerId,
                username: existing?.username || `Peer ${peerId.slice(-4)}`,
                displayName: existing?.displayName || `User ${peerId.slice(-4)}`,
                stream: remoteStream,
                isAudioMuted: false,
                isVideoMuted: false,
                isScreenSharing: false,
                isSpeaking: false,
                connectionQuality: 'excellent',
              });
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
          onConnectionQualityChanged: (peerId: string, quality: ConnectionQuality) => {
            setRemoteParticipants((prev) => {
              const next = new Map(prev);
              const target = next.get(peerId);
              if (target) {
                next.set(peerId, { ...target, connectionQuality: quality });
              }
              return next;
            });
          },
        });

        peerManagerRef.current = peerManager;
        await peerManager.join(roomId, stream);
      } catch (err) {
        console.error('Failed to join voice room:', err);
      }
    },
    [activeRoomId, currentUser, deviceSettings.videoQuality]
  );

  const leaveVoiceRoom = useCallback(async () => {
    if (peerManagerRef.current) {
      await peerManagerRef.current.leave();
      peerManagerRef.current = null;
    }

    mediaSessionRef.current.stopLocalMedia();
    setLocalStream(null);
    setActiveRoomId(null);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsScreenSharing(false);
    setAudioLevel(0);
    setPinnedParticipantId(null);
    setRemoteParticipants(new Map());
  }, []);

  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const nextMuted = !isAudioMuted;
      audioTracks.forEach((t) => (t.enabled = !nextMuted));
      setIsAudioMuted(nextMuted);
    }
  }, [localStream, isAudioMuted]);

  const toggleVideo = useCallback(async () => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
      const nextMuted = !isVideoMuted;
      videoTracks.forEach((t) => (t.enabled = !nextMuted));
      setIsVideoMuted(nextMuted);
    }
  }, [localStream, isVideoMuted]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Revert back to camera
      mediaSessionRef.current.stopScreenShare();
      const cameraStream = await mediaSessionRef.current.startLocalMedia(
        !isAudioMuted,
        !isVideoMuted,
        deviceSettings.videoQuality
      );
      setLocalStream(cameraStream);
      setIsScreenSharing(false);
      if (peerManagerRef.current) {
        await peerManagerRef.current.updateLocalStream(cameraStream);
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await mediaSessionRef.current.startScreenShare();
        setLocalStream(screenStream);
        setIsScreenSharing(true);

        // When user stops sharing via native browser bar
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        if (peerManagerRef.current) {
          await peerManagerRef.current.updateLocalStream(screenStream);
        }
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    }
  }, [isScreenSharing, isAudioMuted, isVideoMuted, deviceSettings.videoQuality]);

  const updateSettings = useCallback((newSettings: Partial<MediaDeviceSettings>) => {
    setDeviceSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      mediaSessionRef.current.settings = updated;
      return updated;
    });
  }, []);

  // Compute local participant and merge with remote participants
  const participants: Participant[] = [];
  if (currentUser && activeRoomId) {
    participants.push({
      id: currentUser.id,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl,
      stream: localStream || undefined,
      isAudioMuted,
      isVideoMuted,
      isScreenSharing,
      isSpeaking: audioLevel > 15 && !isAudioMuted,
      audioLevel,
      connectionQuality: 'excellent',
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
        localStream,
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
        audioLevel,
        participants,
        pinnedParticipantId,
        setPinnedParticipantId,
        deviceSettings,
        joinVoiceRoom,
        leaveVoiceRoom,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        updateSettings,
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
