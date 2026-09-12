import React, { useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SEED_USERS } from '../../lib/supabase/mockStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, signup, switchDemoUser, isDemoMode, error: authError } = useAuth();
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
      setFormError('Email is required');
      return;
    }

    setIsLoading(true);
    try {
      let success = false;
      if (isSignUp) {
        success = await signup(username.trim(), email.trim(), password || undefined);
      } else {
        success = await login(email.trim(), password || undefined);
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

  const handleDemoSelect = (userId: string) => {
    switchDemoUser(userId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h3>{isSignUp ? 'Create an Account' : 'Welcome to Meetwo'}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {isSignUp ? 'Join servers and start communicating.' : 'Sign in to access your communities.'}
            </p>
          </div>
        </div>

        <div className="modal-body">
          {(formError || authError) && (
            <div
              style={{
                background: 'var(--danger-surface)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {formError || authError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isSignUp && (
              <Input
                label="Username"
                placeholder="divyanshu"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            )}

            <Input
              label="Email or Username"
              placeholder="user@example.com"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
          <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              style={{ color: 'var(--accent-light)', fontWeight: 600, cursor: 'pointer' }}
            >
              {isSignUp ? 'Log In' : 'Sign Up'}
            </button>
          </div>

          {/* Quick Persona Logins for Demo Mode */}
          {isDemoMode && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
              <span className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                Or instant login as test user:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SEED_USERS.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '6px 10px', justifyContent: 'flex-start', gap: 6 }}
                    onClick={() => handleDemoSelect(user.id)}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor:
                          user.status === 'online'
                            ? 'var(--status-online)'
                            : user.status === 'idle'
                            ? 'var(--status-idle)'
                            : 'var(--status-dnd)',
                      }}
                    />
                    <span className="truncate">{user.displayName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
