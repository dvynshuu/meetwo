import React, { useEffect, useRef } from 'react';
import { Participant } from '../../types';

interface RemoteAudioTrackProps {
  id: string;
  stream: MediaStream;
  isDeafened: boolean;
  sinkId?: string;
}

const RemoteAudioTrack: React.FC<RemoteAudioTrackProps> = ({
  id,
  stream,
  isDeafened,
  sinkId,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (audioEl.srcObject !== stream) {
      audioEl.srcObject = stream;
    }
    audioEl.muted = isDeafened;

    if (sinkId && typeof (audioEl as any).setSinkId === 'function') {
      (audioEl as any).setSinkId(sinkId).catch((err: any) => {
        console.warn(`[RemoteAudioTrack] setSinkId failed for ${id}:`, err);
      });
    }

    const attemptPlay = () => {
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== 'AbortError') {
            console.warn(`[RemoteAudioTrack] Audio play suspended for ${id}:`, err.name);
            const resumeAudio = () => {
              audioEl.play().catch(() => {});
              window.removeEventListener('click', resumeAudio);
              window.removeEventListener('keydown', resumeAudio);
            };
            window.addEventListener('click', resumeAudio, { once: true });
            window.addEventListener('keydown', resumeAudio, { once: true });
          }
        });
      }
    };

    attemptPlay();
  }, [id, stream, isDeafened, sinkId]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      controls={false}
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

interface RemoteAudioRendererProps {
  participants: Participant[];
  currentUserId?: string;
  isDeafened: boolean;
  sinkId?: string;
}

export const RemoteAudioRenderer: React.FC<RemoteAudioRendererProps> = ({
  participants,
  currentUserId,
  isDeafened,
  sinkId,
}) => {
  const remoteParticipants = participants.filter((p) => p.userId !== currentUserId);

  return (
    <div
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {remoteParticipants.map((p) => {
        const hasAudioTrack =
          Boolean(p.stream) && p.stream!.getAudioTracks().length > 0;
        const hasScreenAudioTrack =
          Boolean(p.screenStream) && p.screenStream!.getAudioTracks().length > 0;

        return (
          <React.Fragment key={`remote-audio-group-${p.id}`}>
            {hasAudioTrack && p.stream && (
              <RemoteAudioTrack
                id={`mic-${p.id}`}
                stream={p.stream}
                isDeafened={isDeafened}
                sinkId={sinkId}
              />
            )}
            {hasScreenAudioTrack && p.screenStream && (
              <RemoteAudioTrack
                id={`screen-${p.id}`}
                stream={p.screenStream}
                isDeafened={isDeafened}
                sinkId={sinkId}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
