import type * as Y from 'yjs';
import { EPriority, log } from '@holistix-forge/log';
import { makeUuid } from '@holistix-forge/simple-types';
import {
  getAllSharedDataAsJSON,
  setAllSharedDataFromJSON,
} from '@holistix-forge/collab-engine';
import { IPersistenceProvider } from './IPersistenceProvider';
import type { TReducersBackendExports } from '@holistix-forge/reducers';

// y-websocket utils for accessing the shared YJS document store
// This ensures we use the SAME docs that WebSocket clients connect to

const ywsUtils = require('y-websocket/bin/utils');

type TProjectSnapshot = Record<string, unknown>;
type TProjectSnapshotCollection = Record<string, TProjectSnapshot>;

/**
 * ProjectRoomsManager - Manage Multiple YJS Rooms
 *
 * One gateway manages multiple projects within an organization.
 * Each project gets its own:
 * - YJS document (shared with y-websocket for real-time collaboration)
 * - room_id (for WebSocket routing)
 *
 * IMPORTANT: This manager uses y-websocket's internal docs map (via ywsUtils.getYDoc)
 * to ensure that:
 * - The docs we persist are the SAME docs that WebSocket clients edit
 * - Changes made by clients are actually saved
 * - Restored data is available to clients when they connect
 *
 * Responsibilities:
 * - Initialize projects with y-websocket managed YJS documents
 * - Track project_id <-> room_id mapping
 * - Provide snapshots for persistence via IPersistenceProvider interface
 * - Apply snapshots when loading from Ganymede
 */
export interface ProjectRoomData {
  project_id: string;
  room_id: string;
  // Note: We don't store ydoc here anymore - we get it from y-websocket
}

export class ProjectRoomsManager implements IPersistenceProvider {
  // Map project_id -> room_id (no ydoc stored - we get it from y-websocket)
  private rooms: Map<string, ProjectRoomData> = new Map();
  private pendingSnapshots: Map<string, TProjectSnapshot> = new Map();
  private eventProcessor: TReducersBackendExports | null = null;

  /**
   * Set the event processor for dispatching project:init events
   */
  setEventProcessor(processor: TReducersBackendExports): void {
    this.eventProcessor = processor;
    log(EPriority.Info, 'PROJECT_ROOMS', 'Event processor set');
  }

  // IPersistenceProvider implementation

  loadFromSerialized(data: Record<string, unknown> | null | undefined): void {
    if (!data) {
      log(EPriority.Info, 'PROJECT_ROOMS', 'No project snapshot data to load');
      return;
    }

    // Data should be a map of project_id -> snapshot
    if (typeof data === 'object' && data !== null) {
      const projects = data as TProjectSnapshotCollection;
      this.applyProjectSnapshots(projects);
    } else {
      log(
        EPriority.Notice,
        'PROJECT_ROOMS',
        'Invalid project snapshot data format'
      );
    }
  }

  saveToSerializable(): Record<string, unknown> {
    return this.getProjectSnapshots();
  }

  /**
   * Initialize a project room
   * Gets YJS doc from y-websocket (creates it if needed), generates room_id, loads saved state
   *
   * IMPORTANT: Uses ywsUtils.getYDoc() to get the SAME doc that WebSocket clients will connect to
   */
  async initializeProject(project_id: string): Promise<string> {
    const existingRoom = this.rooms.get(project_id);
    if (existingRoom) {
      log(
        EPriority.Notice,
        'PROJECT_ROOMS',
        `Project ${project_id} already initialized`
      );
      return existingRoom.room_id;
    }

    // Generate a unique room_id for this project
    const room_id = makeUuid();

    // Get YJS doc from y-websocket (this creates it in y-websocket's internal map)
    // This is the SAME doc that WebSocket clients will connect to
    const ydoc: Y.Doc = ywsUtils.getYDoc(room_id);

    // Apply pending snapshot if we received one before initialization
    const pending = this.pendingSnapshots.get(project_id);
    if (pending) {
      setAllSharedDataFromJSON(ydoc, pending);
      this.pendingSnapshots.delete(project_id);
      log(
        EPriority.Info,
        'PROJECT_ROOMS',
        `Applied pending snapshot for ${project_id}`
      );
    }

    // Store only the mapping (ydoc is managed by y-websocket)
    this.rooms.set(project_id, {
      project_id,
      room_id,
    });

    log(
      EPriority.Info,
      'PROJECT_ROOMS',
      `Initialized project: ${project_id}, room: ${room_id}`
    );

    // Dispatch project:init event for modules to create default data
    if (this.eventProcessor) {
      log(
        EPriority.Info,
        'PROJECT_ROOMS',
        `Dispatching project:init event for ${project_id}...`
      );

      const systemRequestData = {
        ip: 'system',
        user_id: 'system',
        jwt: {},
        headers: {},
        project_id,
      };

      await this.eventProcessor
        .processEvent({ type: 'project:init', project_id }, systemRequestData)
        .then(() => {
          log(
            EPriority.Info,
            'PROJECT_ROOMS',
            `✅ project:init event processed successfully for ${project_id}`
          );
        })
        .catch((err) => {
          log(
            EPriority.Error,
            'PROJECT_ROOMS',
            `Failed to dispatch project:init for ${project_id}`,
            err
          );
        });
    } else {
      log(
        EPriority.Warning,
        'PROJECT_ROOMS',
        `No event processor set - skipping project:init for ${project_id}`
      );
    }

    // Initialize permissions after project:init
    await this.initializeProjectPermissions(project_id);

    log(
      EPriority.Info,
      'PROJECT_ROOMS',
      `✅ Project fully initialized: ${project_id}, room: ${room_id}`
    );

    return room_id;
  }

