import React, { useState } from 'react';
import { BarChart3, CheckCircle2 } from 'lucide-react';
import { Poll } from '../../types';
import { useAuth } from '../../app/providers/AuthContext';

interface PollMessageProps {
  poll: Poll;
  onVote?: (pollId: string, optionId: string) => void;
}

export const PollMessage: React.FC<PollMessageProps> = ({ poll: initialPoll, onVote }) => {
  const { currentUser } = useAuth();
  const [poll, setPoll] = useState<Poll>(initialPoll);

  const userId = currentUser?.id || 'anonymous';
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voterIds.length, 0);

  const handleToggleVote = (optionId: string) => {
    setPoll((prev) => {
      const nextOptions = prev.options.map((opt) => {
        const hasVoted = opt.voterIds.includes(userId);
        if (opt.id === optionId) {
          return {
            ...opt,
            voterIds: hasVoted
              ? opt.voterIds.filter((id) => id !== userId)
              : [...opt.voterIds, userId],
          };
        }
        return opt;
      });
      return { ...prev, options: nextOptions };
    });

    if (onVote) {
      onVote(poll.id, optionId);
    }
  };

  return (
    <div className="poll-card" role="region" aria-label={`Poll: ${poll.question}`}>
      <div className="poll-header">
        <div className="poll-title-wrap">
          <BarChart3 size={16} style={{ color: 'var(--accent)' }} />
          <span className="poll-question">{poll.question}</span>
        </div>
        <span className="poll-total-votes">
          {totalVotes} vote{totalVotes === 1 ? '' : 's'}
        </span>
      </div>

      <div className="poll-options-list">
        {poll.options.map((opt) => {
          const hasVoted = opt.voterIds.includes(userId);
          const percent = totalVotes > 0 ? Math.round((opt.voterIds.length / totalVotes) * 100) : 0;

          return (
            <button
              key={opt.id}
              className={`poll-option-btn ${hasVoted ? 'voted' : ''}`}
              onClick={() => handleToggleVote(opt.id)}
              title={hasVoted ? 'Click to remove vote' : 'Click to vote'}
            >
              {/* Progress background fill */}
              <div
                className="poll-option-progress"
                style={{ width: `${percent}%` }}
              />

              <div className="poll-option-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, zIndex: 1 }}>
                  {hasVoted && <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />}
                  <span className="poll-option-text">{opt.text}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 1 }}>
                  <span className="poll-option-count">{opt.voterIds.length}</span>
                  <span className="poll-option-percent">{percent}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
