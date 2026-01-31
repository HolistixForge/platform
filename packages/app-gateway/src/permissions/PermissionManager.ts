import { EPriority, log } from '@holistix-forge/log';
import { IPersistenceProvider } from '../state/IPersistenceProvider';
import { PermissionManager as AbstractPermissionManager } from '@holistix-forge/gateway';
import { UserRoleManager } from './UserRoleManager';

/**
 * PermissionManager - Role-Based Permission Checking
 *
 * Responsibilities:
 * - Check if user has permission (via role resolution with wildcard matching)
 * - Resolve permissions from user's roles (org + project)
 * - Support wildcard patterns in permissions
 *
 * Permission resolution strategy:
 * 1. Get user's roles (org-level + project-specific)
 * 2. Expand roles to get all permissions
 * 3. Check if any permission matches (with wildcard support)
 * 4. Special case: org:owner always has access (wildcard "*")
 *
 * Wildcard matching examples:
 * - "*" matches everything (universal wildcard)
 * - "project:*:admin" matches "project:abc:admin" and "project:xyz:admin"
 * - "container:*" matches "container:abc123"
 *
 * NOTE: This manager no longer stores permissions directly.
 * All permissions are resolved dynamically from roles (stored in UserRoleManager).
 * Implements IPersistenceProvider but has nothing to persist.
 */
export class PermissionManager
  extends AbstractPermissionManager
  implements IPersistenceProvider
{
  private userRoleManager: UserRoleManager | null = null;

  constructor() {
    super();
  }

  /**
   * Set UserRoleManager reference
   * Called during gateway initialization after UserRoleManager is created
   */
  setUserRoleManager(userRoleManager: UserRoleManager): void {
    this.userRoleManager = userRoleManager;
  }

  // ============================================================================
  // Permission Checking (Main API)
  // ============================================================================

  /**
   * Check if user has permission
   * 
   * Resolves permissions via user's roles with wildcard matching.
   * 
   * @param user_id - User ID
   * @param permission - Permission to check (e.g., "project:abc:admin")
   * @param project_id - Optional project ID (includes project-specific roles)
   * @returns true if user has permission, false otherwise
   */
  override hasPermission(
    user_id: string,
    permission: string,
    project_id?: string
  ): boolean {
    if (!this.userRoleManager) {
      log(
        EPriority.Warning,
        'PERMISSIONS',
        'UserRoleManager not initialized, denying permission'
      );
      return false;
    }

    // Get all user roles (org + project if specified)
    const roles = this.userRoleManager.getAllUserRoles(user_id, project_id);

    if (roles.length === 0) {
      return false; // No roles = no permissions
    }

    // Special case: org:owner has universal access
    if (roles.some((role) => role.role_name === 'org:owner')) {
      return true;
    }

    // Get all permissions from all roles
    const rolePermissions = roles.flatMap((role) => role.permissions);

    // Check if any role permission matches (with wildcard matching)
    return rolePermissions.some((rolePermission) =>
      this.matchPermission(rolePermission, permission)
    );
  }

  // ============================================================================
  // Wildcard Matching
  // ============================================================================

  /**
   * Match permission pattern against actual permission
   * 
   * Supports wildcards:
   * - "*" = matches everything
   * - "project:*:admin" matches "project:abc:admin"
   * - "container:*" matches "container:abc123"
   * 
   * @param pattern - Permission pattern (may contain wildcards)
   * @param permission - Actual permission to check
   * @returns true if pattern matches permission
   */
  private matchPermission(pattern: string, permission: string): boolean {
    // Universal wildcard
    if (pattern === '*') {
      return true;
    }

    // Exact match
    if (pattern === permission) {
      return true;
    }

    // Split by colon to match parts
    const patternParts = pattern.split(':');
    const permissionParts = permission.split(':');

    // Must have same number of parts
    if (patternParts.length !== permissionParts.length) {
      return false;
    }

    // Check each part (supporting wildcards)
    return patternParts.every((patternPart, i) => {
      // Wildcard in this position
      if (patternPart === '*') {
        return true;
      }

      // Exact match for this part
      return patternPart === permissionParts[i];
    });
  }

  // ============================================================================
  // Legacy Methods (for compatibility with existing code)
  // ============================================================================

  /**
   * @deprecated Use role-based permission management instead
   * This method is kept for backward compatibility but does nothing.
   */
  override addPermission(user_id: string, permission: string): void {
    log(
      EPriority.Warning,
      'PERMISSIONS',
      `addPermission is deprecated. Use UserRoleManager.assignRole() instead. Ignoring: ${user_id} → ${permission}`
    );
  }

  /**
   * @deprecated Use role-based permission management instead
   * This method is kept for backward compatibility but does nothing.
   */
  override removePermission(user_id: string, permission: string): void {
    log(
      EPriority.Warning,
      'PERMISSIONS',
      `removePermission is deprecated. Use UserRoleManager.removeRole() instead. Ignoring: ${user_id} → ${permission}`
    );
  }

  /**
   * Get all permissions for user (expanded from roles)
   * 
   * @param user_id - User ID
   * @param project_id - Optional project ID
   * @returns Array of permission strings
   */
  getPermissions(user_id: string, project_id?: string): string[] {
    if (!this.userRoleManager) {
      return [];
    }

    return this.userRoleManager.getUserPermissions(user_id, project_id);
  }

  // ============================================================================
  // Persistence (IPersistenceProvider)
  // ============================================================================

  /**
   * Load from serialized data
   * 
   * NOTE: PermissionManager no longer stores permissions.
   * All permissions are in UserRoleManager (via roles).
   * This method exists for IPersistenceProvider compatibility but does nothing.
   */
  loadFromSerialized(data: Record<string, unknown> | null | undefined): void {
    // Nothing to load - permissions are resolved from roles
    if (data && Object.keys(data).length > 0) {
      log(
        EPriority.Info,
        'PERMISSIONS',
        'Ignoring legacy permission data (using role-based system)'
      );
    }
  }

  /**
   * Save to serializable format
   * 
   * NOTE: PermissionManager no longer stores permissions.
   * Returns empty object to satisfy IPersistenceProvider interface.
   */
  saveToSerializable(): Record<string, unknown> {
    // Nothing to save - permissions are in roles
    return {};
  }
}
