import React, { useState, useEffect } from 'react';
import { useServer, ResolvedInvite } from '../../app/providers/ServerContext';
import { useAuth } from '../../app/providers/AuthContext';
import { Users, ShieldCheck, Check, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';

interface ServerInviteEmbedProps {
  inviteCode: string;
  encodedData?: string | null;
  onOpenInviteModal?: (code: string, data?: string | null) => void;
}

export const ServerInviteEmbed: React.FC<ServerInviteEmbedProps> = ({
  inviteCode,
  encodedData,
  onOpenInviteModal,
}) => {
  const { resolveInvite, acceptInvite, selectServer, activeServer } = useServer();
  const { currentUser } = useAuth();
  const [resolved, setResolved] = useState<ResolvedInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    resolveInvite(inviteCode, encodedData)
      .then((res) => {
        if (active) {
          setResolved(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [inviteCode, encodedData, currentUser?.id]);

  if (loading) {
    return (
      <div
        style={{
          marginTop: 8,
          maxWidth: 420,
          background: 'var(--bg-surface-elevated, #161a23)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--bg-surface-hover, rgba(255,255,255,0.06))',
            animation: 'pulse 1.5s infinite',
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              height: 14,
              width: 120,
              background: 'var(--bg-surface-hover, rgba(255,255,255,0.06))',
              borderRadius: 4,
              animation: 'pulse 1.5s infinite',
            }}
          />
          <div
            style={{
              height: 10,
              width: 80,
              background: 'var(--bg-surface-hover, rgba(255,255,255,0.04))',
              borderRadius: 4,
              marginTop: 6,
              animation: 'pulse 1.5s infinite',
            }}
          />
        </div>
      </div>
    );
  }

  if (!resolved || !resolved.server) {
    return null;
  }

  const { server, isMember, memberCount } = resolved;
  const isCurrentServer = activeServer?.id === server.id;

  const handleAction = async () => {
    if (isMember) {
      selectServer(server.id, server);
    } else if (onOpenInviteModal) {
      onOpenInviteModal(inviteCode, encodedData);
    } else {
      window.dispatchEvent(
        new CustomEvent('meetwo:open-invite', {
          detail: { code: inviteCode, encodedData },
        })
      );
    }
  };

  return (
    <div
      style={{
        marginTop: 8,
        maxWidth: 440,
        background: 'var(--bg-surface-elevated, #161a23)',
        border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.12))',
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted, #8b949e)',
        }}
      >
        You've been invited to join a server
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Server Icon */}
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
          }}
        >
          {server.iconUrl ? (
            <img
              src={server.iconUrl}
              alt={server.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>
              {server.name.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Server Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {server.name}
            </span>
            <ShieldCheck size={15} style={{ color: 'var(--accent, #6366f1)', flexShrink: 0 }} />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 4,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: '#22c55e',
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 4px #22c55e',
                }}
              />
              1 Online
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Users size={12} style={{ color: 'var(--text-muted)' }} />
              {memberCount} {memberCount === 1 ? 'Member' : 'Members'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <Button
            type="button"
            variant={isMember ? 'secondary' : 'primary'}
            size="sm"
            disabled={joining}
            onClick={handleAction}
            icon={isMember ? <Check size={14} /> : <ArrowRight size={14} />}
          >
            {isCurrentServer ? 'Current' : isMember ? 'Joined' : joining ? 'Joining...' : 'Join'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ServerInviteEmbed;
