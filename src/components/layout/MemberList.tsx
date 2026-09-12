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

  const roleWeights: Record<string, number> = {
    owner: 0,
    admin: 1,
    moderator: 2,
    member: 3,
  };

  const membersWithStatus = members.map((m) => ({
    ...m,
    status: getUserStatus(m.userId),
  }));

  const onlineMembers = membersWithStatus
    .filter((m) => m.status !== 'offline')
    .sort((a, b) => (roleWeights[a.role] ?? 4) - (roleWeights[b.role] ?? 4));

  const offlineMembers = membersWithStatus.filter((m) => m.status === 'offline');

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <span className="member-role-chip member-role-owner">Owner</span>;
      case 'admin':
        return <span className="member-role-chip member-role-admin">Admin</span>;
      case 'moderator':
        return <span className="member-role-chip member-role-moderator">Mod</span>;
      default:
        return null;
    }
  };

  return (
    <aside className="member-sidebar" aria-label="Members">
      {/* Online Section */}
      <div>
        <div className="member-group-title">
          Online — {onlineMembers.length}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {onlineMembers.map((m) => (
            <div
              key={m.userId}
              className="member-item"
              onClick={() => setSelectedMember(m)}
              title="View profile"
            >
              <Avatar
                src={m.user?.avatarUrl}
                name={m.user?.displayName || m.user?.username || 'User'}
                size={28}
                status={m.status}
                showStatus={true}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                <span className="member-name truncate">
                  {m.user?.displayName || m.user?.username || 'User'}
                </span>
                {renderRoleBadge(m.role)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {offlineMembers.map((m) => (
              <div
                key={m.userId}
                className="member-item offline"
                onClick={() => setSelectedMember(m)}
                title="View profile"
              >
                <Avatar
                  src={m.user?.avatarUrl}
                  name={m.user?.displayName || m.user?.username || 'User'}
                  size={28}
                  status="offline"
                  showStatus={true}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
                  <span className="member-name truncate">
                    {m.user?.displayName || m.user?.username || 'User'}
                  </span>
                  {renderRoleBadge(m.role)}
                </div>
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
