import { RoleManager } from './RoleManager';
import { UserRoleManager } from './UserRoleManager';
import { PermissionManager } from './PermissionManager';

/**
 * RBAC Integration Tests
 * 
 * Tests the full RBAC system end-to-end:
 * - Role creation and management
 * - User-role assignments
 * - Permission resolution via roles
 * - Wildcard matching
 * - Org vs project scope
 */
describe('RBAC Integration', () => {
  let roleManager: RoleManager;
  let userRoleManager: UserRoleManager;
  let permissionManager: PermissionManager;

  beforeEach(() => {
    roleManager = new RoleManager();
    roleManager.initializeDefaultRoles();
    
    userRoleManager = new UserRoleManager(roleManager);
    
    permissionManager = new PermissionManager();
    permissionManager.setUserRoleManager(userRoleManager);
  });

  describe('Complete Flow: Create Role → Assign to User → Check Permission', () => {
    it('should work end-to-end for project-level role', () => {
      // 1. Create custom role
      const roleId = roleManager.createRole({
        role_name: 'developer',
        display_name: 'Developer',
        description: 'Can read and write projects',
        permissions: [
          'project:*:read',
          'project:*:write',
          'container:*:create',
        ],
        scope: 'project',
        immutable: false,
        system: false,
      });

      // 2. Assign role to user for specific project
      userRoleManager.assignProjectRole('user-123', 'project-abc', roleId);

      // 3. Check permissions (should work via role resolution)
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:read', 'project-abc')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:write', 'project-abc')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'container:container-123:create', 'project-abc')).toBe(true);

      // 4. Should NOT have permissions without project context
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:read')).toBe(false);

      // 5. Should NOT have permissions for different project
      expect(permissionManager.hasPermission('user-123', 'project:project-xyz:read', 'project-xyz')).toBe(false);

      // 6. Should NOT have admin permission (not in role)
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:admin', 'project-abc')).toBe(false);
    });

    it('should work end-to-end for org-level role', () => {
      // 1. Create org-level role
      const roleId = roleManager.createRole({
        role_name: 'org-developer',
        display_name: 'Organization Developer',
        description: 'Can access all projects',
        permissions: [
          'project:*:read',
          'project:*:write',
        ],
        scope: 'org',
        immutable: false,
        system: false,
      });

      // 2. Assign role to user at org level
      userRoleManager.assignOrgRole('user-123', roleId);

      // 3. Check permissions (should work for ANY project)
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:read')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:project-xyz:read')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:write', 'project-abc')).toBe(true);

      // 4. Org role applies even with project context
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:read', 'project-abc')).toBe(true);
    });

    it('should combine org and project roles', () => {
      // 1. Create org role with limited permissions
      const orgRoleId = roleManager.createRole({
        role_name: 'org-viewer',
        display_name: 'Organization Viewer',
        description: 'Can view all projects',
        permissions: ['project:*:read'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      // 2. Create project role with additional permissions
      const projectRoleId = roleManager.createRole({
        role_name: 'project-editor',
        display_name: 'Project Editor',
        description: 'Can edit specific project',
        permissions: ['project:*:write', 'project:*:delete'],
        scope: 'project',
        immutable: false,
        system: false,
      });

      // 3. Assign org role
      userRoleManager.assignOrgRole('user-123', orgRoleId);

      // 4. Assign project role for specific project
      userRoleManager.assignProjectRole('user-123', 'project-abc', projectRoleId);

      // 5. User has read access everywhere (org role)
      expect(permissionManager.hasPermission('user-123', 'project:project-xyz:read')).toBe(true);

      // 6. User has write access only to project-abc (project role)
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:write', 'project-abc')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:project-xyz:write', 'project-xyz')).toBe(false);

      // 7. User has delete access only to project-abc (project role)
      expect(permissionManager.hasPermission('user-123', 'project:project-abc:delete', 'project-abc')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:project-xyz:delete', 'project-xyz')).toBe(false);
    });
  });

  describe('System Roles (org:owner, org:admin)', () => {
    it('org:owner should have universal access', () => {
      const ownerRole = roleManager.getRoleByName('org:owner');
      expect(ownerRole).toBeDefined();

      userRoleManager.assignOrgRole('user-123', ownerRole!.role_id);

      // Should have access to EVERYTHING
      expect(permissionManager.hasPermission('user-123', 'project:abc:read')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:abc:write')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:abc:delete')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:abc:admin')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'container:123:anything')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'any:thing:you:can:imagine')).toBe(true);
    });

    it('org:admin should have predefined permissions', () => {
      const adminRole = roleManager.getRoleByName('org:admin');
      expect(adminRole).toBeDefined();

      userRoleManager.assignOrgRole('user-123', adminRole!.role_id);

      // Should have admin access to org and projects
      expect(permissionManager.hasPermission('user-123', 'org:my-org:admin')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:abc:admin')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:xyz:create')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'project:abc:delete')).toBe(true);

      // Should have role management access
      expect(permissionManager.hasPermission('user-123', 'gateway:roles:read')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'gateway:roles:write')).toBe(true);

      // Should have container access
      expect(permissionManager.hasPermission('user-123', 'container:create')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'container:delete')).toBe(true);
    });
  });

  describe('Role Management Operations', () => {
    it('should update role and affect all users', () => {
      // 1. Create role with limited permissions
      const roleId = roleManager.createRole({
        role_name: 'test-role',
        display_name: 'Test Role',
        description: 'Test',
        permissions: ['project:*:read'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      // 2. Assign to multiple users
      userRoleManager.assignOrgRole('user-1', roleId);
      userRoleManager.assignOrgRole('user-2', roleId);

      // 3. Users can only read
      expect(permissionManager.hasPermission('user-1', 'project:abc:read')).toBe(true);
      expect(permissionManager.hasPermission('user-1', 'project:abc:write')).toBe(false);
      expect(permissionManager.hasPermission('user-2', 'project:abc:read')).toBe(true);
      expect(permissionManager.hasPermission('user-2', 'project:abc:write')).toBe(false);

      // 4. Update role to add write permission
      roleManager.updateRole(roleId, {
        permissions: ['project:*:read', 'project:*:write'],
      });

      // 5. Both users now have write permission (dynamic resolution)
      expect(permissionManager.hasPermission('user-1', 'project:abc:write')).toBe(true);
      expect(permissionManager.hasPermission('user-2', 'project:abc:write')).toBe(true);
    });

    it('should remove role from all users when deleted', () => {
      // 1. Create role
      const roleId = roleManager.createRole({
        role_name: 'temp-role',
        display_name: 'Temporary Role',
        description: 'Test',
        permissions: ['test:permission'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      // 2. Assign to users
      userRoleManager.assignOrgRole('user-1', roleId);
      userRoleManager.assignOrgRole('user-2', roleId);

      // 3. Users have permission
      expect(permissionManager.hasPermission('user-1', 'test:permission')).toBe(true);
      expect(permissionManager.hasPermission('user-2', 'test:permission')).toBe(true);

      // 4. Delete role (should remove from all users)
      userRoleManager.removeRoleFromAllUsers(roleId);
      roleManager.deleteRole(roleId);

      // 5. Users no longer have permission
      expect(permissionManager.hasPermission('user-1', 'test:permission')).toBe(false);
      expect(permissionManager.hasPermission('user-2', 'test:permission')).toBe(false);
    });
  });

  describe('Complex Permission Scenarios', () => {
    it('should handle user with multiple roles', () => {
      // Create multiple roles
      const role1 = roleManager.createRole({
        role_name: 'role1',
        display_name: 'Role 1',
        description: 'Test',
        permissions: ['permission:a', 'permission:b'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      const role2 = roleManager.createRole({
        role_name: 'role2',
        display_name: 'Role 2',
        description: 'Test',
        permissions: ['permission:b', 'permission:c'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      const role3 = roleManager.createRole({
        role_name: 'role3',
        display_name: 'Role 3',
        description: 'Test',
        permissions: ['permission:d'],
        scope: 'project',
        immutable: false,
        system: false,
      });

      // Assign all roles
      userRoleManager.assignOrgRole('user-123', role1);
      userRoleManager.assignOrgRole('user-123', role2);
      userRoleManager.assignProjectRole('user-123', 'project-abc', role3);

      // User should have union of all permissions
      expect(permissionManager.hasPermission('user-123', 'permission:a')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'permission:b')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'permission:c')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'permission:d', 'project-abc')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'permission:e')).toBe(false);
    });

    it('should handle wildcard hierarchy correctly', () => {
      const roleId = roleManager.createRole({
        role_name: 'wildcard-test',
        display_name: 'Wildcard Test',
        description: 'Test',
        permissions: [
          'service:*:read',      // Any service, read
          'service:api:*',       // Specific service (api), any action
          '*:database:admin',    // Any service, database resource, admin
        ],
        scope: 'org',
        immutable: false,
        system: false,
      });

      userRoleManager.assignOrgRole('user-123', roleId);

      // Test first pattern: service:*:read
      expect(permissionManager.hasPermission('user-123', 'service:api:read')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'service:web:read')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'service:api:write')).toBe(true); // Also true via second pattern

      // Test second pattern: service:api:*
      expect(permissionManager.hasPermission('user-123', 'service:api:read')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'service:api:write')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'service:api:delete')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'service:web:write')).toBe(false);

      // Test third pattern: *:database:admin
      expect(permissionManager.hasPermission('user-123', 'api:database:admin')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'web:database:admin')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'api:database:read')).toBe(false);
    });
  });

  describe('Persistence and Recovery', () => {
    it('should persist and restore role definitions', () => {
      // Create custom roles
      const role1Id = roleManager.createRole({
        role_name: 'custom1',
        display_name: 'Custom 1',
        description: 'Test',
        permissions: ['perm1', 'perm2'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      const role2Id = roleManager.createRole({
        role_name: 'custom2',
        display_name: 'Custom 2',
        description: 'Test',
        permissions: ['perm3'],
        scope: 'project',
        immutable: false,
        system: false,
      });

      // Serialize
      const serialized = roleManager.saveToSerializable();

      // Create new manager and restore
      const newRoleManager = new RoleManager();
      newRoleManager.loadFromSerialized(serialized);

      // Verify roles restored
      const restored1 = newRoleManager.getRole(role1Id);
      const restored2 = newRoleManager.getRole(role2Id);

      expect(restored1).toBeDefined();
      expect(restored1?.role_name).toBe('custom1');
      expect(restored1?.permissions).toEqual(['perm1', 'perm2']);

      expect(restored2).toBeDefined();
      expect(restored2?.role_name).toBe('custom2');
      expect(restored2?.permissions).toEqual(['perm3']);
    });

    it('should persist and restore user-role assignments', () => {
      const role1Id = roleManager.createRole({
        role_name: 'role1',
        display_name: 'Role 1',
        description: 'Test',
        permissions: ['perm1'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      const role2Id = roleManager.createRole({
        role_name: 'role2',
        display_name: 'Role 2',
        description: 'Test',
        permissions: ['perm2'],
        scope: 'project',
        immutable: false,
        system: false,
      });

      // Assign roles
      userRoleManager.assignOrgRole('user-1', role1Id);
      userRoleManager.assignProjectRole('user-2', 'project-abc', role2Id);

      // Serialize
      const serialized = userRoleManager.saveToSerializable();

      // Create new manager and restore
      const newUserRoleManager = new UserRoleManager(roleManager);
      newUserRoleManager.loadFromSerialized(serialized);

      // Verify assignments restored
      const orgRoles = newUserRoleManager.getUserOrgRoles('user-1');
      const projectRoles = newUserRoleManager.getUserProjectRoles('user-2', 'project-abc');

      expect(orgRoles).toHaveLength(1);
      expect(orgRoles[0].role_name).toBe('role1');

      expect(projectRoles).toHaveLength(1);
      expect(projectRoles[0].role_name).toBe('role2');
    });

    it('should work end-to-end after persistence cycle', () => {
      // Setup
      const roleId = roleManager.createRole({
        role_name: 'test',
        display_name: 'Test',
        description: 'Test',
        permissions: ['test:permission'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      userRoleManager.assignOrgRole('user-123', roleId);

      expect(permissionManager.hasPermission('user-123', 'test:permission')).toBe(true);

      // Serialize
      const rolesSerialized = roleManager.saveToSerializable();
      const userRolesSerialized = userRoleManager.saveToSerializable();

      // Simulate restart - create new managers
      const newRoleManager = new RoleManager();
      newRoleManager.loadFromSerialized(rolesSerialized);

      const newUserRoleManager = new UserRoleManager(newRoleManager);
      newUserRoleManager.loadFromSerialized(userRolesSerialized);

      const newPermissionManager = new PermissionManager();
      newPermissionManager.setUserRoleManager(newUserRoleManager);

      // Verify permission still works
      expect(newPermissionManager.hasPermission('user-123', 'test:permission')).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle user with no roles', () => {
      expect(permissionManager.hasPermission('user-nonexistent', 'any:permission')).toBe(false);
    });

    it('should handle permission check with deleted role', () => {
      const roleId = roleManager.createRole({
        role_name: 'temp',
        display_name: 'Temp',
        description: 'Test',
        permissions: ['test:permission'],
        scope: 'org',
        immutable: false,
        system: false,
      });

      userRoleManager.assignOrgRole('user-123', roleId);

      expect(permissionManager.hasPermission('user-123', 'test:permission')).toBe(true);

      // Delete role (but don't remove from user assignments yet)
      roleManager.deleteRole(roleId);

      // User role manager filters out deleted roles
      const roles = userRoleManager.getUserOrgRoles('user-123');
      expect(roles).toHaveLength(0);

      // Permission check should fail gracefully
      expect(permissionManager.hasPermission('user-123', 'test:permission')).toBe(false);
    });

    it('should handle permission format edge cases', () => {
      const roleId = roleManager.createRole({
        role_name: 'edge-case',
        display_name: 'Edge Case',
        description: 'Test',
        permissions: [
          'a',           // Single part
          'a:b',         // Two parts
          'a:b:c:d:e',   // Many parts
        ],
        scope: 'org',
        immutable: false,
        system: false,
      });

      userRoleManager.assignOrgRole('user-123', roleId);

      // Exact matches
      expect(permissionManager.hasPermission('user-123', 'a')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'a:b')).toBe(true);
      expect(permissionManager.hasPermission('user-123', 'a:b:c:d:e')).toBe(true);

      // Different part counts don't match
      expect(permissionManager.hasPermission('user-123', 'a:b:c')).toBe(false);
      expect(permissionManager.hasPermission('user-123', 'a:b:c:d')).toBe(false);
    });
  });
});
