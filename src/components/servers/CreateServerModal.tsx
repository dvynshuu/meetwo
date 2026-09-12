import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useServer } from '../../app/providers/ServerContext';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({ isOpen, onClose }) => {
  const { createServer } = useServer();
  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Server name is required');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await createServer(name.trim(), iconUrl.trim() || undefined);
      setName('');
      setIconUrl('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Your Community"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Your server is where you and your friends or team hang out. Make it yours and start talking.
        </p>

        <Input
          label="Server Name"
          placeholder="e.g. Pixel Forge, Audio Guild"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={error}
          autoFocus
          required
        />

        <Input
          label="Server Icon URL (Optional)"
          placeholder="https://example.com/icon.png"
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          helperText="Leave empty for an auto-generated visual identicon."
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            Create Server
          </Button>
        </div>
      </form>
    </Modal>
  );
};
