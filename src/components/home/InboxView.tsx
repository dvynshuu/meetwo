import React, { useState } from 'react';
import { Bell, CheckCheck, Hash, ArrowUpRight, Check, AtSign, CornerDownRight } from 'lucide-react';
import { useInbox } from '../../app/providers/InboxContext';
import { useServer } from '../../app/providers/ServerContext';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { InboxItem } from '../../types';

interface InboxViewProps {
  onNavigateToChannel: (serverId: string, channelId: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({ onNavigateToChannel }) => {
  const { inboxItems, markRead, markAllRead } = useInbox();
  const [filter, setFilter] = useState<'mentions' | 'unreads' | 'all'>('mentions');

  const filteredItems = inboxItems.filter((item) => {
    if (filter === 'mentions') return item.type === 'mention' || item.type === 'reply';
    if (filter === 'unreads') return !item.isRead;
    return true;
  });

  const handleJump = (item: InboxItem) => {
    markRead(item.id);
    onNavigateToChannel(item.serverId, item.channelId);
  };

  return (
    <div className="inbox-view-container">
      {/* Top Bar */}
      <header className="inbox-top-bar">
        <div className="inbox-bar-left">
          <Bell size={20} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Inbox</span>
        </div>

        <div className="inbox-tabs">
          <button
            className={`inbox-tab-btn ${filter === 'mentions' ? 'active' : ''}`}
            onClick={() => setFilter('mentions')}
          >
            Mentions
          </button>
          <button
            className={`inbox-tab-btn ${filter === 'unreads' ? 'active' : ''}`}
            onClick={() => setFilter('unreads')}
          >
            Unreads
          </button>
          <button
            className={`inbox-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Activity
          </button>
        </div>

        <div className="inbox-actions">
          <Tooltip content="Mark all as read">
            <button className="inbox-mark-all-btn" onClick={markAllRead}>
              <CheckCheck size={16} />
              <span>Mark All as Read</span>
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Items Scroll List */}
      <div className="inbox-items-scroll">
        {filteredItems.length > 0 ? (
          <div className="inbox-items-list">
            {filteredItems.map((item) => {
              const dateStr = new Date(item.timestamp).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={item.id}
                  className={`inbox-item-card ${!item.isRead ? 'unread-item' : ''}`}
                  onClick={() => handleJump(item)}
                >
                  <div className="inbox-item-header">
                    <div className="inbox-item-context">
                      <span className="inbox-server-tag">{item.serverName}</span>
                      <span className="inbox-context-divider">›</span>
                      <span className="inbox-channel-tag">
                        <Hash size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                        {item.channelName}
                      </span>
                    </div>
                    <span className="inbox-item-time">{dateStr}</span>
                  </div>

                  <div className="inbox-item-body">
                    <Avatar
                      src={item.authorAvatar}
                      name={item.authorName}
                      size={36}
                      showStatus={false}
                    />
                    <div className="inbox-item-content-wrap">
                      <div className="inbox-item-author-line">
                        <span className="inbox-author-name">{item.authorName}</span>
                        {item.type === 'mention' && (
                          <span className="inbox-type-pill mention">
                            <AtSign size={10} /> Mention
                          </span>
                        )}
                        {item.type === 'reply' && (
                          <span className="inbox-type-pill reply">
                            <CornerDownRight size={10} /> Reply
                          </span>
                        )}
                      </div>
                      <p className="inbox-message-preview">{item.content}</p>
                    </div>

                    <div className="inbox-item-quick-actions" onClick={(e) => e.stopPropagation()}>
                      {!item.isRead && (
                        <Tooltip content="Mark as Read">
                          <button
                            className="icon-btn"
                            onClick={() => markRead(item.id)}
                            aria-label="Mark Read"
                          >
                            <Check size={15} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip content="Jump to Message">
                        <button
                          className="icon-btn"
                          onClick={() => handleJump(item)}
                          aria-label="Jump to Message"
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="inbox-empty-state">
            <CheckCheck size={48} style={{ color: 'var(--accent)', opacity: 0.8 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 16 }}>You are all caught up!</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
              No unread mentions or replies waiting for you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
