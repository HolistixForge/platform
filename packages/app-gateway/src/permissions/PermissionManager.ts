import { EPriority, log } from '@monorepo/log';
import { IPersistenceProvider } from '../state/IPersistenceProvider';
import type { TPermissionData } from './types';
import { PermissionManager as AbstractPermissionManager } from '@monorepo/gateway';

/**
 * PermissionManager - Simple Permission Management
 *
 * Responsibilities:
 * - Check if user has permission (exact string match)
 * - Add/remove permissions for users
 * - Initialize permissions from organization config
 * - Provide persistence via IPersistenceProvider interface
 *
 * Permissions are simple strings:
 * - "org:owner", "org:admin", "org:member"
 * - "project:abc-123:admin"
 * - "container:def-456:delete"
 * - "container:create"
 *
 * MVP: Exact string matching only (no hierarchy, no wildcards)
 * Future: Can add hierarchy by updating hasPermission() logic
 */
export class PermissionManager
  extends AbstractPermissionManager
  implements IPersistenceProvider
{
  private data: TPermissionData;

  constructor() {
    super();
    this.data = {
      permissions: {},
    };
  }

  // IPersistenceProvider implementation

  loadFromSerialized(data: Record<string, unknown> | null | undefined): void {
    if (!data) {
      log(EPriority.Info, 'PERMISSIONS', 'No permission data to load');
      return;
    }

    if (data.permissions && typeof data.permissions === 'object') {
      this.data.permissions =
        data.permissions as TPermissionData['permissions'];
      log(EPriority.Info, 'PERMISSIONS', 'Loaded permission data');
    } else {
      log(EPriority.Notice, 'PERMISSIONS', 'Invalid permission data format');
    }
  }

  saveToSerializable(): Record<string, unknown> {
    return {
      permissions: { ...this.data.permissions },
    };
  }

  // Permission management methods

  /**
   * Check if user has exact permission
   * Simple exact-match only (no hierarchy for now)
   */
  override hasPermission(user_id: string, permission: string): boolean {
    const userPermissions = this.data.permissions[user_id];
    if (!userPermissions) {
      return false;
    }
    return userPermissions.includes(permission);
  }

  /**
   * Add permission to user
   */
  override addPermission(user_id: string, permission: string): void {
    if (!this.data.permissions[user_id]) {
      this.data.permissions[user_id] = [];
    }
    if (!this.data.permissions[user_id].includes(permission)) {
      this.data.permissions[user_id].push(permission);
      log(
        EPriority.Debug,
        'PERMISSIONS',
        `Added permission: ${user_id} → ${permission}`
      );
    }
  }

  /**
   * Remove permission from user
   */
  override removePermission(user_id: string, permission: string): void {
    if (this.data.permissions[user_id]) {
      const before = this.data.permissions[user_id].length;
      this.data.permissions[user_id] = this.data.permissions[user_id].filter(
        (p) => p !== permission
      );
      const after = this.data.permissions[user_id].length;
      if (before !== after) {
        log(
          EPriority.Debug,
          'PERMISSIONS',
          `Removed permission: ${user_id} → ${permission}`
        );
      }
    }
  }

  /**
   * Get all permissions for user
   */
  getPermissions(user_id: string): string[] {
    return this.data.permissions[user_id] || [];
  }

  /**
   * Set all permissions for user (replaces existing)
   */
  setPermissions(user_id: string, permissions: string[]): void {
    this.data.permissions[user_id] = permissions;
    log(
      EPriority.Info,
      'PERMISSIONS',
      `Set permissions: ${user_id} → [${permissions.join(', ')}]`
    );
  }

  /**
   * Initialize permissions from organization config
   * Called when gateway starts
   */
  async initializeFromConfig(config: {
    members: Array<{
      user_id: string;
      username: string;
      role: 'owner' | 'admin' | 'member';
    }>;
  }): Promise<void> {
    log(
      EPriority.Info,
      'PERMISSIONS',
      'Initializing permissions from org config'
    );

    // Map organization roles to permission strings
    for (const member of config.members) {
      const orgPermission = `org:${member.role}`;
      this.setPermissions(member.user_id, [orgPermission]);
    }

    log(
      EPriority.Info,
      'PERMISSIONS',
      `Initialized ${config.members.length} org members`
    );
  }

  /**
   * Add project-level permissions for a user
   */
  addProjectPermissions(
    user_id: string,
    project_id: string,
    permissions: string[]
  ): void {
    for (const perm of permissions) {
      this.addPermission(user_id, `project:${project_id}:${perm}`);
    }
  }

  /**
   * Remove all permissions for a user (cleanup)
   */
  removeUser(user_id: string): void {
    delete this.data.permissions[user_id];
    log(
      EPriority.Debug,
      'PERMISSIONS',
      `Removed all permissions for user: ${user_id}`
    );
  }

  /**
   * Get all users with any permissions
   */
  getAllUsers(): string[] {
    return Object.keys(this.data.permissions);
  }

  /**
   * Get all permissions for all users
   * Returns a map of user_id -> permissions array
   */
  getAllPermissions(): { [user_id: string]: string[] } {
    return { ...this.data.permissions };
  }
}
