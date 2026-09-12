import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 24,
  color = 'var(--accent)',
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2.5px solid rgba(255, 255, 255, 0.1)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        display: 'inline-block',
      }}
    />
  );
};
