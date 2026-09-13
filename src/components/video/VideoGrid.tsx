import React from 'react';
import { Participant } from '../../types';
import { VideoTile } from './VideoTile';
import { useAuth } from '../../app/providers/AuthContext';
import { useMedia } from '../../app/providers/MediaContext';

interface VideoGridProps {
  participants: Participant[];
  viewLayout?: 'grid' | 'focus';
}

export const VideoGrid: React.FC<VideoGridProps> = ({ participants, viewLayout = 'grid' }) => {
  const { currentUser } = useAuth();
  const { pinnedParticipantId } = useMedia();

  // 1. Identify screen sharer and pinned participant
  const screenSharer = participants.find((p) => p.isScreenSharing);
  const pinnedParticipant = participants.find((p) => p.id === pinnedParticipantId);

  // Case A: Screen Share (Discord Style: Top Participant Strip + Main Presentation Stage)
  if (screenSharer) {
    const isLocalScreen = screenSharer.userId === currentUser?.id;
    const presentationStream = screenSharer.screenStream || screenSharer.stream;

    return (
      <div className="video-stage-container presentation-mode" id="video-grid">
        {/* Top Participant Strip (Discord Style - always visible when participants exist) */}
        {participants.length > 0 && (
          <div className="video-stage-strip">
            {participants.map((p) => {
              const isSharer = p.id === screenSharer.id;
              // If participant is the screen sharer, their strip tile displays their webcam or avatar,
              // rather than duplicating the screen presentation stream.
              const participantForStrip =
                isSharer && p.screenStream
                  ? { ...p, stream: p.stream !== p.screenStream ? p.stream : undefined }
                  : isSharer && !p.screenStream
                  ? { ...p, stream: undefined }
                  : p;

              return (
                <div key={`strip-${p.id}`} className="video-stage-strip-item">
                  <VideoTile
                    participant={participantForStrip}
                    isLocal={p.userId === currentUser?.id}
                    isFeatured={false}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Main Presentation Stage */}
        <div className="video-stage-viewport">
          <VideoTile
            participant={{
              ...screenSharer,
              stream: presentationStream,
              displayName: isLocalScreen
                ? 'Your Screen'
                : `${screenSharer.displayName || screenSharer.username}'s Screen`,
            }}
            isLocal={isLocalScreen}
            isFeatured={true}
            isScreenTile={true}
          />
        </div>
      </div>
    );
  }

  // Case B: Pinned Participant or Focus / Speaker View Mode
  const activeSpeaker = participants.find((p) => p.isSpeaking);
  const featuredTarget = pinnedParticipant || (viewLayout === 'focus' ? activeSpeaker || participants[0] : null);

  if (featuredTarget && participants.length > 1) {
    const remainingParticipants = participants.filter((p) => p.id !== featuredTarget.id);

    return (
      <div className="video-stage-container focus-mode" id="video-grid">
        {/* Top Participant Strip (Discord Style) */}
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

        {/* Main Focus Stage */}
        <div className="video-stage-viewport">
          <VideoTile
            participant={featuredTarget}
            isLocal={featuredTarget.userId === currentUser?.id}
            isFeatured={true}
          />
        </div>
      </div>
    );
  }

  // Case C: Intelligent Adaptive Grid
  const count = participants.length;
  let layoutClass = 'layout-1';

  if (count === 2) {
    layoutClass = 'layout-2';
  } else if (count === 3) {
    layoutClass = 'layout-3';
  } else if (count === 4) {
    layoutClass = 'layout-4';
  } else if (count >= 5) {
    layoutClass = 'layout-6';
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
