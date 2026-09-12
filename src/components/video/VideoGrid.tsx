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

  // 1. Identify featured participant: Screen sharer prioritized, then pinned, then active speaker
  const screenSharer = participants.find((p) => p.isScreenSharing);
  const pinnedParticipant = participants.find((p) => p.id === pinnedParticipantId);

  // If there's a screen sharer or a pinned participant, switch to presentation stage mode
  const featured = screenSharer || pinnedParticipant;

  if (featured && participants.length > 1) {
    const stripParticipants = participants.filter((p) => p.id !== featured.id);

    return (
      <div className="video-stage-container" id="video-grid">
        {/* Main Presentation Stage */}
        <div className="video-stage-viewport">
          <VideoTile
            participant={featured}
            isLocal={featured.userId === currentUser?.id}
            isFeatured={true}
          />
        </div>

        {/* Secondary Participant Strip */}
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

  // 2. Intelligent Adaptive Grid for 1–6 Participants
  const count = participants.length;
  let layoutClass = 'layout-1';

  if (count === 2) {
    layoutClass = 'layout-2';
  } else if (count === 3) {
    layoutClass = 'layout-3'; // 2 top, 1 centered bottom
  } else if (count === 4) {
    layoutClass = 'layout-4'; // 2x2
  } else if (count >= 5) {
    layoutClass = 'layout-6'; // 3x2 balanced
  }

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
