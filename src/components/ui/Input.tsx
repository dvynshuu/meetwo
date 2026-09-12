import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`input-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input-field ${error ? 'input-error' : ''}`}
        {...props}
      />
      {error && <span className="input-error-msg" style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
      {!error && helperText && (
        <span className="input-helper-msg" style={{ color: 'var(--text-muted)', fontSize: 12 }}>{helperText}</span>
      )}
    </div>
  );
};
