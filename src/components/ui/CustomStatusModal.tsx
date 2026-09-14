import React, { useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../../app/providers/AuthContext';
import { Smile, Clock, X, Check } from 'lucide-react';

interface CustomStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomStatusModal: React.FC<CustomStatusModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile } = useAuth();
  const [text, setText] = useState(currentUser?.customStatus?.text || '');
  const [emoji, setEmoji] = useState(currentUser?.customStatus?.emoji || '💬');
  const [duration, setDuration] = useState<'never' | '30m' | '1h' | '4h' | 'today'>('never');

  const popularEmojis = ['💻', '🚀', '🎧', '⚡', '☕', '🌴', '📚', '🎯', '✨', '🔥'];

  const handleSave = () => {
    if (!text.trim()) {
      updateProfile({ customStatus: undefined });
      onClose();
      return;
    }

    let expiresAt: string | undefined = undefined;
    const now = Date.now();
    if (duration === '30m') {
      expiresAt = new Date(now + 30 * 60000).toISOString();
    } else if (duration === '1h') {
      expiresAt = new Date(now + 60 * 60000).toISOString();
    } else if (duration === '4h') {
      expiresAt = new Date(now + 4 * 3600000).toISOString();
    } else if (duration === 'today') {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      expiresAt = endOfDay.toISOString();
    }

    updateProfile({
      customStatus: {
        text: text.trim(),
        emoji,
        expiresAt,
      },
    });
    onClose();
  };

  const handleClear = () => {
    updateProfile({ customStatus: undefined });
    setText('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set a Custom Status" maxWidth="480px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Status Input with Emoji Trigger */}
        <div className="input-group">
          <label className="input-label">What's on your mind?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Emoji selector display */}
            <div
              style={{
                width: 44,
                height: 40,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-active)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                cursor: 'pointer',
                border: '1px solid var(--border-subtle)',
              }}
              title="Change status emoji"
            >
              {emoji}
            </div>

            <input
              type="text"
              className="input-field"
              placeholder="e.g. Shipping V3 features, In a meeting, AFK"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              style={{ flex: 1 }}
            />

            {text && (
              <button
                className="icon-btn"
                onClick={() => setText('')}
                title="Clear text"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Emoji Quick Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quick icons:</span>
          {popularEmojis.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              style={{
                background: emoji === e ? 'var(--accent-subtle)' : 'transparent',
                border: emoji === e ? '1px solid var(--accent)' : 'none',
                borderRadius: 'var(--radius-xs)',
                padding: '3px 6px',
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Clear After selection */}
        <div className="input-group">
          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} />
            <span>Clear after</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {[
              { id: 'never', label: 'Don\'t clear' },
              { id: '30m', label: '30 mins' },
              { id: '1h', label: '1 hour' },
              { id: '4h', label: '4 hours' },
              { id: 'today', label: 'Today' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`btn ${duration === opt.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 4px', fontSize: 11, justifyContent: 'center' }}
                onClick={() => setDuration(opt.id as any)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          {currentUser?.customStatus ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: 'var(--danger)' }}
              onClick={handleClear}
            >
              Clear Status
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Save Status
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
