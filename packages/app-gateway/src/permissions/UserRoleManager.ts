import { IPersistenceProvider } from '../state/IPersistenceProvider';
import { RoleManager, Role } from './RoleManager';

/**
 * User role assignments
 * Tracks which roles are assigned to each user at org and project levels
 */
export interface UserRoleAssignments {
  org_roles: string[];                    // role_ids with scope=org
  project_roles: {
    [project_id: string]: string[];       // role_ids with scope=project
  };
}

/**
 * UserRoleManager
 * 
 * Manages user-to-role assignments at organization and project levels.
 * 
 * - Org roles apply to ALL projects in the organization
 * - Project roles apply to SPECIFIC projects only
 * 
 * Implements IPersistenceProvider for gateway state persistence.
 */
export class UserRoleManager implements IPersistenceProvider {
  private userRoles: Map<string, UserRoleAssignments> = new Map();
  private roleManager: RoleManager;

  constructor(roleManager: RoleManager) {
    this.roleManager = roleManager;
  }

  // ============================================================================
  // Assignment Operations
  // ============================================================================

  /**
   * Assign an organization-level role to a user
   * 
   * @param user_id - User ID
   * @param role_id - Role ID (must be scope=org)
   * @throws Error if role doesn't exist or has wrong scope
   */
  assignOrgRole(user_id: string, role_id: string): void {
    const role = this.roleManager.getRole(role_id);

    if (!role) {
      throw new Error(`Role not found: ${role_id}`);
    }

    if (role.scope !== 'org') {
      throw new Error(
        `Cannot assign project-scoped role "${role.role_name}" as org role`
      );
    }

    // Get or create user assignments
    const assignments = this.getUserAssignments(user_id);

    // Add role if not already assigned
    if (!assignments.org_roles.includes(role_id)) {
      assignments.org_roles.push(role_id);
    }
  }

  /**
   * Remove an organization-level role from a user
   * 
   * @param user_id - User ID
   * @param role_id - Role ID
   */
  removeOrgRole(user_id: string, role_id: string): void {
    const assignments = this.userRoles.get(user_id);
    if (!assignments) {
      return; // No assignments for this user
    }

    assignments.org_roles = assignments.org_roles.filter((id) => id !== role_id);

    // Clean up if user has no roles left
    if (
      assignments.org_roles.length === 0 &&
      Object.keys(assignments.project_roles).length === 0
    ) {
      this.userRoles.delete(user_id);
    }
  }

  /**
   * Assign a project-level role to a user
   * 
   * @param user_id - User ID
   * @param project_id - Project ID
   * @param role_id - Role ID (must be scope=project)
   * @throws Error if role doesn't exist or has wrong scope
   */
  assignProjectRole(user_id: string, project_id: string, role_id: string): void {
    const role = this.roleManager.getRole(role_id);

    if (!role) {
      throw new Error(`Role not found: ${role_id}`);
    }

    if (role.scope !== 'project') {
      throw new Error(
        `Cannot assign org-scoped role "${role.role_name}" as project role`
      );
    }

    // Get or create user assignments
    const assignments = this.getUserAssignments(user_id);

    // Initialize project roles if not exists
    if (!assignments.project_roles[project_id]) {
      assignments.project_roles[project_id] = [];
    }

    // Add role if not already assigned
    if (!assignments.project_roles[project_id].includes(role_id)) {
      assignments.project_roles[project_id].push(role_id);
    }
  }

  /**
   * Remove a project-level role from a user
   * 
   * @param user_id - User ID
   * @param project_id - Project ID
   * @param role_id - Role ID
   */
  removeProjectRole(user_id: string, project_id: string, role_id: string): void {
    const assignments = this.userRoles.get(user_id);
    if (!assignments || !assignments.project_roles[project_id]) {
      return; // No assignments for this user/project
    }

    assignments.project_roles[project_id] = assignments.project_roles[
      project_id
    ].filter((id) => id !== role_id);

    // Clean up empty project
    if (assignments.project_roles[project_id].length === 0) {
      delete assignments.project_roles[project_id];
    }

    // Clean up if user has no roles left
    if (
      assignments.org_roles.length === 0 &&
      Object.keys(assignments.project_roles).length === 0
    ) {
      this.userRoles.delete(user_id);
    }
  }

