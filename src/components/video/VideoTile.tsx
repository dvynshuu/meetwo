import React, { useRef, useEffect } from 'react';
import { MicOff, VideoOff, Monitor, Pin, PinOff, Maximize2, PictureInPicture, Activity } from 'lucide-react';
import { Participant } from '../../types';
import { Avatar } from '../ui/Avatar';
import { useMedia } from '../../app/providers/MediaContext';

interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  isFeatured?: boolean;
  isScreenTile?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isLocal,
  isFeatured = false,
  isScreenTile = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { pinnedParticipantId, setPinnedParticipantId, deviceSettings } = useMedia();

  // Attach stream to video element safely and efficiently
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (participant.stream) {
      if (videoEl.srcObject !== participant.stream) {
        videoEl.srcObject = participant.stream;
      }
    } else {
      videoEl.srcObject = null;
    }
  }, [participant.stream]);

  // Audio sink routing for remote participants
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && !isLocal && deviceSettings.audioOutputId && typeof (videoEl as any).setSinkId === 'function') {
      (videoEl as any).setSinkId(deviceSettings.audioOutputId).catch(() => {});
    }
  }, [deviceSettings.audioOutputId, isLocal]);

  const hasVideoTrack = isScreenTile
    ? Boolean(participant.stream) &&
      participant.stream!.getVideoTracks().length > 0 &&
      participant.stream!.getVideoTracks()[0].enabled
    : Boolean(participant.stream) &&
      participant.stream!.getVideoTracks().length > 0 &&
      participant.stream!.getVideoTracks()[0].enabled &&
      !participant.isVideoMuted;

  const isPinned = pinnedParticipantId === participant.id;

  const togglePin = () => {
    setPinnedParticipantId(isPinned ? null : participant.id);
  };

  const handlePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('[VideoTile] PiP request failed:', err);
      }
    }
  };

  const handleFullscreen = () => {
    const el = document.getElementById(`video-tile-${participant.id}`);
    if (el) {
      if (!document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const qualityColor =
    participant.connectionQuality === 'excellent'
      ? 'var(--status-online)'
      : participant.connectionQuality === 'good'
      ? '#38bdf8'
      : participant.connectionQuality === 'fair'
      ? 'var(--status-idle)'
      : 'var(--status-dnd)';

  const statsTooltip = participant.stats
    ? `Quality: ${participant.connectionQuality?.toUpperCase() || 'GOOD'}${
        participant.stats.rtt !== undefined ? ` | RTT: ${participant.stats.rtt}ms` : ''
      }${participant.stats.packetLoss !== undefined ? ` | Loss: ${participant.stats.packetLoss}%` : ''}${
        participant.stats.bitrate !== undefined ? ` | Bitrate: ${participant.stats.bitrate}kbps` : ''
      }`
    : `Quality: ${participant.connectionQuality || 'Good'}`;

  return (
    <div
      className={`video-tile ${participant.isSpeaking ? 'is-speaking' : ''} ${
        isFeatured ? 'video-tile-featured' : ''
      }`}
      id={`video-tile-${participant.id}`}
    >
      {/* Quick Action Overlay Buttons */}
      <div className="video-tile-quick-actions">
        <button
          className={`action-pill-btn ${isPinned ? 'active-pin' : ''}`}
          onClick={togglePin}
          title={isPinned ? 'Unpin participant' : 'Pin to stage'}
        >
          {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>

        {hasVideoTrack && document.pictureInPictureEnabled && (
          <button className="action-pill-btn" onClick={handlePiP} title="Picture-in-Picture">
            <PictureInPicture size={14} />
          </button>
        )}

        <button className="action-pill-btn" onClick={handleFullscreen} title="Fullscreen">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Video Element: stays mounted to prevent video element tearing */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`video-element ${participant.isScreenSharing ? 'video-tile-screen' : ''}`}
        style={{ display: hasVideoTrack ? 'block' : 'none' }}
      />

      {/* Avatar Placeholder when video is off */}
      {!hasVideoTrack && (
        <div className="video-avatar-placeholder">
          <Avatar
            src={participant.avatarUrl}
            name={participant.displayName || participant.username}
            size={isFeatured ? 110 : 72}
            status={participant.isSpeaking ? 'online' : undefined}
            showStatus={false}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {participant.displayName || participant.username}
          </span>
        </div>
      )}

      {/* Tile Overlay: User Tag, Health Status & Audio/Video Badges */}
      <div className="video-tile-overlay">
        <div className="video-tile-user-tag" title={statsTooltip}>
          <span
            className="connection-quality-dot"
            style={{ backgroundColor: qualityColor }}
          />
          {participant.isScreenSharing && (
            <Monitor size={14} style={{ color: 'var(--accent-light)' }} />
          )}
          <span>
            {participant.displayName || participant.username} {isLocal && '(You)'}
          </span>
          {participant.stats?.rtt && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginLeft: 4 }}>
              {participant.stats.rtt}ms
            </span>
          )}
        </div>

        <div className="video-tile-badges">
          {participant.isAudioMuted && (
            <div className="badge-icon muted" title="Microphone Muted">
              <MicOff size={14} />
            </div>
          )}
          {participant.isVideoMuted && (
            <div className="badge-icon muted" title="Camera Off">
              <VideoOff size={14} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
