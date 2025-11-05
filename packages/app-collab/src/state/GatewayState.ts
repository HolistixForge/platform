import * as fs from 'fs';
import * as path from 'path';
import { log } from '@monorepo/log';
import { TGatewayStateData } from './types';

/**
 * GatewayState - Generic Persistent Storage
 *
 * Responsibilities:
 * - Load/save JSON data to disk
 * - Track dirty flag for efficient saves
 * - Auto-save every 30 seconds if dirty
 * - Atomic writes (tmp file + rename)
 * - Shutdown handlers
 *
 * Does NOT contain domain logic - just storage.
 * Used by PermissionManager, OAuthManager, ContainerTokenManager.
 */
export class GatewayState {
  private _data: TGatewayStateData;
  private _dirty: boolean = false;
  private _autoSaveInterval: NodeJS.Timeout | null = null;
  private _initialized: boolean = false;

  constructor() {
    // Initialize with empty state
    this._data = this.createEmptyState();
  }

  /**
   * Create empty state structure
   */
  private createEmptyState(): TGatewayStateData {
    return {
      organization_id: '',
      gateway_id: '',
      permissions: {},
      oauth_clients: {},
      oauth_authorization_codes: {},
      oauth_tokens: {},
      container_tokens: {},
      saved_at: new Date().toISOString(),
    };
  }

  /**
   * Initialize state with organization and gateway IDs
   */
  initialize(organization_id: string, gateway_id: string): void {
    this._data.organization_id = organization_id;
    this._data.gateway_id = gateway_id;
    this._initialized = true;
    this.markDirty();
    log(
      6,
      'GATEWAY_STATE',
      `Initialized for org: ${organization_id}, gateway: ${gateway_id}`
    );
  }

  /**
   * Get storage file path
   */
  private getFilePath(): string {
    if (!this._data.organization_id) {
      throw new Error('GatewayState not initialized - no organization_id');
    }
    return path.join(
      '/data',
      `gateway-state-${this._data.organization_id}.json`
    );
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    const dataDir = '/data';
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Load state from disk
   */
  async load(): Promise<boolean> {
    try {
      const filePath = this.getFilePath();

      if (!fs.existsSync(filePath)) {
        log(
          6,
          'GATEWAY_STATE',
          `No saved state found at ${filePath} - using empty state`
        );
        return false;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const loadedData = JSON.parse(fileContent) as TGatewayStateData;

      // Merge with current (preserves org_id, gateway_id if already set)
      this._data = {
        ...loadedData,
        organization_id:
          this._data.organization_id || loadedData.organization_id,
        gateway_id: this._data.gateway_id || loadedData.gateway_id,
      };

      this._dirty = false;
      log(6, 'GATEWAY_STATE', `Loaded state from ${filePath}`);
      return true;
    } catch (error: any) {
      log(3, 'GATEWAY_STATE', `Failed to load state: ${error.message}`);
      return false;
    }
  }

  /**
   * Save state to disk (atomic write)
   */
  async save(): Promise<void> {
    if (!this._initialized) {
      log(5, 'GATEWAY_STATE', 'Cannot save - not initialized');
      return;
    }

    try {
      this.ensureDataDirectory();

      const filePath = this.getFilePath();
      const tmpPath = `${filePath}.tmp`;

      // Update saved_at timestamp
      this._data.saved_at = new Date().toISOString();

      // Write to temp file first
      fs.writeFileSync(tmpPath, JSON.stringify(this._data, null, 2), 'utf-8');

      // Atomic rename
      fs.renameSync(tmpPath, filePath);

      this._dirty = false;
      log(7, 'GATEWAY_STATE', `Saved state to ${filePath}`);
    } catch (error: any) {
      log(3, 'GATEWAY_STATE', `Failed to save state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark state as dirty (needs saving)
   */
  markDirty(): void {
    this._dirty = true;
  }

  /**
   * Check if state is dirty
   */
  isDirty(): boolean {
    return this._dirty;
  }

  /**
   * Get read-only copy of state
   */
  getData(): Readonly<TGatewayStateData> {
    return this._data;
  }

  /**
   * Update state with an updater function
   * Automatically marks state as dirty
   */
  updateData(updater: (data: TGatewayStateData) => void): void {
    updater(this._data);
    this.markDirty();
  }

  /**
   * Start auto-save interval (saves every 30s if dirty)
   */
  startAutoSave(): void {
    if (this._autoSaveInterval) {
      log(5, 'GATEWAY_STATE', 'Auto-save already running');
      return;
    }

    this._autoSaveInterval = setInterval(() => {
      if (this._dirty) {
        log(7, 'GATEWAY_STATE', 'Auto-save triggered (state is dirty)');
        this.save();
      }
    }, 30000); // 30 seconds

    log(6, 'GATEWAY_STATE', 'Auto-save started (every 30s if dirty)');
  }

  /**
   * Stop auto-save interval
   */
  stopAutoSave(): void {
    if (this._autoSaveInterval) {
      clearInterval(this._autoSaveInterval);
      this._autoSaveInterval = null;
      log(6, 'GATEWAY_STATE', 'Auto-save stopped');
    }
  }

  /**
   * Shutdown: save state and cleanup
   */
  async shutdown(): Promise<void> {
    log(6, 'GATEWAY_STATE', 'Shutting down - saving state');
    this.stopAutoSave();
    if (this._dirty || this._initialized) {
      await this.save();
    }
  }
}

/**
 * Setup shutdown handlers to save state on exit
 */
export function setupShutdownHandlers(gatewayState: GatewayState): void {
  const shutdown = async (signal: string) => {
    log(6, 'GATEWAY', `Received ${signal} - shutting down gracefully`);
    await gatewayState.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
