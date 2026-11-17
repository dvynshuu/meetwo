import React, { useState, useEffect, useCallback } from 'react';
import { useMedia } from '../../app/providers/MediaContext';

interface ActiveReaction {
  id: string;
  emoji: string;
  senderName: string;
  leftPercent: number;
}

export const ReactionBurstOverlay: React.FC = () => {
  const { subscribeCallReaction } = useMedia();
  const [reactions, setReactions] = useState<ActiveReaction[]>([]);

  const handleIncomingReaction = useCallback(
    (reaction: { emoji: string; senderId: string; senderName: string }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Position reaction across center 60% of viewport
      const leftPercent = 20 + Math.random() * 60;

      const newBurst: ActiveReaction = {
        id,
        emoji: reaction.emoji,
        senderName: reaction.senderName,
        leftPercent,
      };

      setReactions((prev) => [...prev.slice(-20), newBurst]);

      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2400);
    },
    []
  );

  useEffect(() => {
    return subscribeCallReaction(handleIncomingReaction);
  }, [subscribeCallReaction, handleIncomingReaction]);

  if (reactions.length === 0) return null;

  return (
    <div className="reaction-burst-overlay" pointer-events="none" aria-hidden="true">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="reaction-particle-bubble"
          style={{ left: `${r.leftPercent}%` }}
        >
          <span className="reaction-emoji">{r.emoji}</span>
          {r.senderName && (
            <span className="reaction-sender-badge truncate">{r.senderName}</span>
          )}
        </div>
      ))}
    </div>
  );
};
