import React from 'react';
import { useMedia } from '../../app/providers/MediaContext';
import { useServer } from '../../app/providers/ServerContext';
import { VideoGrid } from './VideoGrid';
import { VideoControls } from './VideoControls';
import { Users } from 'lucide-react';

interface VideoRoomProps {
  onOpenSettings: () => void;
}

export const VideoRoom: React.FC<VideoRoomProps> = ({ onOpenSettings }) => {
  const { participants, activeRoomId, joinVoiceRoom } = useMedia();
  const { activeChannel } = useServer();

  // If user navigated to a voice channel but hasn't clicked to join yet
  if (!activeRoomId && activeChannel) {
    return (
      <div className="video-room-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            maxWidth: 400,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-light)',
            }}
          >
            <Users size={36} />
          </div>
          <h2>{activeChannel.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Voice and video room ready. Connect your microphone and camera to start speaking with others.
          </p>
          <button
            className="btn btn-primary"
            style={{ padding: '12px 28px', fontSize: 15, borderRadius: 'var(--radius-pill)' }}
            onClick={() => joinVoiceRoom(activeChannel.id)}
          >
            Connect to Voice & Video
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-room-container">
      <VideoGrid participants={participants} />
      <VideoControls onOpenSettings={onOpenSettings} />
    </div>
  );
};
