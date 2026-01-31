import { v4 as uuidv4 } from 'uuid';
import { IPersistenceProvider } from '../state/IPersistenceProvider';

/**
 * Role definition
 * 
 * Roles are collections of permissions that can be assigned to users.
 * Roles can be at org level (apply to all projects) or project level (specific projects).
 */
export interface Role {
  role_id: string;
  role_name: string;           // "org:owner", "org:admin", "developer"
  display_name: string;
  description: string;
  permissions: string[];       // ["*"] or ["project:[*]:create", ...]
  immutable: boolean;          // System roles cannot be edited/deleted
  system: boolean;             // Built-in vs custom
  scope: 'org' | 'project';    // Org-level or project-specific
}

/**
 * Default system roles that are created on gateway initialization
 */
const DEFAULT_SYSTEM_ROLES: Omit<Role, 'role_id'>[] = [
  {
    role_name: 'org:owner',
    display_name: 'Organization Owner',
    description: 'Full control over organization and all projects. Cannot be removed.',
    permissions: ['*'],  // Universal wildcard - grants everything
    immutable: true,
    system: true,
    scope: 'org',
  },
  {
    role_name: 'org:admin',
    display_name: 'Organization Administrator',
    description: 'Manage projects, members, and permissions',
    permissions: [
      'org:*:admin',
      'project:*:create',
      'project:*:admin',
      'project:*:delete',
      'gateway:permissions:read',
      'gateway:permissions:write',
      'gateway:roles:read',
      'gateway:roles:write',
      'container:create',
      'container:delete',
      'container:host',
    ],
    immutable: true,
    system: true,
    scope: 'org',
  },
];

/**
 * RoleManager
 * 
 * Manages roles (collections of permissions) in the gateway.
 * Roles can be system-defined (immutable) or custom (user-created).
 * 
 * Implements IPersistenceProvider for gateway state persistence.
 */
export class RoleManager implements IPersistenceProvider {
  private roles: Map<string, Role> = new Map();
  private rolesByName: Map<string, Role> = new Map();
  private initialized = false;

  constructor() {
    // Empty - initialization happens via initializeDefaultRoles()
  }

