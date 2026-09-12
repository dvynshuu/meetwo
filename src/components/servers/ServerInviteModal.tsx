import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useServer } from '../../app/providers/ServerContext';
import { mockStore } from '../../lib/supabase/mockStore';
import { Copy, Check, Link2, Users } from 'lucide-react';

interface ServerInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServerInviteModal: React.FC<ServerInviteModalProps> = ({ isOpen, onClose }) => {
  const { activeServer } = useServer();
  const [copied, setCopied] = useState(false);
  const [inviteCode] = useState(() => Math.random().toString(36).substring(2, 8).toUpperCase());

  if (!isOpen || !activeServer) return null;

  const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Invite Friends to ${activeServer.name}`}
      maxWidth="460px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Share this link with others to grant them instant access to <strong>{activeServer.name}</strong>.
        </p>

        <div className="input-group">
          <label className="input-label">Server Invite Link</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="input-field"
              value={inviteUrl}
              readOnly
              style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
            />
            <Button
              type="button"
              variant="primary"
              icon={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            This link is set to never expire and allows unlimited uses.
          </span>
        </div>

        <div
          style={{
            background: 'var(--bg-surface-hover)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Users size={20} style={{ color: 'var(--accent-light)' }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Joined members will automatically land in the <strong>#general</strong> channel.
          </div>
        </div>
      </div>
    </Modal>
  );
};
