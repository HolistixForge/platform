import { RoleManager, Role } from './RoleManager';

describe('RoleManager', () => {
  let roleManager: RoleManager;

  beforeEach(() => {
    roleManager = new RoleManager();
  });

  describe('Initialization', () => {
    it('should initialize with default system roles', () => {
      roleManager.initializeDefaultRoles();

      const roles = roleManager.getAllRoles();
      expect(roles.length).toBe(2); // org:owner and org:admin

      const ownerRole = roleManager.getRoleByName('org:owner');
      expect(ownerRole).toBeDefined();
      expect(ownerRole?.permissions).toEqual(['*']);
      expect(ownerRole?.immutable).toBe(true);
      expect(ownerRole?.system).toBe(true);
      expect(ownerRole?.scope).toBe('org');

      const adminRole = roleManager.getRoleByName('org:admin');
      expect(adminRole).toBeDefined();
      expect(adminRole?.permissions.length).toBeGreaterThan(0);
      expect(adminRole?.immutable).toBe(true);
      expect(adminRole?.system).toBe(true);
      expect(adminRole?.scope).toBe('org');
    });

    it('should not initialize twice', () => {
      roleManager.initializeDefaultRoles();
      const firstRoles = roleManager.getAllRoles();

      roleManager.initializeDefaultRoles();
      const secondRoles = roleManager.getAllRoles();

      expect(secondRoles.length).toBe(firstRoles.length);
    });
  });

  describe('Create Role', () => {
    beforeEach(() => {
      roleManager.initializeDefaultRoles();
    });

    it('should create a custom role', () => {
      const role_id = roleManager.createRole({
        role_name: 'developer',
        display_name: 'Developer',
        description: 'Can create and manage containers',
        permissions: [
          'user-containers:[user-container:*]:create',
          'user-containers:[user-container:*]:delete',
        ],
        immutable: false,
        system: false,
        scope: 'project',
      });

      expect(role_id).toBeDefined();
      expect(typeof role_id).toBe('string');

      const role = roleManager.getRole(role_id);
      expect(role).toBeDefined();
      expect(role?.role_name).toBe('developer');
      expect(role?.display_name).toBe('Developer');
      expect(role?.permissions).toHaveLength(2);
      expect(role?.immutable).toBe(false);
      expect(role?.system).toBe(false);
      expect(role?.scope).toBe('project');
    });

    it('should throw error if role_name already exists', () => {
      roleManager.createRole({
        role_name: 'developer',
        display_name: 'Developer',
        description: 'Test role',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      expect(() => {
        roleManager.createRole({
          role_name: 'developer', // Duplicate
          display_name: 'Another Developer',
          description: 'Test role',
          permissions: ['test:permission'],
          immutable: false,
          system: false,
          scope: 'project',
        });
      }).toThrow('Role name already exists: developer');
    });

    it('should throw error if role_name is missing', () => {
      expect(() => {
        roleManager.createRole({
          role_name: '',
          display_name: 'Test',
          description: 'Test',
          permissions: ['test:permission'],
          immutable: false,
          system: false,
          scope: 'project',
        });
      }).toThrow('role_name is required');
    });

    it('should throw error if display_name is missing', () => {
      expect(() => {
        roleManager.createRole({
          role_name: 'test',
          display_name: '',
          description: 'Test',
          permissions: ['test:permission'],
          immutable: false,
          system: false,
          scope: 'project',
        });
      }).toThrow('display_name is required');
    });

    it('should throw error if scope is invalid', () => {
      expect(() => {
        roleManager.createRole({
          role_name: 'test',
          display_name: 'Test',
          description: 'Test',
          permissions: ['test:permission'],
          immutable: false,
          system: false,
          scope: 'invalid' as any,
        });
      }).toThrow('scope must be "org" or "project"');
    });

    it('should throw error if permissions is empty', () => {
      expect(() => {
        roleManager.createRole({
          role_name: 'test',
          display_name: 'Test',
          description: 'Test',
          permissions: [],
          immutable: false,
          system: false,
          scope: 'project',
        });
      }).toThrow('permissions array cannot be empty');
    });

    it('should throw error if permissions is not an array', () => {
      expect(() => {
        roleManager.createRole({
          role_name: 'test',
          display_name: 'Test',
          description: 'Test',
          permissions: 'not-an-array' as any,
          immutable: false,
          system: false,
          scope: 'project',
        });
      }).toThrow('permissions must be an array');
    });
  });

  describe('Get Role', () => {
    beforeEach(() => {
      roleManager.initializeDefaultRoles();
    });

    it('should get role by ID', () => {
      const role_id = roleManager.createRole({
        role_name: 'test-role',
        display_name: 'Test Role',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      const role = roleManager.getRole(role_id);
      expect(role).toBeDefined();
      expect(role?.role_name).toBe('test-role');
    });

    it('should return undefined for non-existent role ID', () => {
      const role = roleManager.getRole('non-existent-id');
      expect(role).toBeUndefined();
    });

    it('should get role by name', () => {
      roleManager.createRole({
        role_name: 'test-role',
        display_name: 'Test Role',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      const role = roleManager.getRoleByName('test-role');
      expect(role).toBeDefined();
      expect(role?.display_name).toBe('Test Role');
    });

    it('should return undefined for non-existent role name', () => {
      const role = roleManager.getRoleByName('non-existent-name');
      expect(role).toBeUndefined();
    });
  });

  describe('Update Role', () => {
    beforeEach(() => {
      roleManager.initializeDefaultRoles();
    });

    it('should update custom role', () => {
      const role_id = roleManager.createRole({
        role_name: 'developer',
        display_name: 'Developer',
        description: 'Original description',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      roleManager.updateRole(role_id, {
        display_name: 'Senior Developer',
        description: 'Updated description',
        permissions: ['test:permission1', 'test:permission2'],
      });

      const updated = roleManager.getRole(role_id);
      expect(updated?.display_name).toBe('Senior Developer');
      expect(updated?.description).toBe('Updated description');
      expect(updated?.permissions).toEqual(['test:permission1', 'test:permission2']);
      expect(updated?.role_name).toBe('developer'); // Should not change
    });

    it('should throw error when updating immutable role', () => {
      const ownerRole = roleManager.getRoleByName('org:owner');
      expect(ownerRole).toBeDefined();

      expect(() => {
        roleManager.updateRole(ownerRole!.role_id, {
          display_name: 'Modified Owner',
        });
      }).toThrow('Cannot update immutable role: org:owner');
    });

    it('should throw error when updating non-existent role', () => {
      expect(() => {
        roleManager.updateRole('non-existent-id', {
          display_name: 'Test',
        });
      }).toThrow('Role not found: non-existent-id');
    });

    it('should validate permissions on update', () => {
      const role_id = roleManager.createRole({
        role_name: 'test',
        display_name: 'Test',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      expect(() => {
        roleManager.updateRole(role_id, {
          permissions: [],
        });
      }).toThrow('permissions array cannot be empty');
    });
  });

  describe('Delete Role', () => {
    beforeEach(() => {
      roleManager.initializeDefaultRoles();
    });

    it('should delete custom role', () => {
      const role_id = roleManager.createRole({
        role_name: 'temporary-role',
        display_name: 'Temporary',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      expect(roleManager.getRole(role_id)).toBeDefined();

      roleManager.deleteRole(role_id);

      expect(roleManager.getRole(role_id)).toBeUndefined();
      expect(roleManager.getRoleByName('temporary-role')).toBeUndefined();
    });

    it('should throw error when deleting immutable role', () => {
      const ownerRole = roleManager.getRoleByName('org:owner');
      expect(ownerRole).toBeDefined();

      expect(() => {
        roleManager.deleteRole(ownerRole!.role_id);
      }).toThrow('Cannot delete immutable role: org:owner');
    });

    it('should throw error when deleting non-existent role', () => {
      expect(() => {
        roleManager.deleteRole('non-existent-id');
      }).toThrow('Role not found: non-existent-id');
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      roleManager.initializeDefaultRoles();
    });

    it('should get all roles', () => {
      roleManager.createRole({
        role_name: 'custom1',
        display_name: 'Custom 1',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      roleManager.createRole({
        role_name: 'custom2',
        display_name: 'Custom 2',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      const allRoles = roleManager.getAllRoles();
      expect(allRoles.length).toBe(4); // 2 system + 2 custom
    });

    it('should get roles by scope', () => {
      roleManager.createRole({
        role_name: 'org-custom',
        display_name: 'Org Custom',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      roleManager.createRole({
        role_name: 'project-custom',
        display_name: 'Project Custom',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      const orgRoles = roleManager.getRolesByScope('org');
      expect(orgRoles.length).toBe(3); // org:owner, org:admin, org-custom

      const projectRoles = roleManager.getRolesByScope('project');
      expect(projectRoles.length).toBe(1); // project-custom
    });

    it('should get system roles', () => {
      roleManager.createRole({
        role_name: 'custom',
        display_name: 'Custom',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      const systemRoles = roleManager.getSystemRoles();
      expect(systemRoles.length).toBe(2); // org:owner, org:admin
      expect(systemRoles.every((r) => r.system)).toBe(true);
    });

    it('should get custom roles', () => {
      roleManager.createRole({
        role_name: 'custom1',
        display_name: 'Custom 1',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'org',
      });

      roleManager.createRole({
        role_name: 'custom2',
        display_name: 'Custom 2',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      const customRoles = roleManager.getCustomRoles();
      expect(customRoles.length).toBe(2);
      expect(customRoles.every((r) => !r.system)).toBe(true);
    });
  });

  describe('Persistence', () => {
    beforeEach(() => {
      roleManager.initializeDefaultRoles();
    });

    it('should serialize roles', () => {
      roleManager.createRole({
        role_name: 'custom-role',
        display_name: 'Custom Role',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      const serialized = roleManager.saveToSerializable();

      expect(serialized).toHaveProperty('roles');
      expect(typeof serialized.roles).toBe('object');

      const roles = serialized.roles as Record<string, Role>;
      expect(Object.keys(roles).length).toBe(3); // 2 system + 1 custom

      // Check custom role is in serialized data
      const customRole = Object.values(roles).find((r) => r.role_name === 'custom-role');
      expect(customRole).toBeDefined();
      expect(customRole?.display_name).toBe('Custom Role');
    });

    it('should deserialize roles', () => {
      // Create a custom role
      const role_id = roleManager.createRole({
        role_name: 'custom-role',
        display_name: 'Custom Role',
        description: 'Test',
        permissions: ['test:permission'],
        immutable: false,
        system: false,
        scope: 'project',
      });

      // Serialize
      const serialized = roleManager.saveToSerializable();

      // Create new manager and deserialize
      const newManager = new RoleManager();
      newManager.loadFromSerialized(serialized);

      // Verify roles are loaded
      const loadedRole = newManager.getRole(role_id);
      expect(loadedRole).toBeDefined();
      expect(loadedRole?.role_name).toBe('custom-role');
      expect(loadedRole?.display_name).toBe('Custom Role');

      // Verify system roles are present
      expect(newManager.getRoleByName('org:owner')).toBeDefined();
      expect(newManager.getRoleByName('org:admin')).toBeDefined();
    });

    it('should initialize defaults if no data provided', () => {
      const newManager = new RoleManager();
      newManager.loadFromSerialized(null);

      const ownerRole = newManager.getRoleByName('org:owner');
      expect(ownerRole).toBeDefined();

      const adminRole = newManager.getRoleByName('org:admin');
      expect(adminRole).toBeDefined();
    });

    it('should ensure default system roles exist after deserialization', () => {
      // Serialize with only custom roles (simulate old data without system roles)
      const customRoleId = 'custom-uuid';
      const oldData = {
        roles: {
          [customRoleId]: {
            role_id: customRoleId,
            role_name: 'old-custom',
            display_name: 'Old Custom',
            description: 'Test',
            permissions: ['test:permission'],
            immutable: false,
            system: false,
            scope: 'project' as const,
          },
        },
      };

      const newManager = new RoleManager();
      newManager.loadFromSerialized(oldData);

      // System roles should be added
      expect(newManager.getRoleByName('org:owner')).toBeDefined();
      expect(newManager.getRoleByName('org:admin')).toBeDefined();

      // Old custom role should be preserved
      expect(newManager.getRole(customRoleId)).toBeDefined();
    });
  });
});
