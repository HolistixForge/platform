import * as fs from 'fs';
import * as path from 'path';
import * as Y from 'yjs';
import {
  getAllSharedDataAsJSON,
  setAllSharedDataFromJSON,
} from '@monorepo/collab-engine';

/**
 * ProjectPersistence - Save/Load YJS State Per Project
 *
 * Each project gets its own directory:
 * /data/project-{project_id}/
 *   ├── 1699123456789.json  (timestamped saves)
 *   ├── 1699123567890.json
 *   └── 1699123678901.json
 *
 * Responsibilities:
 * - Load latest saved state for a project
 * - Save project state with timestamp
 * - Cleanup old saves (keep last N)
 * - Ensure storage directory exists
 */
export class ProjectPersistence {
  private readonly project_id: string;
  private readonly storageDir: string;
  private readonly keepLast: number = 10; // Keep last 10 saves

  constructor(project_id: string) {
    this.project_id = project_id;
    this.storageDir = path.join('/data', `project-${project_id}`);
  }

  /**
   * Ensure project storage directory exists
   */
  private ensureDirectory(): void {
    if (!fs.existsSync('/data')) {
      fs.mkdirSync('/data', { recursive: true });
    }
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Get all saved files, sorted by timestamp (newest first)
   */
  private getSavedFiles(): Array<{ path: string; timestamp: number }> {
    if (!fs.existsSync(this.storageDir)) {
      return [];
    }

    try {
      const files = fs
        .readdirSync(this.storageDir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => ({
          path: path.join(this.storageDir, file),
          timestamp: parseInt(file.replace('.json', ''), 10),
        }))
        .filter((f) => !isNaN(f.timestamp))
        .sort((a, b) => b.timestamp - a.timestamp); // Newest first

      return files;
    } catch (error) {
      console.error(
        `Failed to list saved files for ${this.project_id}:`,
        error
      );
      return [];
    }
  }

  /**
   * Load latest saved state into YJS document
   * Returns true if loaded, false if no saved state found
   */
  async load(ydoc: Y.Doc): Promise<boolean> {
    const files = this.getSavedFiles();

    if (files.length === 0) {
      console.log(`No saved state found for project: ${this.project_id}`);
      return false;
    }

    const latestFile = files[0];

    try {
      const savedData = fs.readFileSync(latestFile.path, 'utf-8');
      const jsonData = JSON.parse(savedData);
      setAllSharedDataFromJSON(ydoc, jsonData);
      console.log(`Loaded project ${this.project_id} from ${latestFile.path}`);
      return true;
    } catch (error: any) {
      console.error(`Failed to load ${this.project_id}:`, error.message);
      return false;
    }
  }

  /**
   * Save YJS document state to timestamped file
   */
  async save(ydoc: Y.Doc): Promise<void> {
    try {
      this.ensureDirectory();

      const timestamp = Date.now();
      const filename = path.join(this.storageDir, `${timestamp}.json`);
      const savedData = JSON.stringify(getAllSharedDataAsJSON(ydoc), null, 2);

      // Atomic write (tmp + rename)
      const tmpPath = `${filename}.tmp`;
      fs.writeFileSync(tmpPath, savedData, 'utf-8');
      fs.renameSync(tmpPath, filename);

      console.log(`Saved project ${this.project_id} to ${filename}`);

      // Cleanup old files
      this.cleanupOldFiles();
    } catch (error: any) {
      console.error(`Failed to save ${this.project_id}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete old save files, keeping only the last N
   */
  private cleanupOldFiles(): void {
    try {
      const files = this.getSavedFiles();

      if (files.length > this.keepLast) {
        const toDelete = files.slice(this.keepLast);
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
        }
        console.log(
          `Cleaned up ${toDelete.length} old saves for ${this.project_id}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to cleanup old files for ${this.project_id}:`,
        error
      );
    }
  }

  /**
   * Get storage path for this project
   */
  getStoragePath(): string {
    return this.storageDir;
  }
}
