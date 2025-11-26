import * as Y from 'yjs';
import { EPriority, log } from '@monorepo/log';
import { makeUuid } from '@monorepo/simple-types';
import {
  getAllSharedDataAsJSON,
  setAllSharedDataFromJSON,
} from '@monorepo/collab-engine';
import { IPersistenceProvider } from './IPersistenceProvider';

type TProjectSnapshot = Record<string, unknown>;
type TProjectSnapshotCollection = Record<string, TProjectSnapshot>;

/**
 * ProjectRoomsManager - Manage Multiple YJS Rooms
 *
 * One gateway manages multiple projects.
 * Each project gets its own:
 * - YJS document (for collaborative state)
 * - room_id (for WebSocket routing)
 *
 * Responsibilities:
 * - Create and manage YJS documents per project
 * - Track room_id for each project
 * - Provide snapshots for persistence via IPersistenceProvider interface
 * - Provide access to rooms for WebSocket and modules
 */
export interface ProjectRoomData {
  project_id: string;
  room_id: string;
  ydoc: Y.Doc;
}

export class ProjectRoomsManager implements IPersistenceProvider {
  private rooms: Map<string, ProjectRoomData> = new Map();
  private pendingSnapshots: Map<string, TProjectSnapshot> = new Map();

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
   * Creates YJS doc, generates room_id, loads saved state
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

    const room_id = makeUuid();
    const ydoc = new Y.Doc();

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

    this.rooms.set(project_id, {
      project_id,
      room_id,
      ydoc,
    });

    log(
      EPriority.Info,
      'PROJECT_ROOMS',
      `Initialized project: ${project_id}, room: ${room_id}`
    );
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
   */
  getYDoc(project_id: string): Y.Doc | undefined {
    return this.rooms.get(project_id)?.ydoc;
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
   */
  getProjectSnapshots(): TProjectSnapshotCollection {
    const snapshots: TProjectSnapshotCollection = {};
    for (const room of this.rooms.values()) {
      snapshots[room.project_id] = getAllSharedDataAsJSON(room.ydoc);
    }
    return snapshots;
  }

  /**
   * Apply snapshots (either immediately or queue until project initializes)
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
        setAllSharedDataFromJSON(room.ydoc, snapshot);
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
