import React from 'react';
import { usePresence } from '../../app/providers/PresenceContext';
import { useServer } from '../../app/providers/ServerContext';

export const TypingIndicator: React.FC = () => {
  const { typingUsers } = usePresence();
  const { activeChannel } = useServer();

  if (!activeChannel) return <div className="typing-bar" />;

  const activeTypers = typingUsers.filter((u) => u.channelId === activeChannel.id);

  if (activeTypers.length === 0) {
    return <div className="typing-bar" />;
  }

  let text = '';
  if (activeTypers.length === 1) {
    text = `${activeTypers[0].username} is typing...`;
  } else if (activeTypers.length === 2) {
    text = `${activeTypers[0].username} and ${activeTypers[1].username} are typing...`;
  } else {
    text = `Several people are typing...`;
  }

  return (
    <div className="typing-bar">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span>{text}</span>
    </div>
  );
};