  /**
   * Remove all project roles for a user (used when removing from project)
   * 
   * @param user_id - User ID
   * @param project_id - Project ID
   */
  removeAllProjectRoles(user_id: string, project_id: string): void {
    const assignments = this.userRoles.get(user_id);
    if (!assignments || !assignments.project_roles[project_id]) {
      return; // No assignments for this user/project
    }

    delete assignments.project_roles[project_id];

    // Clean up if user has no roles left
    if (
      assignments.org_roles.length === 0 &&
      Object.keys(assignments.project_roles).length === 0
    ) {
      this.userRoles.delete(user_id);
    }
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get user's organization-level roles
   * 
   * @param user_id - User ID
   * @returns Array of Role objects
   */
  getUserOrgRoles(user_id: string): Role[] {
    const assignments = this.userRoles.get(user_id);
    if (!assignments) {
      return [];
    }

    return assignments.org_roles
      .map((role_id) => this.roleManager.getRole(role_id))
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Get user's project-level roles for a specific project
   * 
   * @param user_id - User ID
   * @param project_id - Project ID
   * @returns Array of Role objects
   */
  getUserProjectRoles(user_id: string, project_id: string): Role[] {
    const assignments = this.userRoles.get(user_id);
    if (!assignments || !assignments.project_roles[project_id]) {
      return [];
    }

    return assignments.project_roles[project_id]
      .map((role_id) => this.roleManager.getRole(role_id))
      .filter((role): role is Role => role !== undefined);
  }

  /**
   * Get ALL user roles (org + project-specific)
   * 
   * @param user_id - User ID
   * @param project_id - Optional project ID to include project roles
   * @returns Array of Role objects
   */
  getAllUserRoles(user_id: string, project_id?: string): Role[] {
    const orgRoles = this.getUserOrgRoles(user_id);

    if (!project_id) {
      return orgRoles;
    }

    const projectRoles = this.getUserProjectRoles(user_id, project_id);

    // Return unique roles (in case of duplicates)
    const roleMap = new Map<string, Role>();
    for (const role of [...orgRoles, ...projectRoles]) {
      roleMap.set(role.role_id, role);
    }

    return Array.from(roleMap.values());
  }

  /**
   * Get all permissions for a user (expanded from roles)
   * 
   * @param user_id - User ID
   * @param project_id - Optional project ID to include project roles
   * @returns Array of permission strings
   */
  getUserPermissions(user_id: string, project_id?: string): string[] {
    const roles = this.getAllUserRoles(user_id, project_id);

    // Expand permissions from all roles
    const permissions = new Set<string>();

    for (const role of roles) {
      for (const permission of role.permissions) {
        permissions.add(permission);
      }
    }

    return Array.from(permissions);
  }

  /**
   * Get all users that have a specific role
   * 
   * @param role_id - Role ID
   * @returns Array of user IDs
   */
  getUsersWithRole(role_id: string): string[] {
    const users: string[] = [];

    for (const [user_id, assignments] of this.userRoles.entries()) {
      // Check org roles
      if (assignments.org_roles.includes(role_id)) {
        users.push(user_id);
        continue;
      }

      // Check project roles
      for (const projectRoles of Object.values(assignments.project_roles)) {
        if (projectRoles.includes(role_id)) {
          users.push(user_id);
          break; // User found, no need to check more projects
        }
      }
    }

    return users;
  }

  /**
   * Remove a role from ALL users (used when role is deleted)
   * 
   * @param role_id - Role ID to remove
   */
  removeRoleFromAllUsers(role_id: string): void {
    for (const [user_id, assignments] of this.userRoles.entries()) {
      // Remove from org roles
      assignments.org_roles = assignments.org_roles.filter((id) => id !== role_id);

      // Remove from project roles
      for (const project_id of Object.keys(assignments.project_roles)) {
        assignments.project_roles[project_id] = assignments.project_roles[
          project_id
        ].filter((id) => id !== role_id);

        // Clean up empty project
        if (assignments.project_roles[project_id].length === 0) {
          delete assignments.project_roles[project_id];
        }
      }

      // Clean up if user has no roles left
      if (
        assignments.org_roles.length === 0 &&
        Object.keys(assignments.project_roles).length === 0
      ) {
        this.userRoles.delete(user_id);
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get or create user assignments
   */
  private getUserAssignments(user_id: string): UserRoleAssignments {
    let assignments = this.userRoles.get(user_id);

    if (!assignments) {
      assignments = {
        org_roles: [],
        project_roles: {},
      };
      this.userRoles.set(user_id, assignments);
    }

    return assignments;
  }

  // ============================================================================
  // Persistence (IPersistenceProvider)
  // ============================================================================

  /**
   * Load user-role assignments from serialized data
   */
  loadFromSerialized(
    data: Record<string, unknown> | null | undefined
  ): void {
    this.userRoles.clear();

    if (!data || typeof data !== 'object') {
      return; // No saved data
    }

    const userRolesData = data as { user_roles?: Record<string, UserRoleAssignments> };

    if (!userRolesData.user_roles) {
      return; // No user roles in data
    }

    // Load user roles
    for (const [user_id, assignments] of Object.entries(userRolesData.user_roles)) {
      this.userRoles.set(user_id, {
        org_roles: [...assignments.org_roles],
        project_roles: { ...assignments.project_roles },
      });
    }
  }

  /**
   * Serialize user-role assignments for persistence
   */
  saveToSerializable(): Record<string, unknown> {
    const userRolesObj: Record<string, UserRoleAssignments> = {};

    for (const [user_id, assignments] of this.userRoles.entries()) {
      userRolesObj[user_id] = {
        org_roles: [...assignments.org_roles],
        project_roles: { ...assignments.project_roles },
      };
    }

    return {
      user_roles: userRolesObj,
    };
  }
}
