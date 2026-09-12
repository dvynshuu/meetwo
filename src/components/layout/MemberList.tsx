import React, { useState } from 'react';
import { useServer } from '../../app/providers/ServerContext';
import { usePresence } from '../../app/providers/PresenceContext';
import { Avatar } from '../ui/Avatar';
import { UserProfilePopover } from '../users/UserProfilePopover';
import { ServerMember } from '../../types';

interface MemberListProps {
  onMentionUser?: (username: string) => void;
}

export const MemberList: React.FC<MemberListProps> = ({ onMentionUser }) => {
  const { members } = useServer();
  const { getUserStatus } = usePresence();
  const [selectedMember, setSelectedMember] = useState<ServerMember | null>(null);

  const membersWithStatus = members.map((m) => ({
    ...m,
    status: getUserStatus(m.userId),
  }));

  const onlineMembers = membersWithStatus.filter((m) => m.status !== 'offline');
  const offlineMembers = membersWithStatus.filter((m) => m.status === 'offline');

  return (
    <aside className="member-sidebar" aria-label="Server members">
      {/* Online Section */}
      <div>
        <div className="member-group-title">
          Online — {onlineMembers.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {onlineMembers.map((m) => (
            <div
              key={m.userId}
              className="member-item"
              onClick={() => setSelectedMember(m)}
              title="Click to view profile"
            >
              <Avatar
                src={m.user?.avatarUrl}
                name={m.user?.displayName || m.user?.username || 'User'}
                size={32}
                status={m.status}
                showStatus={true}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className="member-name truncate">
                  {m.user?.displayName || m.user?.username || 'User'}
                </span>
                {m.role === 'owner' && (
                  <span style={{ fontSize: 10, color: 'var(--accent-light)', fontWeight: 600 }}>
                    Crown / Owner
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offline Section */}
      {offlineMembers.length > 0 && (
        <div>
          <div className="member-group-title">
            Offline — {offlineMembers.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {offlineMembers.map((m) => (
              <div
                key={m.userId}
                className="member-item"
                style={{ opacity: 0.65 }}
                onClick={() => setSelectedMember(m)}
                title="Click to view profile"
              >
                <Avatar
                  src={m.user?.avatarUrl}
                  name={m.user?.displayName || m.user?.username || 'User'}
                  size={32}
                  status="offline"
                  showStatus={true}
                />
                <span className="member-name truncate">
                  {m.user?.displayName || m.user?.username || 'User'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Popover Modal */}
      {selectedMember && selectedMember.user && (
        <UserProfilePopover
          user={selectedMember.user}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onMention={(username) => {
            if (onMentionUser) onMentionUser(username);
          }}
        />
      )}
    </aside>
  );
};
