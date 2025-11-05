import * as Y from 'yjs';
import { log } from '@monorepo/log';
import { makeUuid } from '@monorepo/simple-types';
import { ProjectPersistence } from './ProjectPersistence';

/**
 * ProjectRoomsManager - Manage Multiple YJS Rooms
 * 
 * One gateway manages multiple projects.
 * Each project gets its own:
 * - YJS document (for collaborative state)
 * - room_id (for WebSocket routing)
 * - persistence (saved to /data/project-{id}/)
 * 
 * Responsibilities:
 * - Create and manage YJS documents per project
 * - Track room_id for each project
 * - Coordinate with ProjectPersistence for save/load
 * - Provide access to rooms for WebSocket and modules
 */

export interface ProjectRoomData {
  project_id: string;
  room_id: string;
  ydoc: Y.Doc;
  persistence: ProjectPersistence;
}

export class ProjectRoomsManager {
  private rooms: Map<string, ProjectRoomData> = new Map();
  private autoSaveTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize a project room
   * Creates YJS doc, generates room_id, loads saved state
   */
  async initializeProject(project_id: string): Promise<string> {
    if (this.rooms.has(project_id)) {
      log(5, 'PROJECT_ROOMS', `Project ${project_id} already initialized`);
      return this.rooms.get(project_id)!.room_id;
    }

    const room_id = makeUuid();
    const ydoc = new Y.Doc();

    // Load saved state
    const persistence = new ProjectPersistence(project_id);
    await persistence.load(ydoc);

    this.rooms.set(project_id, {
      project_id,
      room_id,
      ydoc,
      persistence,
    });

    log(6, 'PROJECT_ROOMS', `Initialized project: ${project_id}, room: ${room_id}`);
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
   * Save all project states
   * Called periodically and on shutdown
   */
  async saveAll(): Promise<void> {
    log(7, 'PROJECT_ROOMS', `Saving ${this.rooms.size} project rooms`);
    
    for (const room of this.rooms.values()) {
      try {
        await room.persistence.save(room.ydoc);
        log(7, 'PROJECT_ROOMS', `Saved project: ${room.project_id}`);
      } catch (error: any) {
        log(3, 'PROJECT_ROOMS', `Failed to save ${room.project_id}: ${error.message}`);
      }
    }
  }

  /**
   * Start auto-save for all projects
   * Saves every 2 minutes
   */
  startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(() => {
      this.saveAll();
    }, 120000); // 2 minutes

    log(6, 'PROJECT_ROOMS', 'Auto-save started (every 2 minutes)');
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      log(6, 'PROJECT_ROOMS', 'Auto-save stopped');
    }
  }

  /**
   * Shutdown: save all projects
   */
  async shutdown(): Promise<void> {
    log(6, 'PROJECT_ROOMS', 'Shutting down - saving all projects');
    this.stopAutoSave();
    await this.saveAll();
  }

  /**
   * Get count of initialized projects
   */
  getProjectCount(): number {
    return this.rooms.size;
  }
}

