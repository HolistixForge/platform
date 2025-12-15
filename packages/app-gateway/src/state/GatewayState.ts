import { EPriority, log } from '@holistix-forge/log';
import { IPersistenceProvider } from './IPersistenceProvider';
import { createGanymedeClient, GanymedeClient } from '../lib/ganymede-client';
import { TJson } from '@holistix-forge/simple-types';

type TGatewayDataSnapshot = Record<string, unknown>;

/**
 * GatewayState - Registry for Persistence Providers with Ganymede Sync
 *
 * Responsibilities:
 * - Register managers and other components that need persistence
 * - Collect data from all registered providers
 * - Restore data to all registered providers
 * - Periodically push data to Ganymede (auto-save)
 * - Push data on shutdown
 * - Pull data from Ganymede on startup/allocation
 *
 * Does NOT store data itself - each provider manages its own data.
 * Just coordinates collection, restoration, and sync with Ganymede.
 */
export class GatewayState {
  private providers: Map<string, IPersistenceProvider> = new Map();
  private _initialized = false;
  private organizationId = '';
  private gatewayId = '';
  private organizationToken: string | null = null;
  private ganymedeClient: GanymedeClient | null = null;
  private autosaveTimer: NodeJS.Timeout | null = null;
  private pulledData: TGatewayDataSnapshot | null = null;

  constructor() {
    // Initialize Ganymede client (will be updated with token when organization context is set)
    this.ganymedeClient = createGanymedeClient();
  }

