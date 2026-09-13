import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useServer } from '../../app/providers/ServerContext';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import { Invite, Server } from '../../types';
import {
  Copy,
  Check,
  Link2,
  Users,
  Settings2,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Clock,
  Hash,
} from 'lucide-react';

interface ServerInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const encodeServerPayload = (server: Server): string => {
  try {
    const payload = {
      id: server.id,
      name: server.name,
      iconUrl: server.iconUrl,
      description: server.description,
      ownerId: server.ownerId,
      createdAt: server.createdAt,
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return '';
  }
};

export const ServerInviteModal: React.FC<ServerInviteModalProps> = ({ isOpen, onClose }) => {
  const { activeServer, createInvite, channels, members } = useServer();
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Invite link configuration
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(undefined);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);

  const generateLink = useCallback(
    async (hours?: number, uses?: number) => {
      if (!activeServer) return;
      setIsLoading(true);
      try {
        const newInvite = await createInvite(activeServer.id, {
          expiresInHours: hours,
          maxUses: uses,
        });
        setInvite(newInvite);
      } catch (err) {
        console.error('Failed to create server invite:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeServer, createInvite]
  );

  useEffect(() => {
    if (isOpen && activeServer) {
      generateLink(expiresInHours, maxUses);
    }
  }, [isOpen, activeServer?.id]);

  if (!isOpen || !activeServer) return null;

  // Build the complete invite link
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const code = invite?.code || '';
  const baseUrl = `${origin}/invite/${code}`;

  // Always include encoded server payload so the invite link works 100% in production,
  // across all browsers, incognito tabs, and Supabase RLS policies
  const demoParam = activeServer ? `?d=${encodeServerPayload(activeServer)}` : '';

  const inviteUrl = `${baseUrl}${demoParam}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenLink = () => {
    window.open(inviteUrl, '_blank');
  };

  const handleApplySettings = () => {
    generateLink(expiresInHours, maxUses);
    setShowSettings(false);
  };

  const generalChan = channels.find((c) => c.name === 'general') || channels[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invite friends to ${activeServer.name}`}
      maxWidth="500px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Server Preview Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 16px',
            background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.03))',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          }}
        >
          {activeServer.iconUrl ? (
            <img
              src={activeServer.iconUrl}
              alt={activeServer.name}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
              }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--gradient-primary, linear-gradient(135deg, #6366f1, #8b5cf6))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {activeServer.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                {activeServer.name}
              </span>
              <ShieldCheck size={16} style={{ color: 'var(--accent, #6366f1)', flexShrink: 0 }} />
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 2,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={12} /> {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Hash size={12} /> #{generalChan?.name || 'general'}
              </span>
            </div>
          </div>
        </div>

        {/* Invite Link Box */}
        <div className="input-group">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <label className="input-label" style={{ margin: 0, fontWeight: 600 }}>
              Send a Server Invite Link
            </label>
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                color: showSettings ? 'var(--accent)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              <Settings2 size={13} />
              {showSettings ? 'Hide Options' : 'Edit Invite Link'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="input-field"
              value={isLoading ? 'Generating unique invite...' : inviteUrl}
              readOnly
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                background: 'var(--bg-input, rgba(0,0,0,0.25))',
                cursor: 'text',
              }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              type="button"
              variant="primary"
              disabled={isLoading || !code}
              icon={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 6,
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} />
              {expiresInHours
                ? `Expires in ${expiresInHours} hour${expiresInHours > 1 ? 's' : ''}`
                : 'Never expires'}
              {' • '}
              {maxUses ? `Max ${maxUses} use${maxUses > 1 ? 's' : ''}` : 'Unlimited uses'}
            </span>

            <button
              type="button"
              onClick={handleOpenLink}
              disabled={isLoading || !code}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              <ExternalLink size={11} /> Test Invite Link
            </button>
          </div>
        </div>

        {/* Link Customization Disclosure */}
        {showSettings && (
          <div
            style={{
              background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              animation: 'fadeIn 150ms ease-out',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Invite Link Settings
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="input-label" style={{ fontSize: 11 }}>
                  Expire After
                </label>
                <select
                  className="input-field"
                  style={{ fontSize: 12, height: 36 }}
                  value={expiresInHours ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setExpiresInHours(val === 0 ? undefined : val);
                  }}
                >
                  <option value={0}>Never</option>
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>1 day</option>
                  <option value={168}>7 days</option>
                </select>
              </div>

              <div>
                <label className="input-label" style={{ fontSize: 11 }}>
                  Max Number of Uses
                </label>
                <select
                  className="input-field"
                  style={{ fontSize: 12, height: 36 }}
                  value={maxUses ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMaxUses(val === 0 ? undefined : val);
                  }}
                >
                  <option value={0}>No limit</option>
                  <option value={1}>1 use</option>
                  <option value={5}>5 uses</option>
                  <option value={10}>10 uses</option>
                  <option value={25}>25 uses</option>
                  <option value={50}>50 uses</option>
                  <option value={100}>100 uses</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<RotateCw size={13} />}
                onClick={() => generateLink(expiresInHours, maxUses)}
                disabled={isLoading}
              >
                Generate New Link
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleApplySettings}
                disabled={isLoading}
              >
                Apply
              </Button>
            </div>
          </div>
        )}

        {/* Informational callout */}
        <div
          style={{
            background: 'var(--bg-surface-hover, rgba(255, 255, 255, 0.03))',
            borderRadius: 'var(--radius-sm, 6px)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          }}
        >
          <Users size={18} style={{ color: 'var(--accent, #6366f1)', flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Anyone with this link can join <strong>{activeServer.name}</strong> and begin
            chatting immediately in <strong>#{generalChan?.name || 'general'}</strong>.
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ServerInviteModal;