  /**
   * Initialize default system roles
   * Called once during gateway startup
   */
  initializeDefaultRoles(): void {
    if (this.initialized) {
      return; // Already initialized
    }

    for (const roleData of DEFAULT_SYSTEM_ROLES) {
      const role_id = uuidv4();
      const role: Role = {
        role_id,
        ...roleData,
      };

      this.roles.set(role_id, role);
      this.rolesByName.set(role.role_name, role);
    }

    this.initialized = true;
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create a new custom role
   * 
   * @param roleData - Role data (without role_id)
   * @returns The generated role_id
   * @throws Error if role_name already exists
   * @throws Error if validation fails
   */
  createRole(roleData: Omit<Role, 'role_id'>): string {
    // Validation
    this.validateRoleData(roleData);

    // Check if role name already exists
    if (this.rolesByName.has(roleData.role_name)) {
      throw new Error(`Role name already exists: ${roleData.role_name}`);
    }

    // Create role
    const role_id = uuidv4();
    const role: Role = {
      role_id,
      ...roleData,
    };

    this.roles.set(role_id, role);
    this.rolesByName.set(role.role_name, role);

    return role_id;
  }

  /**
   * Get role by ID
   */
  getRole(role_id: string): Role | undefined {
    return this.roles.get(role_id);
  }

  /**
   * Get role by name
   */
  getRoleByName(role_name: string): Role | undefined {
    return this.rolesByName.get(role_name);
  }

  /**
   * Update an existing role
   * 
   * @param role_id - Role ID to update
   * @param updates - Partial role data to update
   * @throws Error if role is immutable
   * @throws Error if role doesn't exist
   * @throws Error if validation fails
   */
  updateRole(role_id: string, updates: Partial<Omit<Role, 'role_id' | 'role_name' | 'system'>>): void {
    const role = this.roles.get(role_id);

    if (!role) {
      throw new Error(`Role not found: ${role_id}`);
    }

    if (role.immutable) {
      throw new Error(`Cannot update immutable role: ${role.role_name}`);
    }

    // Validate updates
    if (updates.permissions) {
      this.validatePermissions(updates.permissions);
    }

    // Apply updates
    const updated: Role = {
      ...role,
      ...updates,
    };

    this.roles.set(role_id, updated);
    this.rolesByName.set(role.role_name, updated);
  }

  /**
   * Delete a custom role
   * 
   * @param role_id - Role ID to delete
   * @throws Error if role is immutable
   * @throws Error if role doesn't exist
   */
  deleteRole(role_id: string): void {
    const role = this.roles.get(role_id);

    if (!role) {
      throw new Error(`Role not found: ${role_id}`);
    }

    if (role.immutable) {
      throw new Error(`Cannot delete immutable role: ${role.role_name}`);
    }

    this.roles.delete(role_id);
    this.rolesByName.delete(role.role_name);
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get all roles (system + custom)
   */
  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get roles by scope
   */
  getRolesByScope(scope: 'org' | 'project'): Role[] {
    return Array.from(this.roles.values()).filter((r) => r.scope === scope);
  }

  /**
   * Get system roles
   */
  getSystemRoles(): Role[] {
    return Array.from(this.roles.values()).filter((r) => r.system);
  }

  /**
   * Get custom roles
   */
  getCustomRoles(): Role[] {
    return Array.from(this.roles.values()).filter((r) => !r.system);
  }

  // ============================================================================
  // Validation
  // ============================================================================

  private validateRoleData(roleData: Omit<Role, 'role_id'>): void {
    // Validate role_name
    if (!roleData.role_name || typeof roleData.role_name !== 'string') {
      throw new Error('role_name is required and must be a string');
    }

    // Validate display_name
    if (!roleData.display_name || typeof roleData.display_name !== 'string') {
      throw new Error('display_name is required and must be a string');
    }

    // Validate scope
    if (roleData.scope !== 'org' && roleData.scope !== 'project') {
      throw new Error('scope must be "org" or "project"');
    }

    // Validate permissions
    this.validatePermissions(roleData.permissions);
  }

  private validatePermissions(permissions: string[]): void {
    if (!Array.isArray(permissions)) {
      throw new Error('permissions must be an array');
    }

    if (permissions.length === 0) {
      throw new Error('permissions array cannot be empty');
    }

    // Check each permission is a valid string
    for (const perm of permissions) {
      if (typeof perm !== 'string' || perm.length === 0) {
        throw new Error('Each permission must be a non-empty string');
      }
    }
  }

  // ============================================================================
  // Persistence (IPersistenceProvider)
  // ============================================================================

  /**
   * Load roles from serialized data
   * Called when gateway loads state from Ganymede
   */
  loadFromSerialized(data: Record<string, unknown> | null | undefined): void {
    if (!data || typeof data !== 'object') {
      // No saved roles, initialize defaults
      this.initializeDefaultRoles();
      return;
    }

    const rolesData = data as { roles?: Record<string, Role> };

    if (!rolesData.roles) {
      // No saved roles, initialize defaults
      this.initializeDefaultRoles();
      return;
    }

    // Clear existing
    this.roles.clear();
    this.rolesByName.clear();

    // Load roles
    for (const [role_id, role] of Object.entries(rolesData.roles)) {
      this.roles.set(role_id, role);
      this.rolesByName.set(role.role_name, role);
    }

    // Ensure default system roles exist
    for (const defaultRole of DEFAULT_SYSTEM_ROLES) {
      if (!this.rolesByName.has(defaultRole.role_name)) {
        // System role missing, create it
        const role_id = uuidv4();
        const role: Role = {
          role_id,
          ...defaultRole,
        };
        this.roles.set(role_id, role);
        this.rolesByName.set(role.role_name, role);
      }
    }

    this.initialized = true;
  }

  /**
   * Serialize roles for persistence
   * Called when gateway saves state to Ganymede
   */
  saveToSerializable(): Record<string, unknown> {
    const rolesObj: Record<string, Role> = {};

    for (const [role_id, role] of this.roles.entries()) {
      rolesObj[role_id] = role;
    }

    return {
      roles: rolesObj,
    };
  }
}
