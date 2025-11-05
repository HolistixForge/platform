import { log } from '@monorepo/log';
import { GatewayState } from '../state/GatewayState';

/**
 * PermissionManager - Simple Permission Management
 * 
 * Responsibilities:
 * - Check if user has permission (exact string match)
 * - Add/remove permissions for users
 * - Initialize permissions from organization config
 * 
 * Uses GatewayState for persistence.
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
export class PermissionManager {
  constructor(private gatewayState: GatewayState) {}

  /**
   * Check if user has exact permission
   * Simple exact-match only (no hierarchy for now)
   */
  hasPermission(user_id: string, permission: string): boolean {
    const userPermissions = this.gatewayState.getData().permissions[user_id];
    if (!userPermissions) {
      return false;
    }
    return userPermissions.includes(permission);
  }

  /**
   * Add permission to user
   */
  addPermission(user_id: string, permission: string): void {
    this.gatewayState.updateData((data) => {
      if (!data.permissions[user_id]) {
        data.permissions[user_id] = [];
      }
      if (!data.permissions[user_id].includes(permission)) {
        data.permissions[user_id].push(permission);
        log(7, 'PERMISSIONS', `Added permission: ${user_id} → ${permission}`);
      }
    });
  }

  /**
   * Remove permission from user
   */
  removePermission(user_id: string, permission: string): void {
    this.gatewayState.updateData((data) => {
      if (data.permissions[user_id]) {
        const before = data.permissions[user_id].length;
        data.permissions[user_id] = data.permissions[user_id].filter(
          (p) => p !== permission
        );
        const after = data.permissions[user_id].length;
        if (before !== after) {
          log(7, 'PERMISSIONS', `Removed permission: ${user_id} → ${permission}`);
        }
      }
    });
  }

  /**
   * Get all permissions for user
   */
  getPermissions(user_id: string): string[] {
    return this.gatewayState.getData().permissions[user_id] || [];
  }

  /**
   * Set all permissions for user (replaces existing)
   */
  setPermissions(user_id: string, permissions: string[]): void {
    this.gatewayState.updateData((data) => {
      data.permissions[user_id] = permissions;
      log(7, 'PERMISSIONS', `Set permissions: ${user_id} → [${permissions.join(', ')}]`);
    });
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
    log(6, 'PERMISSIONS', 'Initializing permissions from org config');

    // Map organization roles to permission strings
    for (const member of config.members) {
      const orgPermission = `org:${member.role}`;
      this.setPermissions(member.user_id, [orgPermission]);
    }

    log(6, 'PERMISSIONS', `Initialized ${config.members.length} org members`);
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
    this.gatewayState.updateData((data) => {
      delete data.permissions[user_id];
      log(7, 'PERMISSIONS', `Removed all permissions for user: ${user_id}`);
    });
  }

  /**
   * Get all users with any permissions
   */
  getAllUsers(): string[] {
    return Object.keys(this.gatewayState.getData().permissions);
  }
}

