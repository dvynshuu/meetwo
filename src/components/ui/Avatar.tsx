import React from 'react';
import { UserStatus } from '../../types';

interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  status?: UserStatus;
  showStatus?: boolean;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 36,
  status,
  showStatus = false,
  className = '',
}) => {
  const [imgError, setImgError] = React.useState(false);

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const statusBadgeSize = Math.max(8, Math.round(size * 0.28));

  return (
    <div
      className={`avatar-wrap ${className}`}
      style={{ width: size, height: size }}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={name}
          className="avatar-img"
          style={{ width: size, height: size }}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="avatar-fallback"
          style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) }}
        >
          {initials}
        </div>
      )}

      {showStatus && status && (
        <span
          className={`status-badge status-${status}`}
          style={{
            width: statusBadgeSize,
            height: statusBadgeSize,
            borderWidth: Math.max(1.5, Math.round(size * 0.05)),
          }}
          title={`Status: ${status}`}
        />
      )}
    </div>
  );
};
