import React, { useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Sparkles, ArrowRight, ShieldCheck, Headphones, Video } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, signup, error: authError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

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
      if (isSignUp) {
        await signup(username.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err: any) {
      setFormError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(16, 231, 178, 0.08) 0%, rgba(10, 12, 16, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 28,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-subtle)',
              border: '1px solid rgba(16, 231, 178, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 8px 24px rgba(16, 231, 178, 0.15)',
            }}
          >
            <img src="/favicon.svg" alt="Meetwo" style={{ width: 32, height: 32 }} />
          </div>

          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 0 6px 0',
              fontFamily: 'var(--font-heading)',
            }}
          >
            {isSignUp ? 'Join Meetwo' : 'Welcome back to Meetwo'}
          </h1>

          <p
            style={{
              fontSize: 14,
              color: 'var(--text-muted)',
              margin: 0,
              lineHeight: 1.5,
              maxWidth: 320,
            }}
          >
            {isSignUp
              ? 'Calm human communication with studio audio and fluid video.'
              : 'Sign in to access your workspaces, channels, and friends.'}
          </p>
        </div>

        {/* Form Card */}
        <div
          style={{
            width: '100%',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 28,
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {(formError || authError) && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-surface)',
                border: '1px solid rgba(251, 113, 133, 0.3)',
                color: 'var(--danger)',
                fontSize: 13,
                marginBottom: 18,
                lineHeight: 1.4,
              }}
            >
              {formError || authError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              label={isSignUp ? 'Email Address' : 'Email Address'}
              type="email"
              placeholder="you@example.com"
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
              helperText={isSignUp ? 'Minimum 6 characters recommended.' : undefined}
            />

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              style={{
                marginTop: 8,
                padding: '12px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          {/* Toggle Login / Signup */}
          <div
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--text-muted)',
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {isSignUp ? 'Already have an account? ' : "Don't have an account yet? "}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setFormError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {isSignUp ? 'Sign In' : 'Create an Account'}
            </button>
          </div>
        </div>

        {/* Feature Badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            marginTop: 28,
            color: 'var(--text-muted)',
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Headphones size={14} style={{ color: 'var(--accent)' }} />
            <span>Studio Opus</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Video size={14} style={{ color: 'var(--accent)' }} />
            <span>1080p HD Video</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent)' }} />
            <span>End-to-End Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
};
