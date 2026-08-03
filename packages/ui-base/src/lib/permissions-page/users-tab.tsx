import { useState, useMemo } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { UserRoleEditor, Role } from './user-role-editor';

export interface OrgMember {
  user_id: string;
  username: string;
  email: string;
  added_at: string;
}

export interface UserRoleAssignment {
  user_id: string;
  org_roles: Role[];
  project_roles: { [project_id: string]: Role[] };
}

export interface UsersTabProps {
  members: OrgMember[];
  membersLoading: boolean;
  roles: Role[];
  rolesLoading: boolean;
  getUserRoles: (user_id: string) => Role[];
  readonly?: boolean;
  onAssignRole: (
    user_id: string,
    role_id: string,
    scope: 'org' | 'project',
    project_id?: string
  ) => Promise<void>;
  onRemoveRole: (
    user_id: string,
    role_id: string,
    project_id?: string
  ) => Promise<void>;
}

const UserListItem = ({
  member,
  roles,
  isSelected,
  onClick,
}: {
  member: OrgMember;
  roles: Role[];
  isSelected: boolean;
  onClick: () => void;
}) => {
  return (
    <div
      className={`user-list-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="user-info">
        <div className="avatar">{member.username[0]?.toUpperCase() || '?'}</div>
        <div className="details">
          <div className="username">{member.username}</div>
          <div className="email">{member.email}</div>
        </div>
      </div>
      <div className="roles-preview">
        {roles.length === 0 ? (
          <span className="no-roles">(no roles)</span>
        ) : (
          <span className="role-count">
            {roles.length} role{roles.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};

export const UsersTab = ({
  members,
  membersLoading,
  roles,
  rolesLoading,
  getUserRoles,
  readonly = false,
  onAssignRole,
  onRemoveRole,
}: UsersTabProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.username.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const selectedMember = selectedUserId
    ? members.find((m) => m.user_id === selectedUserId)
    : null;

  const currentRoles = selectedUserId ? getUserRoles(selectedUserId) : [];

  const handleAssignRole = async (
    role_id: string,
    scope: 'org' | 'project',
    project_id?: string
  ) => {
    if (!selectedUserId) return;
    await onAssignRole(selectedUserId, role_id, scope, project_id);
  };

  const handleRemoveRole = async (role_id: string, project_id?: string) => {
    if (!selectedUserId) return;
    await onRemoveRole(selectedUserId, role_id, project_id);
  };

  if (membersLoading || rolesLoading) {
    return (
      <div className="users-tab loading">
        <p>Loading organization members...</p>
      </div>
    );
  }

  return (
    <div className="users-tab">
      <div className="panel-users">
        <header>
          <h3>Organization Members</h3>
          <p className="member-count">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </header>

        <div className="search-box">
          <MagnifyingGlassIcon className="search-icon" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <ScrollArea.Root className="scroll-area-root">
          <ScrollArea.Viewport className="scroll-area-viewport">
            <div className="user-list">
              {filteredMembers.length === 0 ? (
                <p className="empty-state">
                  {searchQuery
                    ? 'No members match your search.'
                    : 'No members in organization.'}
                </p>
              ) : (
                filteredMembers.map((member) => (
                  <UserListItem
                    key={member.user_id}
                    member={member}
                    roles={getUserRoles(member.user_id)}
                    isSelected={selectedUserId === member.user_id}
                    onClick={() => setSelectedUserId(member.user_id)}
                  />
                ))
              )}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            className="scroll-area-scrollbar"
            orientation="vertical"
          >
            <ScrollArea.Thumb className="scroll-area-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>

      <div className="panel-editor">
        {selectedMember ? (
          <UserRoleEditor
            user_id={selectedMember.user_id}
            username={selectedMember.username}
            currentRoles={currentRoles}
            availableRoles={roles}
            loading={false}
            readonly={readonly}
            onAssignRole={handleAssignRole}
            onRemoveRole={handleRemoveRole}
          />
        ) : (
          <div className="empty-selection">
            <p>Select a user to manage their roles</p>
          </div>
        )}
      </div>
    </div>
  );
};
