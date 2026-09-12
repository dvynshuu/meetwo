import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  MicOff,
  VideoOff,
  Monitor,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  PictureInPicture,
  StopCircle,
  Eye,
  EyeOff,
  Tv,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
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
  const tileRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const snapshotCanvasRef = useRef<HTMLCanvasElement>(null);
  const { participants, pinnedParticipantId, setPinnedParticipantId, deviceSettings, toggleScreenShare } = useMedia();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLocalMiniPreview, setShowLocalMiniPreview] = useState(true);
  const [showFullLocalVideo, setShowFullLocalVideo] = useState(false);
  const [showFsBar, setShowFsBar] = useState(true);
  const fsBarTimeoutRef = useRef<any>(null);

  // Track fullscreen changes safely
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = document.fullscreenElement === tileRef.current;
      setIsFullscreen(isFs);
      if (!isFs) {
        setShowFsBar(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleMouseMove = () => {
    if (!isFullscreen) return;
    setShowFsBar(true);
    if (fsBarTimeoutRef.current) clearTimeout(fsBarTimeoutRef.current);
    fsBarTimeoutRef.current = setTimeout(() => {
      setShowFsBar(false);
    }, 2800);
  };

  // Attach stream to primary video element safely and efficiently
  useEffect(() => {
    if (participant.stream) {
      if (videoRef.current && videoRef.current.srcObject !== participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
    } else {
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, [participant.stream]);

  // Audio sink routing for remote participants
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && !isLocal && deviceSettings.audioOutputId && typeof (videoEl as any).setSinkId === 'function') {
      (videoEl as any).setSinkId(deviceSettings.audioOutputId).catch(() => {});
    }
  }, [deviceSettings.audioOutputId, isLocal]);

  // Capture clean, non-recursive snapshot onto canvas
  const captureSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = snapshotCanvasRef.current;
    if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const isLocalScreenShare = isLocal && isScreenTile;
  const isPresenterCardActive = isLocalScreenShare && !showFullLocalVideo;

  // Initial and periodic safe snapshot capture
  useEffect(() => {
    if (!isLocalScreenShare || !participant.stream) return;
    const video = videoRef.current;
    if (!video) return;

    const onData = () => {
      setTimeout(captureSnapshot, 250);
    };

    video.addEventListener('loadeddata', onData);
    video.addEventListener('playing', onData);

    let interval: any = null;
    if (showLocalMiniPreview) {
      interval = setInterval(captureSnapshot, 4000);
      captureSnapshot();
    }

    return () => {
      video.removeEventListener('loadeddata', onData);
      video.removeEventListener('playing', onData);
      if (interval) clearInterval(interval);
    };
  }, [isLocalScreenShare, participant.stream, showLocalMiniPreview, captureSnapshot]);

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
    const targetVideo = videoRef.current;
    if (targetVideo && document.pictureInPictureEnabled) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await targetVideo.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('[VideoTile] PiP request failed:', err);
      }
    }
  };

  const handleFullscreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!tileRef.current) return;
    if (!document.fullscreenElement) {
      tileRef.current.requestFullscreen().catch((err) => {
        console.warn('[VideoTile] Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleTileDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    handleFullscreen();
  };

  const qualityColor =
    participant.connectionQuality === 'unknown'
      ? 'var(--text-muted)'
      : participant.connectionQuality === 'excellent'
      ? 'var(--status-online)'
      : participant.connectionQuality === 'good'
      ? '#38bdf8'
      : participant.connectionQuality === 'fair'
      ? 'var(--status-idle)'
      : 'var(--status-dnd)';

  const statsTooltip =
    participant.connectionQuality === 'unknown'
      ? 'Measuring connection…'
      : participant.stats
      ? `Quality: ${participant.connectionQuality?.toUpperCase() || 'GOOD'}${
          participant.stats.rtt !== undefined ? ` | RTT: ${participant.stats.rtt}ms` : ''
        }${participant.stats.packetLoss !== undefined ? ` | Loss: ${participant.stats.packetLoss}%` : ''}${
          participant.stats.bitrate !== undefined ? ` | Bitrate: ${participant.stats.bitrate}kbps` : ''
        }${participant.stats.candidateType ? ` | Type: ${participant.stats.candidateType}` : ''}`
      : `Quality: ${participant.connectionQuality?.toUpperCase() || 'UNKNOWN'}`;

  // Extract truthful screen stream track properties
  const videoTrack = participant.stream?.getVideoTracks()[0];
  const trackSettings = videoTrack?.getSettings?.();
  const screenResolution = trackSettings?.width && trackSettings?.height
    ? `${trackSettings.width} × ${trackSettings.height}`
    : '1080p FHD';
  const screenFps = trackSettings?.frameRate
    ? `${Math.round(trackSettings.frameRate)} FPS`
    : '30 FPS';

  const screenTitle = isLocalScreenShare
    ? 'Your Screen (Live)'
    : participant.displayName?.endsWith("'s Screen")
    ? participant.displayName
    : `${participant.displayName || participant.username}'s Screen`;

  return (
    <div
      ref={tileRef}
      className={`video-tile ${!isScreenTile && participant.isSpeaking ? 'is-speaking' : ''} ${
        isFeatured ? 'video-tile-featured' : ''
      } ${isScreenTile ? 'video-tile-screen-container' : ''}`}
      id={isScreenTile ? `video-tile-screen-${participant.id}` : `video-tile-${participant.id}`}
      onDoubleClick={handleTileDoubleClick}
      onMouseMove={handleMouseMove}
    >
      {/* Floating Fullscreen Controls Bar (Visible in Fullscreen Mode) */}
      {isFullscreen && (
        <div className={`fullscreen-top-bar ${!showFsBar ? 'faded' : ''}`}>
          <div className="fullscreen-title">
            <Monitor size={16} style={{ color: 'var(--accent-light)' }} />
            <span>{screenTitle}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isLocal && isScreenTile && (
              <>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={toggleScreenShare}
                  style={{ borderRadius: 'var(--radius-pill)', padding: '4px 14px', fontSize: 12, gap: 6 }}
                >
                  <StopCircle size={14} />
                  <span>Stop Sharing</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowFullLocalVideo(!showFullLocalVideo)}
                  style={{ borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: 12, gap: 6 }}
                >
                  <Tv size={14} />
                  <span>{showFullLocalVideo ? 'Presenter Studio' : 'Live Mirror'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleFullscreen}
              style={{ borderRadius: 'var(--radius-pill)', padding: '4px 14px', fontSize: 12, gap: 6 }}
            >
              <Minimize2 size={14} />
              <span>Exit Fullscreen (Esc)</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Action Overlay Buttons (Always available in non-fullscreen) */}
      {!isFullscreen && (
        <div className="video-tile-quick-actions">
          <button
            className={`action-pill-btn ${isPinned ? 'active-pin' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              togglePin();
            }}
            title={isPinned ? 'Unpin participant' : 'Pin to stage'}
          >
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>

          {hasVideoTrack && document.pictureInPictureEnabled && (
            <button
              className="action-pill-btn"
              onClick={(e) => {
                e.stopPropagation();
                handlePiP();
              }}
              title="Picture-in-Picture"
            >
              <PictureInPicture size={14} />
            </button>
          )}

          {/* Fullscreen Button Available on ALL Tiles */}
          <button
            className="action-pill-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleFullscreen(e);
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      )}

      {/* Primary Video Element: kept mounted to allow zero-latency switching and snapshot rendering */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`video-element ${participant.isScreenSharing || isScreenTile ? 'video-tile-screen' : ''}`}
        style={
          isPresenterCardActive
            ? {
                position: 'absolute',
                opacity: 0,
                pointerEvents: 'none',
                width: 320,
                height: 180,
                zIndex: -10,
              }
            : { display: hasVideoTrack ? 'block' : 'none' }
        }
      />

      {/* Case A: Local Screen Sharer Presenter Studio (Industry standard anti-recursion shield) */}
      {isPresenterCardActive ? (
        <div className="local-screenshare-presenter-card">
          <div className="presenter-live-pill">
            <span className="presenter-live-dot" />
            <span>LIVE BROADCAST • {screenResolution} • {screenFps}</span>
          </div>

          <div className="presenter-icon-pulse">
            <Monitor size={36} />
          </div>

          <div className="presenter-text">
            <h3>You are presenting your screen</h3>
            <p>
              Your screen is broadcasting live in high definition to everyone in the room.
              Remote participants see your clean screen with natural audio.
            </p>
          </div>

          {/* Real-time Broadcast Stats Badges */}
          <div className="presenter-stats-row">
            <div className="presenter-stat-chip">
              <span className="label">RESOLUTION</span>
              <span className="value">{screenResolution}</span>
            </div>
            <div className="presenter-stat-chip">
              <span className="label">FRAMERATE</span>
              <span className="value">{screenFps}</span>
            </div>
            <div className="presenter-stat-chip">
              <span className="label">VIEWERS</span>
              <span className="value">{Math.max(1, (participants?.length || 1) - 1)}</span>
            </div>
          </div>

          <div className="presenter-actions">
            <button
              type="button"
              className="btn btn-danger"
              style={{ borderRadius: 'var(--radius-pill)', padding: '8px 22px', gap: 8, fontSize: 13, fontWeight: 600 }}
              onClick={toggleScreenShare}
            >
              <StopCircle size={16} />
              <span>Stop Sharing</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ borderRadius: 'var(--radius-pill)', padding: '8px 16px', gap: 6, fontSize: 13 }}
              onClick={() => {
                setShowLocalMiniPreview(!showLocalMiniPreview);
                if (!showLocalMiniPreview) {
                  setTimeout(captureSnapshot, 150);
                }
              }}
              title={showLocalMiniPreview ? 'Hide preview' : 'Preview snapshot'}
            >
              {showLocalMiniPreview ? <EyeOff size={15} /> : <Eye size={15} />}
              <span>{showLocalMiniPreview ? 'Hide Preview' : 'Snapshot Preview'}</span>
            </button>

            {document.pictureInPictureEnabled && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ borderRadius: 'var(--radius-pill)', padding: '8px 14px', gap: 6, fontSize: 13 }}
                onClick={handlePiP}
                title="Pop out into Picture-in-Picture window"
              >
                <PictureInPicture size={15} />
                <span>Pop-out PiP</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ borderRadius: 'var(--radius-pill)', padding: '8px 16px', gap: 6, fontSize: 13 }}
              onClick={handleFullscreen}
              title="Fullscreen Presenter Studio"
            >
              <Maximize2 size={15} />
              <span>Fullscreen</span>
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, color: 'var(--text-muted)', gap: 4 }}
              onClick={() => setShowFullLocalVideo(true)}
              title="View live stream (reflects screen if on single monitor)"
            >
              <Tv size={13} />
              <span>Live Mirror</span>
            </button>
          </div>

          {/* Clean, Static Snapshot Preview (zero optical feedback recursion) */}
          {showLocalMiniPreview && (
            <div className="presenter-mini-preview-container">
              <canvas ref={snapshotCanvasRef} className="presenter-snapshot-canvas" />
              <div className="presenter-preview-overlay">
                <span className="preview-tag">SAFE PREVIEW</span>
                <button
                  type="button"
                  className="preview-refresh-btn"
                  onClick={captureSnapshot}
                  title="Refresh Screen Snapshot"
                >
                  <RefreshCw size={11} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Mirror Warning Banner (Google Meet style) */}
          {isLocalScreenShare && showFullLocalVideo && (
            <div className="mirror-warning-banner">
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>
                To avoid an infinite mirror, switch to another window. Remote participants see your clean screen.
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => setShowFullLocalVideo(false)}
                style={{
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: 4,
                  flexShrink: 0,
                }}
              >
                Presenter Studio
              </button>
            </div>
          )}

          {/* Avatar Placeholder when video is off */}
          {!hasVideoTrack && !isScreenTile && (
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
        </>
      )}

      {/* Tile Overlay: User Tag, Health Status & Audio/Video Badges */}
      <div className="video-tile-overlay">
        <div className="video-tile-user-tag" title={statsTooltip}>
          <span
            className="connection-quality-dot"
            style={{ backgroundColor: qualityColor }}
          />
          {(participant.isScreenSharing || isScreenTile) && (
            <Monitor size={14} style={{ color: 'var(--accent-light)' }} />
          )}
          <span>
            {isScreenTile ? screenTitle : (participant.displayName || participant.username)} {isLocal && !isScreenTile && '(You)'}
          </span>
          {participant.stats?.rtt !== undefined && (
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
          {participant.isVideoMuted && !isScreenTile && (
            <div className="badge-icon muted" title="Camera Off">
              <VideoOff size={14} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
