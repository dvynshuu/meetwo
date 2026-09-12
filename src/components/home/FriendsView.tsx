import React, { useState } from 'react';
import { Users, UserCheck, Clock, UserPlus, MessageSquare, MoreVertical, Check, X, Search } from 'lucide-react';
import { useDM } from '../../app/providers/DMContext';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { User, Friend } from '../../types';

interface FriendsViewProps {
  onOpenDM: (conversationId: string) => void;
}

type FriendFilter = 'online' | 'all' | 'pending' | 'add';

export const FriendsView: React.FC<FriendsViewProps> = ({ onOpenDM }) => {
  const { friends, addFriend, acceptFriendRequest, removeFriend, startConversationWithUser } = useDM();
  const [filter, setFilter] = useState<FriendFilter>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const onlineFriends = friends.filter((f) => f.status === 'accepted' && f.user.status !== 'offline');
  const allFriends = friends.filter((f) => f.status === 'accepted');
  const pendingFriends = friends.filter((f) => f.status === 'pending_received' || f.status === 'pending_sent');

  const handleAddFriendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddSuccess(null);
    setAddError(null);

    if (!addFriendInput.trim()) return;
    const ok = addFriend(addFriendInput);
    if (ok) {
      setAddSuccess(`Added @${addFriendInput} to your friends!`);
      setAddFriendInput('');
    } else {
      setAddError(`Please enter a valid username.`);
    }
  };

  const handleMessageFriend = (user: User) => {
    const convoId = startConversationWithUser(user);
    onOpenDM(convoId);
  };

  const displayedFriends = (
    filter === 'online' ? onlineFriends : filter === 'all' ? allFriends : pendingFriends
  ).filter((f) => {
    const query = searchQuery.toLowerCase();
    return (
      f.user.displayName.toLowerCase().includes(query) ||
      f.user.username.toLowerCase().includes(query)
    );
  });

  return (
    <div className="friends-view-container">
      {/* Top Filter Bar */}
      <header className="friends-top-bar">
        <div className="friends-bar-header">
          <Users size={20} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Friends</span>
        </div>

        <div className="friends-divider-vertical" />

        <div className="friends-tabs">
          <button
            className={`friends-tab-btn ${filter === 'online' ? 'active' : ''}`}
            onClick={() => setFilter('online')}
          >
            Online <span className="tab-count">{onlineFriends.length}</span>
          </button>

          <button
            className={`friends-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span className="tab-count">{allFriends.length}</span>
          </button>

          <button
            className={`friends-tab-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending{' '}
            {pendingFriends.length > 0 && (
              <span className="unread-badge-pill" style={{ marginLeft: 4 }}>
                {pendingFriends.length}
              </span>
            )}
          </button>

          <button
            className={`friends-tab-btn add-friend-tab ${filter === 'add' ? 'active' : ''}`}
            onClick={() => setFilter('add')}
          >
            Add Friend
          </button>
        </div>
      </header>

      {/* View Body */}
      <div className="friends-body-layout">
        <div className="friends-main-pane">
          {filter === 'add' ? (
            <div className="add-friend-section">
              <h2 className="add-friend-title">ADD FRIEND</h2>
              <p className="add-friend-desc">
                You can add friends with their Meetwo username.
              </p>
              <form onSubmit={handleAddFriendSubmit} className="add-friend-form">
                <div className="add-friend-input-wrap">
                  <input
                    type="text"
                    className="add-friend-input"
                    placeholder="Enter a username (e.g. sarah, david)"
                    value={addFriendInput}
                    onChange={(e) => setAddFriendInput(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="add-friend-submit-btn"
                    disabled={!addFriendInput.trim()}
                  >
                    Send Friend Request
                  </button>
                </div>
              </form>

              {addSuccess && <div className="add-friend-success">{addSuccess}</div>}
              {addError && <div className="add-friend-error">{addError}</div>}
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="friends-search-row">
                <div className="friends-search-wrap">
                  <Search size={15} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="friends-search-input"
                    placeholder="Search friends"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Friends Count Label */}
              <div className="friends-count-label">
                {filter === 'online'
                  ? `ONLINE — ${displayedFriends.length}`
                  : filter === 'all'
                  ? `ALL FRIENDS — ${displayedFriends.length}`
                  : `PENDING REQUESTS — ${displayedFriends.length}`}
              </div>

              {/* Friends List */}
              <div className="friends-list">
                {displayedFriends.length > 0 ? (
                  displayedFriends.map((friend) => {
                    const isPendingReceived = friend.status === 'pending_received';
                    const isPendingSent = friend.status === 'pending_sent';

                    return (
                      <div key={friend.id} className="friend-row-card">
                        <div className="friend-row-left">
                          <Avatar
                            src={friend.user.avatarUrl}
                            name={friend.user.displayName || friend.user.username}
                            size={40}
                            status={friend.user.status}
                            showStatus={true}
                          />
                          <div className="friend-row-info">
                            <div className="friend-name-line">
                              <span className="friend-display-name">
                                {friend.user.displayName || friend.user.username}
                              </span>
                              <span className="friend-username">@{friend.user.username}</span>
                            </div>
                            <span className="friend-subtext">
                              {friend.user.customStatus?.text ? (
                                <>
                                  {friend.user.customStatus.emoji}{' '}
                                  {friend.user.customStatus.text}
                                </>
                              ) : isPendingReceived ? (
                                'Incoming Friend Request'
                              ) : isPendingSent ? (
                                'Outgoing Friend Request'
                              ) : (
                                friend.user.status === 'online'
                                  ? 'Active now'
                                  : friend.user.status === 'idle'
                                  ? 'Away'
                                  : friend.user.status === 'dnd'
                                  ? 'Do Not Disturb'
                                  : 'Offline'
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="friend-row-actions">
                          {isPendingReceived ? (
                            <>
                              <Tooltip content="Accept Request">
                                <button
                                  className="friend-action-btn accept-btn"
                                  onClick={() => acceptFriendRequest(friend.id)}
                                >
                                  <Check size={16} />
                                </button>
                              </Tooltip>
                              <Tooltip content="Decline Request">
                                <button
                                  className="friend-action-btn decline-btn"
                                  onClick={() => removeFriend(friend.id)}
                                >
                                  <X size={16} />
                                </button>
                              </Tooltip>
                            </>
                          ) : isPendingSent ? (
                            <Tooltip content="Cancel Request">
                              <button
                                className="friend-action-btn cancel-btn"
                                onClick={() => removeFriend(friend.id)}
                              >
                                <X size={16} />
                              </button>
                            </Tooltip>
                          ) : (
                            <>
                              <Tooltip content="Direct Message">
                                <button
                                  className="friend-action-btn"
                                  onClick={() => handleMessageFriend(friend.user)}
                                >
                                  <MessageSquare size={16} />
                                </button>
                              </Tooltip>
                              <Tooltip content="Remove Friend">
                                <button
                                  className="friend-action-btn decline-btn"
                                  onClick={() => removeFriend(friend.id)}
                                >
                                  <X size={16} />
                                </button>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="friends-empty-box">
                    <p>No friends found in this view.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Active Now Sidebar */}
        <aside className="friends-activity-sidebar">
          <h3 className="activity-sidebar-title">Active Now</h3>
          <div className="activity-cards-list">
            {onlineFriends.map((f) => (
              <div key={f.id} className="activity-friend-card">
                <Avatar
                  src={f.user.avatarUrl}
                  name={f.user.displayName || f.user.username}
                  size={32}
                  status={f.user.status}
                  showStatus={true}
                />
                <div className="activity-card-info truncate">
                  <span className="activity-card-name truncate">{f.user.displayName}</span>
                  <span className="activity-card-desc truncate">
                    {f.user.customStatus?.text || 'Exploring Meetwo channels'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
