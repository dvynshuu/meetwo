import React, { useState, useEffect, useRef } from 'react';
import { Search, Hash, Volume2, Video, Server as ServerIcon, Settings, Plus, Mic, Video as VideoIcon, X } from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useMedia } from '../../app/providers/MediaContext';
import { CommandItem } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenCreateServer: () => void;
  onOpenCreateChannel: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenCreateServer,
  onOpenCreateChannel,
}) => {
  const { servers, channels, selectServer, selectChannel } = useServer();
  const { toggleAudio, toggleVideo, joinVoiceRoom } = useMedia();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build searchable items
  const items: CommandItem[] = [];

  // Channels
  channels.forEach((c) => {
    items.push({
      id: `chan-${c.id}`,
      title: c.name,
      category: 'Channels',
      icon: c.type === 'text' ? 'hash' : 'voice',
      action: () => {
        selectChannel(c.id);
        if (c.type === 'voice') joinVoiceRoom(c.id);
        onClose();
      },
    });
  });

  // Servers
  servers.forEach((s) => {
    items.push({
      id: `serv-${s.id}`,
      title: s.name,
      category: 'Servers',
      icon: 'server',
      action: () => {
        selectServer(s.id);
        onClose();
      },
    });
  });

  // Actions
  items.push(
    {
      id: 'act-toggle-mic',
      title: 'Toggle Microphone Mute',
      category: 'Actions',
      icon: 'mic',
      shortcut: 'Ctrl+D',
      action: () => {
        toggleAudio();
        onClose();
      },
    },
    {
      id: 'act-toggle-cam',
      title: 'Toggle Camera',
      category: 'Actions',
      icon: 'camera',
      shortcut: 'Ctrl+E',
      action: () => {
        toggleVideo();
        onClose();
      },
    },
    {
      id: 'act-create-channel',
      title: 'Create Channel in Current Server',
      category: 'Actions',
      icon: 'plus',
      action: () => {
        onClose();
        onOpenCreateChannel();
      },
    },
    {
      id: 'act-create-server',
      title: 'Create New Server',
      category: 'Actions',
      icon: 'plus',
      action: () => {
        onClose();
        onOpenCreateServer();
      },
    },
    {
      id: 'act-settings',
      title: 'Open Settings',
      category: 'Settings',
      icon: 'settings',
      action: () => {
        onClose();
        onOpenSettings();
      },
    }
  );

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="command-palette-header">
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search channels, servers, or type a command..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span className="command-palette-esc">ESC</span>
        </div>

        {/* Results List */}
        <div className="command-palette-list">
          {filteredItems.length === 0 ? (
            <div className="command-empty-state">
              No results found for "{query}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`command-palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.icon === 'hash' && <Hash size={16} style={{ color: 'var(--text-muted)' }} />}
                    {item.icon === 'voice' && <Volume2 size={16} style={{ color: 'var(--status-online)' }} />}
                    {item.icon === 'server' && <ServerIcon size={16} style={{ color: 'var(--accent-light)' }} />}
                    {item.icon === 'mic' && <Mic size={16} style={{ color: 'var(--text-muted)' }} />}
                    {item.icon === 'camera' && <VideoIcon size={16} style={{ color: 'var(--text-muted)' }} />}
                    {item.icon === 'plus' && <Plus size={16} style={{ color: 'var(--status-online)' }} />}
                    {item.icon === 'settings' && <Settings size={16} style={{ color: 'var(--text-muted)' }} />}

                    <span style={{ fontSize: 14, fontWeight: 500 }}>{item.title}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.shortcut && (
                      <span className="command-item-shortcut">{item.shortcut}</span>
                    )}
                    <span className="command-item-category">{item.category}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
