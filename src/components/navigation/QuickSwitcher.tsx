import React, { useState, useEffect, useRef } from 'react';
import { Search, Hash, Volume2, Radio, Server as ServerIcon, User as UserIcon, MessageSquare, Clock, ArrowRight } from 'lucide-react';
import { useServer } from '../../app/providers/ServerContext';
import { useNavigation } from '../../app/providers/NavigationContext';
import { useDM } from '../../app/providers/DMContext';
import { useMedia } from '../../app/providers/MediaContext';
import { NavigationEntry } from '../../types';

interface QuickSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDM: (conversationId: string) => void;
  onNavigateToServerChannel: (serverId: string, channelId: string) => void;
}

interface SwitcherItem {
  id: string;
  type: 'channel' | 'dm' | 'server';
  title: string;
  subtitle: string;
  badge?: string;
  icon: 'hash' | 'voice' | 'stage' | 'dm' | 'server';
  action: () => void;
  navigationEntry: NavigationEntry;
}

export const QuickSwitcher: React.FC<QuickSwitcherProps> = ({
  isOpen,
  onClose,
  onNavigateToDM,
  onNavigateToServerChannel,
}) => {
  const { servers, channels, selectServer, selectChannel } = useServer();
  const { recentDestinations, pushNavigation } = useNavigation();
  const { conversations, friends, startConversationWithUser } = useDM();
  const { openPreJoin } = useMedia();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  // Build all searchable switcher items
  const allItems: SwitcherItem[] = [];

  // Channels
  channels.forEach((c) => {
    const server = servers.find((s) => s.id === c.serverId);
    const serverName = server?.name || 'Workspace';
    const isVoice = c.type === 'voice';
    const isStage = c.type === 'stage';

    allItems.push({
      id: `chan-${c.id}`,
      type: 'channel',
      title: c.name,
      subtitle: `${serverName} • ${c.topic || (isStage ? 'Live Stage' : isVoice ? 'Voice Room' : 'Text Channel')}`,
      badge: isStage ? 'STAGE' : isVoice ? 'VOICE' : undefined,
      icon: isStage ? 'stage' : isVoice ? 'voice' : 'hash',
      navigationEntry: {
        id: c.id,
        type: 'channel',
        name: c.name,
        serverId: c.serverId,
        channelId: c.id,
      },
      action: () => {
        pushNavigation({
          id: c.id,
          type: 'channel',
          name: c.name,
          serverId: c.serverId,
          channelId: c.id,
        });
        onNavigateToServerChannel(c.serverId, c.id);
        if (isVoice) openPreJoin(c.id);
        onClose();
      },
    });
  });

  // Direct Messages & Friends
  conversations.forEach((convo) => {
    const participant = convo.participants[0] || convo.participants[1];
    const name = participant?.displayName || participant?.username || 'User';
    allItems.push({
      id: `dm-${convo.id}`,
      type: 'dm',
      title: name,
      subtitle: convo.lastMessage?.content || 'Direct Message',
      icon: 'dm',
      navigationEntry: {
        id: convo.id,
        type: 'dm',
        name,
        conversationId: convo.id,
      },
      action: () => {
        pushNavigation({
          id: convo.id,
          type: 'dm',
          name,
          conversationId: convo.id,
        });
        onNavigateToDM(convo.id);
        onClose();
      },
    });
  });

  // Friends not yet in recent conversations
  friends.forEach((f) => {
    if (!allItems.some((item) => item.title.toLowerCase() === f.user.displayName.toLowerCase())) {
      allItems.push({
        id: `friend-${f.id}`,
        type: 'dm',
        title: f.user.displayName || f.user.username,
        subtitle: `@${f.user.username} • Friend`,
        icon: 'dm',
        navigationEntry: {
          id: f.user.id,
          type: 'dm',
          name: f.user.displayName,
        },
        action: () => {
          const convoId = startConversationWithUser(f.user);
          pushNavigation({
            id: convoId,
            type: 'dm',
            name: f.user.displayName,
            conversationId: convoId,
          });
          onNavigateToDM(convoId);
          onClose();
        },
      });
    }
  });

  // Servers
  servers.forEach((s) => {
    allItems.push({
      id: `serv-${s.id}`,
      type: 'server',
      title: s.name,
      subtitle: s.description || 'Workspace',
      icon: 'server',
      navigationEntry: {
        id: s.id,
        type: 'server',
        name: s.name,
        serverId: s.id,
      },
      action: () => {
        pushNavigation({
          id: s.id,
          type: 'server',
          name: s.name,
          serverId: s.id,
        });
        selectServer(s.id);
        onClose();
      },
    });
  });

  // Filter based on query or prefix
  let filteredItems: SwitcherItem[] = [];
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    // Show recents first if available
    const recentsMapped = recentDestinations
      .map((rd) => allItems.find((item) => item.navigationEntry.id === rd.id))
      .filter((item): item is SwitcherItem => Boolean(item));

    filteredItems = recentsMapped.length > 0 ? recentsMapped : allItems.slice(0, 10);
  } else if (cleanQuery.startsWith('#')) {
    const term = cleanQuery.slice(1).trim();
    filteredItems = allItems.filter(
      (item) => item.type === 'channel' && item.title.toLowerCase().includes(term)
    );
  } else if (cleanQuery.startsWith('@')) {
    const term = cleanQuery.slice(1).trim();
    filteredItems = allItems.filter(
      (item) => item.type === 'dm' && item.title.toLowerCase().includes(term)
    );
  } else {
    filteredItems = allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(cleanQuery) ||
        item.subtitle.toLowerCase().includes(cleanQuery)
    );
  }

  // Keyboard navigation
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

  const renderIcon = (icon: SwitcherItem['icon']) => {
    switch (icon) {
      case 'voice':
        return <Volume2 size={16} />;
      case 'stage':
        return <Radio size={16} />;
      case 'dm':
        return <MessageSquare size={16} />;
      case 'server':
        return <ServerIcon size={16} />;
      case 'hash':
      default:
        return <Hash size={16} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay quick-switcher-backdrop" onClick={onClose}>
      <div
        className="quick-switcher-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="quick-switcher-search-bar">
          <Search size={18} style={{ color: 'var(--accent)' }} />
          <input
            ref={inputRef}
            type="text"
            className="quick-switcher-input"
            placeholder="Where would you like to go? (Try #channels or @users)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span className="quick-switcher-esc-badge" onClick={onClose}>
            ESC
          </span>
        </div>

        <div className="quick-switcher-list" ref={listRef}>
          {!query && recentDestinations.length > 0 && (
            <div className="quick-switcher-section-title">
              <Clock size={12} /> RECENT DESTINATIONS
            </div>
          )}

          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`quick-switcher-row ${isSelected ? 'selected' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="quick-switcher-icon-wrap">
                    {renderIcon(item.icon)}
                  </div>
                  <div className="quick-switcher-info truncate">
                    <span className="quick-switcher-title truncate">{item.title}</span>
                    <span className="quick-switcher-subtitle truncate">{item.subtitle}</span>
                  </div>

                  {item.badge && <span className="channel-badge channel-badge-stage">{item.badge}</span>}

                  <ArrowRight size={14} className="quick-switcher-arrow" />
                </div>
              );
            })
          ) : (
            <div className="quick-switcher-empty">
              No results found for "{query}". Try searching with <code>#channel</code> or <code>@user</code>.
            </div>
          )}
        </div>

        <footer className="quick-switcher-footer">
          <div className="footer-tip">
            <span>Navigate</span> <kbd>↑</kbd> <kbd>↓</kbd>
            <span>Select</span> <kbd>↵</kbd>
            <span>Close</span> <kbd>esc</kbd>
          </div>
          <div className="footer-tip">
            <span>Filter</span> <kbd>#</kbd> channels <kbd>@</kbd> users
          </div>
        </footer>
      </div>
    </div>
  );
};
