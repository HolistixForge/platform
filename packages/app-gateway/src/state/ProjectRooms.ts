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
// eslint-disable-next-line @typescript-eslint/no-var-requires
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
      const systemRequestData = {
        ip: 'system',
        user_id: 'system',
        jwt: {},
        headers: {},
        project_id,
      };

      this.eventProcessor
        .processEvent({ type: 'project:init', project_id }, systemRequestData)
        .catch((err) => {
          log(
            EPriority.Error,
            'PROJECT_ROOMS',
            `Failed to dispatch project:init for ${project_id}`,
            err
          );
        });
    }

    return room_id;
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
}
