import React from 'react';
import { Participant } from '../../types';
import { VideoTile } from './VideoTile';
import { useAuth } from '../../app/providers/AuthContext';
import { useMedia } from '../../app/providers/MediaContext';

interface VideoGridProps {
  participants: Participant[];
}

export const VideoGrid: React.FC<VideoGridProps> = ({ participants }) => {
  const { currentUser } = useAuth();
  const { pinnedParticipantId } = useMedia();

  // Find featured participant (screen sharing or manually pinned)
  const screenSharer = participants.find((p) => p.isScreenSharing);
  const pinnedParticipant = participants.find((p) => p.id === pinnedParticipantId);
  const featured = screenSharer || pinnedParticipant;

  if (featured && participants.length > 1) {
    const stripParticipants = participants.filter((p) => p.id !== featured.id);

    return (
      <div className="video-stage-container" id="video-grid">
        {/* Main Stage */}
        <div className="video-stage-viewport">
          <VideoTile
            participant={featured}
            isLocal={featured.userId === currentUser?.id}
            isFeatured={true}
          />
        </div>

        {/* Participant Strip Below */}
        <div className="video-stage-strip">
          {stripParticipants.map((p) => (
            <div key={p.id} className="video-stage-strip-item">
              <VideoTile
                participant={p}
                isLocal={p.userId === currentUser?.id}
                isFeatured={false}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Standard Balanced Grid
  const count = participants.length;
  let layoutClass = 'layout-1';
  if (count === 2) layoutClass = 'layout-2';
  else if (count >= 3 && count <= 4) layoutClass = 'layout-4';
  else if (count > 4) layoutClass = 'layout-6';

  return (
    <div className={`video-grid ${layoutClass}`} id="video-grid">
      {participants.map((p) => (
        <VideoTile
          key={p.id}
          participant={p}
          isLocal={p.userId === currentUser?.id}
          isFeatured={count === 1}
        />
      ))}
    </div>
  );
};
