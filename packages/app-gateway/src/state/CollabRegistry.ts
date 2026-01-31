import { EPriority, log } from '@holistix-forge/log';
import { YjsServerCollab, ICollabRegistry } from '@holistix-forge/collab';
import { ProjectRoomsManager } from './ProjectRooms';

/**
 * Shared data schema entry
 * Records what type (map/array) each shared data key should be
 */
type SharedDataSchemaEntry = {
  sdtype: 'map' | 'array';
  moduleName: string;
  name: string;
};

/**
 * CollabRegistry - Per-Project Collab Instance Manager
 *
 * In the multi-project architecture, each project has its own YJS document.
 * This registry:
 * 1. Tracks the shared data schema (what maps/arrays each module needs)
 * 2. Creates per-project YjsServerCollab instances on demand
 * 3. Applies the schema to new collab instances
 *
 * Usage:
 * - At module load time: call registerSharedData() to define schema
 * - At event processing time: call getCollabForProject() to get project-specific collab
 */
export class CollabRegistry implements ICollabRegistry {
  private schema: Map<string, SharedDataSchemaEntry> = new Map();
  private collabs: Map<string, YjsServerCollab> = new Map();
  private projectRooms: ProjectRoomsManager | null = null;

  /**
   * Set the ProjectRoomsManager reference
   * Must be called before getCollabForProject()
   */
  setProjectRooms(projectRooms: ProjectRoomsManager): void {
    if (this.projectRooms) {
      throw new Error('CollabRegistry: ProjectRoomsManager already set');
    }
    this.projectRooms = projectRooms;
    log(EPriority.Info, 'COLLAB_REGISTRY', 'ProjectRooms manager set');
  }

  /**
   * Register shared data schema
   * Called at module load time to define what maps/arrays each module needs
   *
   * @param sdtype - 'map' or 'array'
   * @param moduleName - Module name (e.g., 'whiteboard')
   * @param name - Data name (e.g., 'graphViews')
   */
  registerSharedData(
    sdtype: 'map' | 'array',
    moduleName: string,
    name: string
  ): void {
    const fullname = `${moduleName}:${name}`;
    this.schema.set(fullname, { sdtype, moduleName, name });
    log(
      EPriority.Debug,
      'COLLAB_REGISTRY',
      `Registered schema: ${fullname} (${sdtype})`
    );
  }

  /**
   * Get collab instance for a specific project
   * Creates a new instance if one doesn't exist
   *
   * @param project_id - Project ID
   * @returns YjsServerCollab instance for the project
   * @throws Error if project is not initialized or ProjectRooms not set
   */
  getCollabForProject(project_id: string): YjsServerCollab {
    // Return cached instance if available
    const existing = this.collabs.get(project_id);
    if (existing) {
      return existing;
    }

    // Validate ProjectRooms is set
    if (!this.projectRooms) {
      throw new Error(
        'CollabRegistry: ProjectRooms not set. Call setProjectRooms() first.'
      );
    }

    // Get room_id for this project
    const room_id = this.projectRooms.getRoomId(project_id);
    if (!room_id) {
      throw new Error(
        `CollabRegistry: Project ${project_id} not initialized. No room_id found.`
      );
    }

    // Create new collab instance
    const collab = new YjsServerCollab({
      type: 'yjs-server',
      room_id,
    });

    // Apply schema - create all shared data wrappers
    for (const [, entry] of this.schema) {
      if (entry.sdtype === 'map') {
        collab.loadSharedData('map', entry.moduleName, entry.name);
      } else {
        collab.loadSharedData('array', entry.moduleName, entry.name);
      }
    }

    // Cache and return
    this.collabs.set(project_id, collab);
    log(
      EPriority.Info,
      'COLLAB_REGISTRY',
      `Created collab for project ${project_id} (room: ${room_id})`
    );

    return collab;
  }

  /**
   * Check if a project has an initialized collab
   */
  hasCollab(project_id: string): boolean {
    return this.collabs.has(project_id);
  }

  /**
   * Get count of initialized collabs
   */
  getCollabCount(): number {
    return this.collabs.size;
  }

  /**
   * Get schema size (number of registered shared data types)
   */
  getSchemaSize(): number {
    return this.schema.size;
  }

  /**
   * Clear collab for a project (e.g., on project deletion)
   */
  clearCollab(project_id: string): void {
    this.collabs.delete(project_id);
    log(
      EPriority.Info,
      'COLLAB_REGISTRY',
      `Cleared collab for project ${project_id}`
    );
  }
}

