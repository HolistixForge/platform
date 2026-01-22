import { RoleManager } from './RoleManager';
import { UserRoleManager } from './UserRoleManager';

describe('UserRoleManager', () => {
  let roleManager: RoleManager;
  let userRoleManager: UserRoleManager;
  let orgOwnerRoleId: string;
  let orgAdminRoleId: string;
  let projectRole1Id: string;
  let projectRole2Id: string;

  beforeEach(() => {
    roleManager = new RoleManager();
    roleManager.initializeDefaultRoles();
    userRoleManager = new UserRoleManager(roleManager);

    // Get system role IDs
    const ownerRole = roleManager.getRoleByName('org:owner');
    const adminRole = roleManager.getRoleByName('org:admin');
    orgOwnerRoleId = ownerRole!.role_id;
    orgAdminRoleId = adminRole!.role_id;

    // Create test project roles
    projectRole1Id = roleManager.createRole({
      role_name: 'developer',
      display_name: 'Developer',
      description: 'Developer role',
      permissions: ['test:permission1'],
      immutable: false,
      system: false,
      scope: 'project',
    });

    projectRole2Id = roleManager.createRole({
      role_name: 'viewer',
      display_name: 'Viewer',
      description: 'Viewer role',
      permissions: ['test:permission2'],
      immutable: false,
      system: false,
      scope: 'project',
    });
  });

  describe('Assign Org Role', () => {
    it('should assign org role to user', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);

      const roles = userRoleManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(1);
      expect(roles[0].role_name).toBe('org:owner');
    });

    it('should assign multiple org roles to user', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignOrgRole('user-1', orgAdminRoleId);

      const roles = userRoleManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(2);
      expect(roles.map((r) => r.role_name)).toContain('org:owner');
      expect(roles.map((r) => r.role_name)).toContain('org:admin');
    });

    it('should not duplicate role if already assigned', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId); // Duplicate

      const roles = userRoleManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(1);
    });

    it('should throw error if role does not exist', () => {
      expect(() => {
        userRoleManager.assignOrgRole('user-1', 'non-existent-role-id');
      }).toThrow('Role not found');
    });

    it('should throw error if trying to assign project role as org role', () => {
      expect(() => {
        userRoleManager.assignOrgRole('user-1', projectRole1Id);
      }).toThrow('Cannot assign project-scoped role');
    });
  });

  describe('Remove Org Role', () => {
    it('should remove org role from user', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignOrgRole('user-1', orgAdminRoleId);

      userRoleManager.removeOrgRole('user-1', orgOwnerRoleId);

      const roles = userRoleManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(1);
      expect(roles[0].role_name).toBe('org:admin');
    });

    it('should handle removing role from user with no assignments', () => {
      // Should not throw
      expect(() => {
        userRoleManager.removeOrgRole('user-1', orgOwnerRoleId);
      }).not.toThrow();
    });

    it('should clean up user entry if no roles left', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.removeOrgRole('user-1', orgOwnerRoleId);

      const roles = userRoleManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(0);
    });
  });

  describe('Assign Project Role', () => {
    it('should assign project role to user', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);

      const roles = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      expect(roles).toHaveLength(1);
      expect(roles[0].role_name).toBe('developer');
    });

    it('should assign multiple project roles to user', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole2Id);

      const roles = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      expect(roles).toHaveLength(2);
      expect(roles.map((r) => r.role_name)).toContain('developer');
      expect(roles.map((r) => r.role_name)).toContain('viewer');
    });

    it('should assign different roles for different projects', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-1', 'project-b', projectRole2Id);

      const rolesA = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      const rolesB = userRoleManager.getUserProjectRoles('user-1', 'project-b');

      expect(rolesA).toHaveLength(1);
      expect(rolesA[0].role_name).toBe('developer');

      expect(rolesB).toHaveLength(1);
      expect(rolesB[0].role_name).toBe('viewer');
    });

    it('should not duplicate role if already assigned', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id); // Duplicate

      const roles = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      expect(roles).toHaveLength(1);
    });

    it('should throw error if role does not exist', () => {
      expect(() => {
        userRoleManager.assignProjectRole('user-1', 'project-a', 'non-existent-role-id');
      }).toThrow('Role not found');
    });

    it('should throw error if trying to assign org role as project role', () => {
      expect(() => {
        userRoleManager.assignProjectRole('user-1', 'project-a', orgOwnerRoleId);
      }).toThrow('Cannot assign org-scoped role');
    });
  });

  describe('Remove Project Role', () => {
    it('should remove project role from user', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole2Id);

      userRoleManager.removeProjectRole('user-1', 'project-a', projectRole1Id);

      const roles = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      expect(roles).toHaveLength(1);
      expect(roles[0].role_name).toBe('viewer');
    });

    it('should handle removing role from user with no assignments', () => {
      // Should not throw
      expect(() => {
        userRoleManager.removeProjectRole('user-1', 'project-a', projectRole1Id);
      }).not.toThrow();
    });

    it('should clean up project entry if no roles left', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.removeProjectRole('user-1', 'project-a', projectRole1Id);

      const roles = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      expect(roles).toHaveLength(0);
    });
  });

  describe('Remove All Project Roles', () => {
    it('should remove all roles for a project', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole2Id);
      userRoleManager.assignProjectRole('user-1', 'project-b', projectRole1Id);

      userRoleManager.removeAllProjectRoles('user-1', 'project-a');

      const rolesA = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      const rolesB = userRoleManager.getUserProjectRoles('user-1', 'project-b');

      expect(rolesA).toHaveLength(0);
      expect(rolesB).toHaveLength(1); // project-b roles preserved
    });

    it('should handle removing roles from project with no assignments', () => {
      // Should not throw
      expect(() => {
        userRoleManager.removeAllProjectRoles('user-1', 'project-a');
      }).not.toThrow();
    });

    it('should clean up user entry if no roles left', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.removeAllProjectRoles('user-1', 'project-a');

      const roles = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      expect(roles).toHaveLength(0);
    });
  });

  describe('Get User Org Roles', () => {
    it('should return empty array for user with no roles', () => {
      const roles = userRoleManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(0);
    });

    it('should return org roles', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignOrgRole('user-1', orgAdminRoleId);

      const roles = userRoleManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(2);
      expect(roles.every((r) => r.scope === 'org')).toBe(true);
    });

    it('should filter out deleted roles', () => {
      const customOrgRoleId = roleManager.createRole({
        role_name: 'custom-org',
        display_name: 'Custom Org',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      userRoleManager.assignOrgRole('user-1', customOrgRoleId);
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);

      // Delete custom role
      roleManager.deleteRole(customOrgRoleId);

      const roles = userRoleManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(1); // Only org:owner remains
      expect(roles[0].role_name).toBe('org:owner');
    });
  });

  describe('Get User Project Roles', () => {
    it('should return empty array for user with no project roles', () => {
      const roles = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      expect(roles).toHaveLength(0);
    });

    it('should return project roles for specific project', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-1', 'project-b', projectRole2Id);

      const rolesA = userRoleManager.getUserProjectRoles('user-1', 'project-a');
      const rolesB = userRoleManager.getUserProjectRoles('user-1', 'project-b');

      expect(rolesA).toHaveLength(1);
      expect(rolesA[0].role_name).toBe('developer');

      expect(rolesB).toHaveLength(1);
      expect(rolesB[0].role_name).toBe('viewer');
    });
  });

  describe('Get All User Roles', () => {
    it('should return org roles only if no project_id provided', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);

      const roles = userRoleManager.getAllUserRoles('user-1');

      expect(roles).toHaveLength(1);
      expect(roles[0].role_name).toBe('org:owner');
    });

    it('should return org + project roles when project_id provided', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);

      const roles = userRoleManager.getAllUserRoles('user-1', 'project-a');

      expect(roles).toHaveLength(2);
      expect(roles.map((r) => r.role_name)).toContain('org:owner');
      expect(roles.map((r) => r.role_name)).toContain('developer');
    });

    it('should deduplicate roles', () => {
      // Assign same role at org and project level (edge case)
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      
      // Create another org role and assign it at both levels
      const customRoleId = roleManager.createRole({
        role_name: 'custom',
        display_name: 'Custom',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'org',
      });
      
      userRoleManager.assignOrgRole('user-1', customRoleId);

      const roles = userRoleManager.getAllUserRoles('user-1', 'project-a');

      // Should have unique roles
      const roleIds = roles.map((r) => r.role_id);
      expect(new Set(roleIds).size).toBe(roleIds.length);
    });
  });

  describe('Get User Permissions', () => {
    it('should return empty array for user with no roles', () => {
      const permissions = userRoleManager.getUserPermissions('user-1');
      expect(permissions).toHaveLength(0);
    });

    it('should expand permissions from org roles', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);

      const permissions = userRoleManager.getUserPermissions('user-1');

      expect(permissions).toContain('*'); // org:owner has wildcard
    });

    it('should expand permissions from org + project roles', () => {
      userRoleManager.assignOrgRole('user-1', orgAdminRoleId);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);

      const permissions = userRoleManager.getUserPermissions('user-1', 'project-a');

      // Should include permissions from both roles
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions).toContain('test:permission1'); // From project role
    });

    it('should deduplicate permissions', () => {
      // Create two roles with overlapping permissions
      const role1Id = roleManager.createRole({
        role_name: 'role1',
        display_name: 'Role 1',
        description: 'Test',
        permissions: ['test:permission1', 'test:permission2'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      const role2Id = roleManager.createRole({
        role_name: 'role2',
        display_name: 'Role 2',
        description: 'Test',
        permissions: ['test:permission2', 'test:permission3'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      userRoleManager.assignProjectRole('user-1', 'project-a', role1Id);
      userRoleManager.assignProjectRole('user-1', 'project-a', role2Id);

      const permissions = userRoleManager.getUserPermissions('user-1', 'project-a');

      // Should have 3 unique permissions
      expect(permissions).toHaveLength(3);
      expect(permissions).toContain('test:permission1');
      expect(permissions).toContain('test:permission2');
      expect(permissions).toContain('test:permission3');
    });
  });

  describe('Get Users With Role', () => {
    it('should return empty array if no users have role', () => {
      const users = userRoleManager.getUsersWithRole(orgOwnerRoleId);
      expect(users).toHaveLength(0);
    });

    it('should find users with org role', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignOrgRole('user-2', orgOwnerRoleId);
      userRoleManager.assignOrgRole('user-3', orgAdminRoleId);

      const users = userRoleManager.getUsersWithRole(orgOwnerRoleId);

      expect(users).toHaveLength(2);
      expect(users).toContain('user-1');
      expect(users).toContain('user-2');
    });

    it('should find users with project role', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-2', 'project-b', projectRole1Id);
      userRoleManager.assignProjectRole('user-3', 'project-a', projectRole2Id);

      const users = userRoleManager.getUsersWithRole(projectRole1Id);

      expect(users).toHaveLength(2);
      expect(users).toContain('user-1');
      expect(users).toContain('user-2');
    });

    it('should not duplicate users with role in multiple projects', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-1', 'project-b', projectRole1Id);

      const users = userRoleManager.getUsersWithRole(projectRole1Id);

      expect(users).toHaveLength(1);
      expect(users[0]).toBe('user-1');
    });
  });

  describe('Remove Role From All Users', () => {
    it('should remove role from all users org roles', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignOrgRole('user-2', orgOwnerRoleId);
      userRoleManager.assignOrgRole('user-3', orgAdminRoleId);

      userRoleManager.removeRoleFromAllUsers(orgOwnerRoleId);

      expect(userRoleManager.getUserOrgRoles('user-1')).toHaveLength(0);
      expect(userRoleManager.getUserOrgRoles('user-2')).toHaveLength(0);
      expect(userRoleManager.getUserOrgRoles('user-3')).toHaveLength(1); // org:admin preserved
    });

    it('should remove role from all users project roles', () => {
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-2', 'project-b', projectRole1Id);
      userRoleManager.assignProjectRole('user-3', 'project-a', projectRole2Id);

      userRoleManager.removeRoleFromAllUsers(projectRole1Id);

      expect(userRoleManager.getUserProjectRoles('user-1', 'project-a')).toHaveLength(0);
      expect(userRoleManager.getUserProjectRoles('user-2', 'project-b')).toHaveLength(0);
      expect(userRoleManager.getUserProjectRoles('user-3', 'project-a')).toHaveLength(1);
    });

    it('should clean up users with no roles left', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.removeRoleFromAllUsers(orgOwnerRoleId);

      const users = userRoleManager.getUsersWithRole(orgOwnerRoleId);
      expect(users).toHaveLength(0);
    });
  });

  describe('Persistence', () => {
    it('should serialize user-role assignments', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);
      userRoleManager.assignProjectRole('user-2', 'project-b', projectRole2Id);

      const serialized = userRoleManager.saveToSerializable();

      expect(serialized).toHaveProperty('user_roles');
      expect(typeof serialized.user_roles).toBe('object');

      const userRoles = serialized.user_roles as any;
      expect(userRoles['user-1']).toBeDefined();
      expect(userRoles['user-1'].org_roles).toContain(orgOwnerRoleId);
      expect(userRoles['user-1'].project_roles['project-a']).toContain(projectRole1Id);
      expect(userRoles['user-2'].project_roles['project-b']).toContain(projectRole2Id);
    });

    it('should deserialize user-role assignments', () => {
      userRoleManager.assignOrgRole('user-1', orgOwnerRoleId);
      userRoleManager.assignProjectRole('user-1', 'project-a', projectRole1Id);

      const serialized = userRoleManager.saveToSerializable();

      // Create new manager and deserialize
      const newManager = new UserRoleManager(roleManager);
      newManager.loadFromSerialized(serialized);

      const orgRoles = newManager.getUserOrgRoles('user-1');
      const projectRoles = newManager.getUserProjectRoles('user-1', 'project-a');

      expect(orgRoles).toHaveLength(1);
      expect(orgRoles[0].role_name).toBe('org:owner');

      expect(projectRoles).toHaveLength(1);
      expect(projectRoles[0].role_name).toBe('developer');
    });

    it('should handle empty data', () => {
      const newManager = new UserRoleManager(roleManager);
      newManager.loadFromSerialized(null);

      const roles = newManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(0);
    });

    it('should handle data without user_roles', () => {
      const newManager = new UserRoleManager(roleManager);
      newManager.loadFromSerialized({});

      const roles = newManager.getUserOrgRoles('user-1');
      expect(roles).toHaveLength(0);
    });
  });
});