  /**
   * Register a persistence provider with an ID
   * Loads data from pulled snapshot if available
   * @param id - Unique identifier (e.g., 'permissions', 'oauth', 'containers', 'projects')
   * @param provider - Provider that implements IPersistenceProvider
   */
  register(id: string, provider: IPersistenceProvider): void {
    if (this.providers.has(id)) {
      log(
        EPriority.Warning,
        'GATEWAY_STATE',
        `Warning: Provider with id '${id}' already registered, replacing`
      );
    }
    this.providers.set(id, provider);
    log(
      EPriority.Info,
      'GATEWAY_STATE',
      `Registered persistence provider: ${id}`
    );

    // Load data from pulled snapshot if available
    if (this.pulledData && this.pulledData[id] !== undefined) {
      try {
        provider.loadFromSerialized(
          this.pulledData[id] as Record<string, unknown> | null | undefined
        );
        log(EPriority.Info, 'GATEWAY_STATE', `Loaded data for provider: ${id}`);
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_STATE',
          `Failed to load data for provider '${id}': ${error.message}`
        );
      }
    }
  }

  /**
   * Unregister a persistence provider
   */
  unregister(id: string): void {
    this.providers.delete(id);
    log(
      EPriority.Info,
      'GATEWAY_STATE',
      `Unregistered persistence provider: ${id}`
    );
  }

  /**
   * Initialize state with organization and gateway IDs
   */
  initialize(organization_id: string, gateway_id: string): void {
    this.organizationId = organization_id;
    this.gatewayId = gateway_id;
    this._initialized = true;
    log(
      EPriority.Info,
      'GATEWAY_STATE',
      `Initialized for org: ${organization_id}, gateway: ${gateway_id}`
    );
  }

  /**
   * Set organization context for Ganymede sync and pull data
   * Called after /collab/start completes
   */
  async setOrganizationContext(
    organizationId: string,
    gatewayId: string,
    organizationToken: string
  ): Promise<void> {
    this.organizationId = organizationId;
    this.gatewayId = gatewayId;
    this.organizationToken = organizationToken;

    // Update Ganymede client with organization token
    if (this.ganymedeClient) {
      this.ganymedeClient.setOrganizationToken(organizationToken);
    }

    log(
      EPriority.Info,
      'GATEWAY_STATE',
      `Organization context set: org=${organizationId}, gateway=${gatewayId}`
    );

    // Pull data from Ganymede after setting context
    await this.pullDataFromGanymede();
  }

  /**
   * Clear organization context (on deallocation)
   */
  clearOrganizationContext(): void {
    this.organizationId = '';
    this.gatewayId = '';
    this.organizationToken = null;
    this.pulledData = null;

    log(EPriority.Info, 'GATEWAY_STATE', 'Organization context cleared');
  }

  /**
   * Collect data from all registered providers
   * @returns Aggregated data object with provider IDs as keys
   */
  collectData(): TGatewayDataSnapshot {
    const data: TGatewayDataSnapshot = {
      organization_id: this.organizationId,
      gateway_id: this.gatewayId,
      saved_at: new Date().toISOString(),
    };

    for (const [id, provider] of this.providers.entries()) {
      try {
        data[id] = provider.saveToSerializable();
      } catch (error: any) {
        log(
          EPriority.Error,
          'GATEWAY_STATE',
          `Failed to collect data from provider '${id}': ${error.message}`
        );
      }
    }

    log(
      EPriority.Info,
      'GATEWAY_STATE',
      `Collected data from ${this.providers.size} providers`
    );
    return data;
  }

  /**
   * Restore data to all registered providers
   * @param data - Aggregated data object with provider IDs as keys
   */
  restoreData(data: TGatewayDataSnapshot | null | undefined): void {
    if (!data) {
      log(EPriority.Info, 'GATEWAY_STATE', 'No data to restore');
      return;
    }

    // Store pulled data so we can use it when providers register later
    this.pulledData = data;

    // Restore organization/gateway IDs if present
    if (typeof data.organization_id === 'string') {
      this.organizationId = data.organization_id;
    }
    if (typeof data.gateway_id === 'string') {
      this.gatewayId = data.gateway_id;
    }

    // Restore each already-registered provider's data
    for (const [id, provider] of this.providers.entries()) {
      if (data[id] !== undefined) {
        try {
          provider.loadFromSerialized(
            data[id] as Record<string, unknown> | null | undefined
          );
          log(
            EPriority.Info,
            'GATEWAY_STATE',
            `Restored data for provider: ${id}`
          );
        } catch (error: any) {
          log(
            EPriority.Error,
            'GATEWAY_STATE',
            `Failed to restore data for provider '${id}': ${error.message}`
          );
        }
      }
    }

    log(EPriority.Info, 'GATEWAY_STATE', 'Data restoration complete');
  }

  /**
   * Push data snapshot to Ganymede
   * Called on autosave and shutdown
   */
  async pushDataToGanymede(): Promise<void> {
    if (!this.organizationId || !this.gatewayId || !this.organizationToken) {
      log(
        EPriority.Info,
        'GATEWAY_STATE',
        'No organization context, skipping push'
      );
      return;
    }

    log(
      EPriority.Info,
      'GATEWAY_STATE',
      `Pushing data to Ganymede for org ${this.organizationId}`
    );

    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    try {
      const data = this.collectData();

      const result = await this.ganymedeClient.request<{
        size_bytes: number;
      }>({
        method: 'POST',
        url: '/gateway/data/push',
        headers: {
          'Content-Type': 'application/json',
        },
        jsonBody: {
          timestamp: new Date().toISOString(),
          data: data as unknown as TJson,
        },
      });

      log(
        EPriority.Info,
        'GATEWAY_STATE',
        `✅ Data pushed successfully (${result.size_bytes} bytes)`
      );
    } catch (error: any) {
      log(
        EPriority.Critical,
        'GATEWAY_STATE',
        `Failed to push data:`,
        error.message
      );
      // Don't throw - push failure shouldn't crash gateway
    }
  }

  /**
   * Pull data snapshot from Ganymede
   * Called after allocation/handshake or during setOrganizationContext
   */
  async pullDataFromGanymede(): Promise<void> {
    if (!this.organizationId || !this.gatewayId || !this.organizationToken) {
      log(
        EPriority.Critical,
        'GATEWAY_STATE',
        'Cannot pull: No organization context'
      );
      throw new Error('No organization context for data pull');
    }

    log(
      EPriority.Info,
      'GATEWAY_STATE',
      `Pulling data from Ganymede for org ${this.organizationId}`
    );

    if (!this.ganymedeClient) {
      throw new Error('Ganymede client not initialized');
    }

    try {
      const result = await this.ganymedeClient.request<{
        success: boolean;
        exists: boolean;
        data?: TGatewayDataSnapshot;
        stored_at?: string;
      }>({
        method: 'POST',
        url: '/gateway/data/pull',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!result.success) {
        throw new Error('Pull returned success=false');
      }

      if (result.exists && result.data) {
        log(
          EPriority.Info,
          'GATEWAY_STATE',
          `✅ Data retrieved (stored: ${result.stored_at})`
        );
        this.restoreData(result.data);
      } else {
        log(
          EPriority.Warning,
          'GATEWAY_STATE',
          'No existing data for organization (new org or first allocation)'
        );
        this.pulledData = null; // Mark that there's no data
      }
    } catch (error: any) {
      log(
        EPriority.Critical,
        'GATEWAY_STATE',
        `Failed to pull data:`,
        error.message
      );
      throw error; // Pull failure during allocation should fail the allocation
    }
  }

  /**
   * Start periodic autosave
   * Pushes data every N minutes
   */
  startAutosave(intervalMs = 300000): void {
    if (this.autosaveTimer) {
      log(EPriority.Notice, 'GATEWAY_STATE', 'Autosave already running');
      return;
    }

    log(
      EPriority.Info,
      'GATEWAY_STATE',
      `Starting autosave (interval: ${intervalMs / 1000}s)`
    );

    this.autosaveTimer = setInterval(async () => {
      await this.pushDataToGanymede();
    }, intervalMs);
  }

  /**
   * Stop periodic autosave
   */
  stopAutosave(): void {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
      log(EPriority.Info, 'GATEWAY_STATE', 'Autosave stopped');
    }
  }

  /**
   * Shutdown: stop autosave and push final data
   */
  async shutdown(): Promise<void> {
    log(
      EPriority.Info,
      'GATEWAY_STATE',
      'Shutting down - stopping autosave and pushing final data'
    );
    this.stopAutosave();
    await this.pushDataToGanymede();
    log(EPriority.Info, 'GATEWAY_STATE', 'Shutdown complete');
  }

  /**
   * Check if state is initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Get organization ID
   */
  getOrganizationId(): string {
    return this.organizationId;
  }

  /**
   * Get gateway ID
   */
  getGatewayId(): string {
    return this.gatewayId;
  }

  /**
   * Get count of registered providers
   */
  getProviderCount(): number {
    return this.providers.size;
  }
}
