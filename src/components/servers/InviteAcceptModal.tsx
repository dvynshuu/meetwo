import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Server } from '../../types';
import { useServer, ResolvedInvite } from '../../app/providers/ServerContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Button } from '../ui/Button';
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Sparkles,
  LogIn,
  UserCheck,
  X,
} from 'lucide-react';

interface InviteAcceptModalProps {
  isOpen: boolean;
  inviteCode: string;
  encodedData?: string | null;
  onClose: () => void;
  onSuccess: (server: Server, channelId?: string) => void;
}

export const InviteAcceptModal: React.FC<InviteAcceptModalProps> = ({
  isOpen,
  inviteCode,
  encodedData,
  onClose,
  onSuccess,
}) => {
  const { resolveInvite, acceptInvite, selectServer } = useServer();
  const { currentUser, login, signup } = useAuth();

  const [resolved, setResolved] = useState<ResolvedInvite | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guest name input if not logged in
  const [guestName, setGuestName] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Resolve invite when modal opens or code changes
  useEffect(() => {
    if (!isOpen || !inviteCode) return;

    let isMounted = true;
    const fetchInvite = async () => {
      setIsResolving(true);
      setError(null);
      try {
        const data = await resolveInvite(inviteCode, encodedData);
        if (!isMounted) return;
        if (!data) {
          setError('This invite is invalid or has expired.');
        } else {
          setResolved(data);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to verify invite link.');
      } finally {
        if (isMounted) setIsResolving(false);
      }
    };

    fetchInvite();

    return () => {
      isMounted = false;
    };
  }, [isOpen, inviteCode, encodedData, currentUser?.id]);

  if (!isOpen) return null;

  const handleAccept = async () => {
    // If not logged in, user needs to enter a name first
    if (!currentUser) {
      if (!guestName.trim()) {
        setAuthError('Please enter a display name to continue.');
        return;
      }
      setIsAuthenticating(true);
      setAuthError(null);
      try {
        const cleanName = guestName.trim();
        const guestEmail = `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}_${Date.now()}@meetwo.local`;
        const success = await signup(cleanName, guestEmail, 'guestpass123');
        if (!success) {
          // Fallback login
          await login(cleanName);
        }
      } catch (e: any) {
        setAuthError(e.message || 'Failed to initialize profile.');
        setIsAuthenticating(false);
        return;
      }
      setIsAuthenticating(false);
    }

    setIsAccepting(true);
    setError(null);
    try {
      const { server, channelId } = await acceptInvite(inviteCode, encodedData);
      onSuccess(server, channelId);
    } catch (err: any) {
      setError(err.message || 'Failed to join server.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleGoToExistingServer = () => {
    if (resolved?.server) {
      selectServer(resolved.server.id, resolved.server);
      onSuccess(resolved.server);
    } else {
      onClose();
    }
  };

  const server = resolved?.server;
  const inviter = resolved?.inviter;
  const isMember = resolved?.isMember;
  const memberCount = resolved?.memberCount || 1;

  const modalElement = (
    <div
      className="modal-overlay"
      style={{
        zIndex: 200,
        backgroundColor: 'rgba(5, 7, 12, 0.82)',
        backdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 440,
          padding: 0,
          overflow: 'hidden',
          background: 'var(--bg-overlay, #11141c)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.12))',
          boxShadow:
            '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(99, 102, 241, 0.15), 0 0 40px rgba(99, 102, 241, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Glow Banner */}
        <div
          style={{
            position: 'relative',
            height: 100,
            background:
              'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(139, 92, 246, 0.25) 50%, rgba(14, 165, 233, 0.15) 100%)',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(255, 255, 255, 0.85)',
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '4px 10px',
              borderRadius: 20,
              backdropFilter: 'blur(4px)',
            }}
          >
            <Sparkles size={12} style={{ color: '#818cf8' }} />
            Meetwo Server Invite
          </div>

          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              color: '#fff',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '0 24px 28px', marginTop: -40, position: 'relative' }}>
          {isResolving ? (
            /* Loading State */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '30px 0 20px',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  background: 'var(--bg-surface-elevated, #1a1e28)',
                  border: '2px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'pulse 1.5s infinite',
                }}
              >
                <Users size={32} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
                  Resolving Invite...
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Looking up server details for invite code <code>{inviteCode}</code>
                </div>
              </div>
            </div>
          ) : error || !server ? (
            /* Error / Invalid State */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                paddingTop: 10,
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <AlertTriangle size={32} />
              </div>

              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Invalid or Expired Invite
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  {error ||
                    'This invite link may be expired, reached its usage limit, or you might not have permission to join.'}
                </p>
              </div>

              <div style={{ width: '100%', marginTop: 8 }}>
                <Button
                  type="button"
                  variant="primary"
                  onClick={onClose}
                  style={{ width: '100%', height: 42 }}
                >
                  Continue to Meetwo
                </Button>
              </div>
            </div>
          ) : (
            /* Valid Server Invite State */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Server Avatar / Icon */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  background: 'var(--bg-surface-elevated, #1a1e28)',
                  border: '3px solid var(--bg-overlay, #11141c)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 28,
                    }}
                  >
                    {server.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Sub-header text */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                You've been invited to join
              </span>

              {/* Server Title */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display, inherit)',
                  }}
                >
                  {server.name}
                </h2>
                <ShieldCheck size={20} style={{ color: 'var(--accent, #6366f1)', flexShrink: 0 }} />
              </div>

              {/* Server Description */}
              {server.description && (
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                    marginTop: 6,
                    lineHeight: 1.4,
                    maxWidth: 340,
                  }}
                >
                  {server.description}
                </p>
              )}

              {/* Stats Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  marginTop: 14,
                  padding: '8px 16px',
                  background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.04))',
                  borderRadius: 20,
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#22c55e',
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#22c55e',
                      boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)',
                    }}
                  />
                  1 Online
                </span>
                <span style={{ color: 'var(--border-medium)' }}>•</span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--text-muted)',
                    }}
                  />
                  {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
                </span>
              </div>

              {/* Inviter Info */}
              {inviter && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 12,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                  }}
                >
                  {inviter.avatarUrl && (
                    <img
                      src={inviter.avatarUrl}
                      alt={inviter.displayName}
                      style={{ width: 20, height: 20, borderRadius: '50%' }}
                    />
                  )}
                  <span>
                    Invited by <strong>{inviter.displayName}</strong>
                  </span>
                </div>
              )}

              {/* Conditional Action Area */}
              <div style={{ width: '100%', marginTop: 20 }}>
                {isMember ? (
                  /* Already a Member */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                      style={{
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.25)',
                        borderRadius: 'var(--radius-sm, 6px)',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 12,
                        color: '#22c55e',
                      }}
                    >
                      <CheckCircle size={18} style={{ flexShrink: 0 }} />
                      <span>You are already a member of this workspace.</span>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      icon={<ArrowRight size={16} />}
                      onClick={handleGoToExistingServer}
                      style={{ width: '100%', height: 44, fontWeight: 600 }}
                    >
                      Go to {server.name}
                    </Button>
                  </div>
                ) : (
                  /* Ready to Join */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* If user is not logged in, ask for their display name */}
                    {!currentUser && (
                      <div
                        style={{
                          background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.04))',
                          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                          borderRadius: 'var(--radius-sm, 8px)',
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <label
                          className="input-label"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            margin: 0,
                          }}
                        >
                          What should we call you?
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Enter your username or display name"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAccept();
                          }}
                          autoFocus
                          style={{ height: 38, fontSize: 13 }}
                        />
                        {authError && (
                          <div style={{ fontSize: 11, color: 'var(--danger, #ef4444)' }}>
                            {authError}
                          </div>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          This will be your identity in {server.name}. You can customize your
                          profile later.
                        </span>
                      </div>
                    )}

                    {error && (
                      <div
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 'var(--radius-sm, 6px)',
                          padding: '10px 14px',
                          fontSize: 12,
                          color: '#ef4444',
                        }}
                      >
                        {error}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="primary"
                      disabled={isAccepting || isAuthenticating}
                      icon={isAccepting ? undefined : <UserCheck size={16} />}
                      onClick={handleAccept}
                      style={{
                        width: '100%',
                        height: 46,
                        fontWeight: 600,
                        fontSize: 15,
                        background: 'var(--gradient-primary, linear-gradient(135deg, #6366f1, #8b5cf6))',
                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                      }}
                    >
                      {isAccepting
                        ? 'Joining Workspace...'
                        : isAuthenticating
                        ? 'Creating profile...'
                        : `Join ${server.name}`}
                    </Button>

                    <div
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      By joining, you agree to Meetwo Community Guidelines.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
};

export default InviteAcceptModal;
