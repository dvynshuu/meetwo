import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  tooltip?: string;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  tooltip,
  active = false,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`icon-btn ${active ? 'active' : ''} ${className}`}
      title={tooltip}
      {...props}
    >
      {icon}
    </button>
  );
};
