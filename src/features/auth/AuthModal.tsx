import React, { useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, signup, error: authError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (isSignUp && !username.trim()) {
      setFormError('Username is required');
      return;
    }

    if (!email.trim()) {
      setFormError('Email or username is required');
      return;
    }

    setIsLoading(true);
    try {
      let success = false;
      if (isSignUp) {
        success = await signup(username.trim(), email.trim(), password);
      } else {
        success = await login(email.trim(), password);
      }

      if (success) {
        onClose();
      }
    } catch (err: any) {
      setFormError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent-subtle)',
                border: '1px solid rgba(16, 231, 178, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <img src="/favicon.svg" alt="meetwo" style={{ width: 24, height: 24 }} />
            </div>
            <div>
              <h2 className="modal-title" style={{ fontSize: 18, margin: 0 }}>
                {isSignUp ? 'Create your Meetwo account' : 'Welcome back to Meetwo'}
              </h2>
              <p className="modal-description" style={{ marginTop: 4 }}>
                {isSignUp
                  ? 'Connect with teams, participate in voice rooms, and collaborate.'
                  : 'Log in to continue to your workspaces and direct messages.'}
              </p>
            </div>
          </div>
        </div>

        <div className="modal-body">
          {(formError || authError) && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-surface)',
                border: '1px solid rgba(251, 113, 133, 0.3)',
                color: 'var(--danger)',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              {formError || authError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isSignUp && (
              <Input
                label="Username"
                type="text"
                placeholder="e.g. alexander"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            )}

            <Input
              label={isSignUp ? 'Email Address' : 'Email or Username'}
              type={isSignUp ? 'email' : 'text'}
              placeholder={isSignUp ? 'you@example.com' : 'you@example.com or username'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={!isSignUp}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText="Minimum 6 characters recommended."
            />

            <Button type="submit" variant="primary" isLoading={isLoading} style={{ marginTop: 6 }}>
              {isSignUp ? 'Sign Up' : 'Log In'}
            </Button>
          </form>

          {/* Switch Mode */}
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 14 }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              {isSignUp ? 'Log In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
