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

  // 1. Identify screen sharer and pinned participant
  const screenSharer = participants.find((p) => p.isScreenSharing && (p.screenStream || p.stream));
  const pinnedParticipant = participants.find((p) => p.id === pinnedParticipantId);

  // Case A: Someone is sharing their screen (presentation mode with simultaneous camera facecam!)
  if (screenSharer) {
    const isLocalScreen = screenSharer.userId === currentUser?.id;
    // Dedicated presentation stream
    const presentationStream = screenSharer.screenStream || screenSharer.stream;

    return (
      <div className="video-stage-container" id="video-grid">
        {/* Main Presentation Stage: Screen Share */}
        <div className="video-stage-viewport">
          <VideoTile
            participant={{
              ...screenSharer,
              stream: presentationStream,
              displayName: `${screenSharer.displayName || screenSharer.username}'s Screen`,
            }}
            isLocal={isLocalScreen}
            isFeatured={true}
            isScreenTile={true}
          />
        </div>

        {/* Secondary Participant Strip: ALL participants (including presenter's camera tile!) */}
        <div className="video-stage-strip">
          {participants.map((p) => (
            <div key={`strip-${p.id}`} className="video-stage-strip-item">
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

  // Case B: A participant is pinned (spotlight mode)
  if (pinnedParticipant && participants.length > 1) {
    const remainingParticipants = participants.filter((p) => p.id !== pinnedParticipant.id);

    return (
      <div className="video-stage-container" id="video-grid">
        {/* Main Spotlight Stage */}
        <div className="video-stage-viewport">
          <VideoTile
            participant={pinnedParticipant}
            isLocal={pinnedParticipant.userId === currentUser?.id}
            isFeatured={true}
          />
        </div>

        {/* Secondary Participant Strip */}
        <div className="video-stage-strip">
          {remainingParticipants.map((p) => (
            <div key={`strip-${p.id}`} className="video-stage-strip-item">
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

  // Case C: Intelligent Adaptive Grid for 1–6 Participants
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
