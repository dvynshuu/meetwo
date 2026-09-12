import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useServer } from '../../app/providers/ServerContext';
import { Hash, Volume2, Radio, MessagesSquare, Megaphone } from 'lucide-react';
import { ChannelType } from '../../types';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategoryId?: string;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  defaultCategoryId,
}) => {
  const { activeServer, createChannel } = useServer();
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('text');
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const channelTypes: { type: ChannelType; label: string; desc: string; icon: any; color: string }[] = [
    {
      type: 'text',
      label: 'Text Channel',
      desc: 'Post messages, code, images, and stickers',
      icon: Hash,
      color: 'var(--accent)',
    },
    {
      type: 'voice',
      label: 'Voice & Video',
      desc: 'Hang out with realtime voice, camera & screen sharing',
      icon: Volume2,
      color: 'var(--accent)',
    },
    {
      type: 'stage',
      label: 'Stage Broadcast',
      desc: 'Host events with designated speakers and audience listeners',
      icon: Radio,
      color: 'var(--coral)',
    },
    {
      type: 'forum',
      label: 'Forum / Topics',
      desc: 'Organized topic threads with upvotes and discussion cards',
      icon: MessagesSquare,
      color: 'var(--sky)',
    },
    {
      type: 'announcement',
      label: 'Announcement',
      desc: 'Important server updates with broadcast badges',
      icon: Megaphone,
      color: 'var(--warning)',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel name is required');
      return;
    }
    if (!activeServer) return;

    setIsLoading(true);
    setError('');
    try {
      await createChannel(activeServer.id, name.trim(), type, topic.trim(), defaultCategoryId);
      setName('');
      setTopic('');
      setType('text');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create channel');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Channel" maxWidth="520px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Channel Type Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="input-label">Channel Type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {channelTypes.map((t) => {
              const Icon = t.icon;
              const isSelected = type === t.type;
              return (
                <div
                  key={t.type}
                  onClick={() => setType(t.type)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-active)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: t.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.desc}</div>
                  </div>
                  <input
                    type="radio"
                    name="channelType"
                    checked={isSelected}
                    onChange={() => setType(t.type)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Input
          label="Channel Name"
          placeholder={type === 'text' ? 'new-channel' : type === 'stage' ? 'Town Hall Stage' : 'Discussion Topic'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
          required
        />

        <Input
          label="Topic / Purpose (Optional)"
          placeholder="e.g. Official announcements, weekly standups, discussion"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            Create Channel
          </Button>
        </div>
      </form>
    </Modal>
  );
};
