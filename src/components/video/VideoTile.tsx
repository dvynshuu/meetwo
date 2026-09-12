import React, { useRef, useEffect } from 'react';
import { MicOff, VideoOff, Monitor, Pin, PinOff, Maximize2, PictureInPicture } from 'lucide-react';
import { Participant } from '../../types';
import { Avatar } from '../ui/Avatar';
import { useMedia } from '../../app/providers/MediaContext';

interface VideoTileProps {
  participant: Participant;
  isLocal: boolean;
  isFeatured?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({ participant, isLocal, isFeatured = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { pinnedParticipantId, setPinnedParticipantId } = useMedia();

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const hasVideoTrack =
    participant.stream &&
    participant.stream.getVideoTracks().length > 0 &&
    participant.stream.getVideoTracks()[0].enabled &&
    !participant.isVideoMuted;

  const isPinned = pinnedParticipantId === participant.id;

  const togglePin = () => {
    setPinnedParticipantId(isPinned ? null : participant.id);
  };

  const handlePiP = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
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
      ? 'var(--status-idle)'
      : 'var(--status-dnd)';

  return (
    <div
      className={`video-tile ${participant.isSpeaking ? 'is-speaking' : ''} ${isFeatured ? 'video-tile-featured' : ''}`}
      id={`video-tile-${participant.id}`}
    >
      {/* Tile Hover Quick Actions */}
      <div className="video-tile-quick-actions">
        <button
          className={`action-pill-btn ${isPinned ? 'active-pin' : ''}`}
          onClick={togglePin}
          title={isPinned ? 'Unpin participant' : 'Pin to stage'}
        >
          {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>

        {hasVideoTrack && document.pictureInPictureEnabled && (
          <button className="action-pill-btn" onClick={handlePiP} title="Picture in Picture">
            <PictureInPicture size={14} />
          </button>
        )}

        <button className="action-pill-btn" onClick={handleFullscreen} title="Fullscreen">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Video Element */}
      {participant.stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`video-element ${participant.isScreenSharing ? 'video-tile-screen' : ''}`}
          style={{ display: hasVideoTrack ? 'block' : 'none' }}
        />
      )}

      {/* Avatar Placeholder when video is off */}
      {!hasVideoTrack && (
        <div className="video-avatar-placeholder">
          <Avatar
            src={participant.avatarUrl}
            name={participant.displayName || participant.username}
            size={isFeatured ? 120 : 80}
            status={participant.isSpeaking ? 'online' : undefined}
            showStatus={false}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {participant.displayName || participant.username}
          </span>
        </div>
      )}

      {/* Overlay: User Tag, Status Badges & Connection Quality */}
      <div className="video-tile-overlay">
        <div className="video-tile-user-tag">
          {/* Real Connection Quality Dot */}
          <span
            className="connection-quality-dot"
            style={{ backgroundColor: qualityColor }}
            title={`Connection: ${participant.connectionQuality || 'Good'}`}
          />
          {participant.isScreenSharing && <Monitor size={14} style={{ color: 'var(--accent-light)' }} />}
          <span>
            {participant.displayName || participant.username} {isLocal && '(You)'}
          </span>
        </div>

        <div className="video-tile-badges">
          {participant.isAudioMuted && (
            <div className="badge-icon muted" title="Muted">
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
