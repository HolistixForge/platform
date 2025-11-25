/**
 * Permission Registry
 * 
 * Allows modules to register their permissions during module loading.
 * Permissions are compiled and can be retrieved via gateway API endpoints.
 */

export type PermissionDefinition = {
  permission: string; // Full permission string
  module: string;
  resourcePath: string; // e.g., "user-container:*" or "user-container:*/service:*"
  action: string;
  description?: string;
};

export class PermissionRegistry {
  private permissions: Map<string, PermissionDefinition> = new Map();

  /**
   * Register a permission definition from a module
   * Format: {module}:[{resourcePath}]:{action}
   * Resource path can include subresources: {type}:{id}/{subtype}:{id}/...
   *
   * @param permission - Full permission string (e.g., "user-containers:[user-container:*]:create")
   * @param definition - Permission metadata (resourcePath, action, description)
   */
  register(
    permission: string,
    definition: Omit<PermissionDefinition, 'permission' | 'module'>
  ): void {
    // Parse module name from permission string
    const moduleMatch = permission.match(/^([a-z0-9-]+):\[/);
    if (!moduleMatch) {
      throw new Error(`Invalid permission format: ${permission}`);
    }
    const module = moduleMatch[1];

    // Validate format
    // Pattern: {module}:[{resource-path}]:{action}
    // Resource path: {type}:{id|*}(/{type}:{id|*})*
    const pattern =
      /^[a-z0-9-]+:\[([a-z0-9-]+:(?:\*|[a-z0-9-]+)(?:\/[a-z0-9-]+:(?:\*|[a-z0-9-]+))*)\]:[a-z0-9-]+$/;
    if (!pattern.test(permission)) {
      throw new Error(`Invalid permission format: ${permission}`);
    }

    this.permissions.set(permission, {
      permission,
      module,
      ...definition,
    });
  }

  /**
   * Get all registered permissions
   */
  getAll(): PermissionDefinition[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Get permissions for a specific module
   */
  getByModule(module: string): PermissionDefinition[] {
    return Array.from(this.permissions.values()).filter(
      (p) => p.module === module
    );
  }

  /**
   * Get permission by full string
   */
  get(permission: string): PermissionDefinition | undefined {
    return this.permissions.get(permission);
  }
}