  /**
   * Initialize permissions for a project
   *
   * Called after project:init event dispatch.
   * Fetches project members and ensures they have appropriate roles.
   *
   * Logic:
   * - Org owners/admins already have access via org roles (no action needed)
   * - Project members in DB get checked for roles
   * - If no roles assigned, they won't have access (must be explicitly assigned roles)
   */
  private async initializeProjectPermissions(
    project_id: string
  ): Promise<void> {
    const { getGatewayInstances } = await import(
      '../initialization/gateway-instances'
    );
    const instances = getGatewayInstances();

    if (!instances) {
      log(
        EPriority.Warning,
        'PROJECT_ROOMS',
        `Cannot initialize permissions: Gateway instances not available for ${project_id}`
      );
      return;
    }

    log(
      EPriority.Info,
      'PROJECT_ROOMS',
      `Initializing permissions for project ${project_id}`
    );

    try {
      // Fetch project members from Ganymede
      const ganymedeUrl =
        process.env.GANYMEDE_URL || 'http://app-ganymede:3000';
      const orgToken = instances.gatewayState.getOrganizationToken();

      const response = await fetch(
        `${ganymedeUrl}/projects/${project_id}/members`,
        {
          headers: {
            Authorization: `Bearer ${orgToken}`,
          },
        }
      );

      if (!response.ok) {
        log(
          EPriority.Warning,
          'PROJECT_ROOMS',
          `Failed to fetch project members for ${project_id}: ${response.statusText}`
        );
        return;
      }

      const { members } = (await response.json()) as {
        members: Array<{ user_id: string; username: string; email: string }>;
      };

      log(
        EPriority.Info,
        'PROJECT_ROOMS',
        `Found ${members.length} project members for ${project_id}`
      );

      // Initialize permissions for each member
      // Note: Members in DB might not have any roles yet
      // They need to be assigned roles explicitly via member management API
      // This just logs who's in the project, doesn't auto-assign roles

      for (const member of members) {
        const projectRoles = instances.userRoleManager.getUserProjectRoles(
          member.user_id,
          project_id
        );
        const orgRoles = instances.userRoleManager.getUserOrgRoles(
          member.user_id
        );

        if (projectRoles.length > 0 || orgRoles.length > 0) {
          log(
            EPriority.Debug,
            'PROJECT_ROOMS',
            `User ${member.user_id} has ${orgRoles.length} org roles, ${projectRoles.length} project roles`
          );
        } else {
          log(
            EPriority.Warning,
            'PROJECT_ROOMS',
            `User ${member.user_id} is project member but has no roles assigned (no access)`
          );
        }
      }

      log(
        EPriority.Info,
        'PROJECT_ROOMS',
        `✅ Permission initialization complete for project ${project_id}`
      );
    } catch (error: any) {
      log(
        EPriority.Error,
        'PROJECT_ROOMS',
        `Failed to initialize permissions for ${project_id}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get room data for a project
   */
  getRoom(project_id: string): ProjectRoomData | undefined {
    return this.rooms.get(project_id);
  }

  /**
   * Get YJS document for a project
   * Returns the y-websocket managed doc (same one that clients connect to)
   */
  getYDoc(project_id: string): Y.Doc | undefined {
    const room = this.rooms.get(project_id);
    if (!room) return undefined;
    // Get doc from y-websocket (never creates a new one since we already initialized)
    return ywsUtils.getYDoc(room.room_id);
  }

  /**
   * Get room ID for a project
   */
  getRoomId(project_id: string): string | undefined {
    return this.rooms.get(project_id)?.room_id;
  }

  /**
   * Get all rooms (for WebSocket setup)
   */
  getAllRooms(): ProjectRoomData[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get all room IDs
   */
  getAllRoomIds(): string[] {
    return Array.from(this.rooms.values()).map((r) => r.room_id);
  }

  /**
   * Get all project IDs
   */
  getAllProjectIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Check if project is initialized
   */
  hasProject(project_id: string): boolean {
    return this.rooms.has(project_id);
  }

  /**
   * Get project ID by room ID (reverse lookup)
   */
  getProjectIdByRoomId(room_id: string): string | undefined {
    for (const room of this.rooms.values()) {
      if (room.room_id === room_id) {
        return room.project_id;
      }
    }
    return undefined;
  }

  /**
   * Get count of initialized projects
   */
  getProjectCount(): number {
    return this.rooms.size;
  }

  /**
   * Serialize all project YJS docs to JSON
   * Gets the actual docs from y-websocket (same ones clients are editing)
   */
  getProjectSnapshots(): TProjectSnapshotCollection {
    const snapshots: TProjectSnapshotCollection = {};
    for (const room of this.rooms.values()) {
      // Get the y-websocket managed doc
      const ydoc: Y.Doc = ywsUtils.getYDoc(room.room_id);
      snapshots[room.project_id] = getAllSharedDataAsJSON(ydoc);
    }
    return snapshots;
  }

  /**
   * Apply snapshots (either immediately to y-websocket doc, or queue until project initializes)
   */
  applyProjectSnapshots(
    snapshots: TProjectSnapshotCollection | undefined | null
  ): void {
    if (!snapshots) {
      return;
    }

    for (const [project_id, snapshot] of Object.entries(snapshots)) {
      const room = this.rooms.get(project_id);
      if (room) {
        // Get the y-websocket managed doc and apply snapshot
        const ydoc: Y.Doc = ywsUtils.getYDoc(room.room_id);
        setAllSharedDataFromJSON(ydoc, snapshot);
        log(
          EPriority.Info,
          'PROJECT_ROOMS',
          `Applied snapshot for project: ${project_id}`
        );
      } else {
        this.pendingSnapshots.set(project_id, snapshot);
        log(
          EPriority.Info,
          'PROJECT_ROOMS',
          `Queued snapshot for project ${project_id} (room not initialized yet)`
        );
      }
    }
  }

  /**
   * Cleanup/unload an idle project (aggressive cleanup)
   *
   * IMPORTANT: Caller MUST save project data to Ganymede BEFORE calling this method!
   * Once this method executes, the project is removed from this.rooms and will NOT
   * be included in future saveToSerializable() calls (autosave won't save it).
   *
   * Cleanup steps:
   * - Closes WebSocket connections (TODO: implement)
   * - Removes YJS doc from y-websocket (TODO: verify if needed)
   * - Removes from ProjectRoomsManager
   *
   * This is called when a project has been idle for extended period (5 min)
   */
  async cleanupProject(project_id: string): Promise<void> {
    const room = this.rooms.get(project_id);
    if (!room) {
      log(
        EPriority.Notice,
        'PROJECT_ROOMS',
        `Project ${project_id} not found for cleanup`
      );
      return;
    }

    log(
      EPriority.Info,
      'PROJECT_ROOMS',
      `Cleaning up idle project: ${project_id}`
    );

    // Note: Final snapshot should have been saved by caller before calling this method
    // No need to re-serialize the YJS doc here - that's expensive and wasteful

    // TODO: Close all WebSocket connections for this project
    // This requires access to the WebSocket server and filtering connections by room_id
    // For now, connections will be closed when clients try to reconnect and room is gone

    // Remove from ProjectRoomsManager
    // NOTE: After this, the project won't be included in saveToSerializable()
    this.rooms.delete(project_id);
    this.pendingSnapshots.delete(project_id);

    // Note: y-websocket docs are managed internally by y-websocket
    // They may be garbage collected automatically when no longer referenced
    // If we need explicit cleanup, we can call ywsUtils.getYDoc(room_id).destroy()
    // but this might cause issues if clients try to reconnect

    log(
      EPriority.Info,
      'PROJECT_ROOMS',
      `Project ${project_id} cleaned up and removed from ProjectRoomsManager`
    );
  }
}
