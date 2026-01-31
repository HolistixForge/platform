import { RoleManager } from './RoleManager';
import { UserRoleManager } from './UserRoleManager';
import { PermissionManager } from './PermissionManager';

describe('PermissionManager (RBAC)', () => {
  let roleManager: RoleManager;
  let userRoleManager: UserRoleManager;
  let permissionManager: PermissionManager;
  let orgOwnerRoleId: string;
  let orgAdminRoleId: string;

  beforeEach(() => {
    roleManager = new RoleManager();
    roleManager.initializeDefaultRoles();
    
    userRoleManager = new UserRoleManager(roleManager);
    
    permissionManager = new PermissionManager();
    permissionManager.setUserRoleManager(userRoleManager);

    // Get system role IDs
    const ownerRole = roleManager.getRoleByName('org:owner');
    const adminRole = roleManager.getRoleByName('org:admin');
    orgOwnerRoleId = ownerRole!.role_id;
    orgAdminRoleId = adminRole!.role_id;
  });

  describe('Permission Checking via Roles', () => {
    it('should deny permission if user has no roles', () => {
      const hasPermission = permissionManager.hasPermission('user-1', 'test:permission');
      expect(hasPermission).toBe(false);
    });

    it('should grant permission if user has role with exact permission', () => {
      const roleId = roleManager.createRole({
        role_name: 'test-role',
        display_name: 'Test Role',
        description: 'Test',
        permissions: ['test:exact:permission'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      userRoleManager.assignOrgRole('user-1', roleId);

      const hasPermission = permissionManager.hasPermission('user-1', 'test:exact:permission');
      expect(hasPermission).toBe(true);
    });

    it('should grant permission via org role', () => {
      userRoleManager.assignOrgRole('user-1', orgAdminRoleId);

      // org:admin has "org:*:admin" permission
      const hasPermission = permissionManager.hasPermission('user-1', 'org:my-org:admin');
      expect(hasPermission).toBe(true);
    });

    it('should grant permission via project role when project_id provided', () => {
      const projectRoleId = roleManager.createRole({
        role_name: 'developer',
        display_name: 'Developer',
        description: 'Test',
        permissions: ['project:*:write'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      userRoleManager.assignProjectRole('user-1', 'project-a', projectRoleId);

      const hasPermission = permissionManager.hasPermission(
        'user-1',
        'project:project-a:write',
        'project-a'
      );
      expect(hasPermission).toBe(true);
    });

    it('should combine org and project roles', () => {
      userRoleManager.assignOrgRole('user-1', orgAdminRoleId);

      const projectRoleId = roleManager.createRole({
        role_name: 'developer',
        display_name: 'Developer',
        description: 'Test',
        permissions: ['test:project:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      userRoleManager.assignProjectRole('user-1', 'project-a', projectRoleId);

      // Has org:admin permissions
      expect(permissionManager.hasPermission('user-1', 'org:test:admin', 'project-a')).toBe(true);

      // Has project-specific permissions
      expect(permissionManager.hasPermission('user-1', 'test:project:permission', 'project-a')).toBe(true);
    });
  });

  describe('org:owner Special Case', () => {
    it('should grant all permissions to org:owner (universal wildcard)', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);

      expect(permissionManager.hasPermission('user-1', 'any:permission')).toBe(true);
      expect(permissionManager.hasPermission('user-1', 'project:abc:delete')).toBe(true);
      expect(permissionManager.hasPermission('user-1', 'container:123:create')).toBe(true);
      expect(permissionManager.hasPermission('user-1', 'anything:you:can:imagine')).toBe(true);
    });
  });

  describe('Wildcard Matching', () => {
    describe('Universal Wildcard (*)', () => {
      it('should match everything with "*"', () => {
        const roleId = roleManager.createRole({
          role_name: 'god-mode',
          display_name: 'God Mode',
          description: 'Test',
          permissions: ['*'],
          immutable: false,
          system: false,
          scope: 'org',
        });

        userRoleManager.assignOrgRole('user-1', roleId);

        expect(permissionManager.hasPermission('user-1', 'any:permission')).toBe(true);
        expect(permissionManager.hasPermission('user-1', 'another:one')).toBe(true);
      });
    });

    describe('Simple Wildcard Patterns', () => {
      it('should match with wildcard in position', () => {
        const roleId = roleManager.createRole({
          role_name: 'test-role',
          display_name: 'Test Role',
          description: 'Test',
          permissions: ['project:*:admin'],
          immutable: false,
          system: false,
          scope: 'org',
        });

        userRoleManager.assignOrgRole('user-1', roleId);

        // Should match any project ID
        expect(permissionManager.hasPermission('user-1', 'project:abc:admin')).toBe(true);
        expect(permissionManager.hasPermission('user-1', 'project:xyz:admin')).toBe(true);
        expect(permissionManager.hasPermission('user-1', 'project:123:admin')).toBe(true);

        // Should NOT match different actions
        expect(permissionManager.hasPermission('user-1', 'project:abc:write')).toBe(false);
      });

      it('should match with multiple wildcards', () => {
        const roleId = roleManager.createRole({
          role_name: 'test-role',
          display_name: 'Test Role',
          description: 'Test',
          permissions: ['*:*:admin'],
          immutable: false,
          system: false,
          scope: 'org',
        });

        userRoleManager.assignOrgRole('user-1', roleId);

        expect(permissionManager.hasPermission('user-1', 'project:abc:admin')).toBe(true);
        expect(permissionManager.hasPermission('user-1', 'container:xyz:admin')).toBe(true);
        expect(permissionManager.hasPermission('user-1', 'anything:anything:admin')).toBe(true);

        // Should NOT match different actions
        expect(permissionManager.hasPermission('user-1', 'project:abc:write')).toBe(false);
      });
    });

    describe('Resource Path Wildcards', () => {
      it('should match resource wildcard with *', () => {
        const roleId = roleManager.createRole({
          role_name: 'container-creator',
          display_name: 'Container Creator',
          description: 'Test',
          permissions: ['container:*:create'],
          immutable: false,
          system: false,
          scope: 'org',
        });

        userRoleManager.assignOrgRole('user-1', roleId);

        // Should match any container ID
        expect(permissionManager.hasPermission('user-1', 'container:abc123:create')).toBe(true);
        expect(permissionManager.hasPermission('user-1', 'container:xyz789:create')).toBe(true);

        // Should NOT match different actions
        expect(permissionManager.hasPermission('user-1', 'container:abc123:delete')).toBe(false);
      });

      it('should match exact resource ID', () => {
        const roleId = roleManager.createRole({
          role_name: 'specific-container',
          display_name: 'Specific Container',
          description: 'Test',
          permissions: ['container:abc123:delete'],
          immutable: false,
          system: false,
          scope: 'org',
        });

        userRoleManager.assignOrgRole('user-1', roleId);

        // Should match specific container
        expect(permissionManager.hasPermission('user-1', 'container:abc123:delete')).toBe(true);

        // Should NOT match different container
        expect(permissionManager.hasPermission('user-1', 'container:xyz789:delete')).toBe(false);
      });

      it('should match with wildcard at end', () => {
        const roleId = roleManager.createRole({
          role_name: 'container-all',
          display_name: 'Container All',
          description: 'Test',
          permissions: ['container:*'],
          immutable: false,
          system: false,
          scope: 'org',
        });

        userRoleManager.assignOrgRole('user-1', roleId);

        // Should match any single-part container permission
        expect(permissionManager.hasPermission('user-1', 'container:create')).toBe(true);
        expect(permissionManager.hasPermission('user-1', 'container:delete')).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle permissions with different part counts', () => {
        const roleId = roleManager.createRole({
          role_name: 'test-role',
          display_name: 'Test Role',
          description: 'Test',
          permissions: ['a:b:c'],
          immutable: false,
          system: false,
          scope: 'org',
        });

        userRoleManager.assignOrgRole('user-1', roleId);

        // Different number of parts should not match
        expect(permissionManager.hasPermission('user-1', 'a:b')).toBe(false);
        expect(permissionManager.hasPermission('user-1', 'a:b:c:d')).toBe(false);
      });

      it('should be case-sensitive', () => {
        const roleId = roleManager.createRole({
          role_name: 'test-role',
          display_name: 'Test Role',
          description: 'Test',
          permissions: ['project:abc:Admin'],
          immutable: false,
          system: false,
          scope: 'org',
        });

        userRoleManager.assignOrgRole('user-1', roleId);

        expect(permissionManager.hasPermission('user-1', 'project:abc:Admin')).toBe(true);
        expect(permissionManager.hasPermission('user-1', 'project:abc:admin')).toBe(false);
      });
    });
  });

  describe('Multiple Roles', () => {
    it('should grant permission if ANY role has it', () => {
      const role1Id = roleManager.createRole({
        role_name: 'role1',
        display_name: 'Role 1',
        description: 'Test',
        permissions: ['test:permission1'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      const role2Id = roleManager.createRole({
        role_name: 'role2',
        display_name: 'Role 2',
        description: 'Test',
        permissions: ['test:permission2'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      userRoleManager.assignOrgRole('user-1', role1Id);
      userRoleManager.assignOrgRole('user-1', role2Id);

      // User should have permissions from both roles
      expect(permissionManager.hasPermission('user-1', 'test:permission1')).toBe(true);
      expect(permissionManager.hasPermission('user-1', 'test:permission2')).toBe(true);
      expect(permissionManager.hasPermission('user-1', 'test:permission3')).toBe(false);
    });
  });

  describe('Get Permissions', () => {
    it('should return empty array for user with no roles', () => {
      const permissions = permissionManager.getPermissions('user-1');
      expect(permissions).toHaveLength(0);
    });

    it('should return expanded permissions from roles', () => {
      const roleId = roleManager.createRole({
        role_name: 'test-role',
        display_name: 'Test Role',
        description: 'Test',
        permissions: ['perm1', 'perm2', 'perm3'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      userRoleManager.assignOrgRole('user-1', roleId);

      const permissions = permissionManager.getPermissions('user-1');
      expect(permissions).toHaveLength(3);
      expect(permissions).toContain('perm1');
      expect(permissions).toContain('perm2');
      expect(permissions).toContain('perm3');
    });
  });

  describe('Legacy Methods (Deprecated)', () => {
    it('should log warning for addPermission', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      permissionManager.addPermission('user-1', 'test:permission');

      // Should not grant permission
      expect(permissionManager.hasPermission('user-1', 'test:permission')).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should log warning for removePermission', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      permissionManager.removePermission('user-1', 'test:permission');

      consoleSpy.mockRestore();
    });
  });

  describe('Persistence', () => {
    it('should return empty object on save', () => {
      const serialized = permissionManager.saveToSerializable();
      expect(serialized).toEqual({});
    });

    it('should ignore legacy data on load', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      permissionManager.loadFromSerialized({
        permissions: {
          'user-1': ['old:permission'],
        },
      });

      // Should not have loaded any permissions
      expect(permissionManager.hasPermission('user-1', 'old:permission')).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('Without UserRoleManager', () => {
    it('should deny all permissions if UserRoleManager not set', () => {
      const standalonePM = new PermissionManager();
      // Don't set UserRoleManager

      expect(standalonePM.hasPermission('user-1', 'test:permission')).toBe(false);
    });
  });
});
