import { log } from '@monorepo/log';
import { IPersistenceProvider } from './IPersistenceProvider';

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
  private ganymedeFqdn: string;
  private autosaveTimer: NodeJS.Timeout | null = null;
  private pulledData: TGatewayDataSnapshot | null = null;

  constructor() {
    this.ganymedeFqdn = process.env.GANYMEDE_FQDN || 'ganymede.domain.local';
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
        3,
        'GATEWAY_STATE',
        `Warning: Provider with id '${id}' already registered, replacing`
      );
    }
    this.providers.set(id, provider);
    log(6, 'GATEWAY_STATE', `Registered persistence provider: ${id}`);

    // Load data from pulled snapshot if available
    if (this.pulledData && this.pulledData[id] !== undefined) {
      try {
        provider.loadFromSerialized(
          this.pulledData[id] as Record<string, unknown> | null | undefined
        );
        log(6, 'GATEWAY_STATE', `Loaded data for provider: ${id}`);
      } catch (error: any) {
        log(
          3,
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
    log(6, 'GATEWAY_STATE', `Unregistered persistence provider: ${id}`);
  }

  /**
   * Initialize state with organization and gateway IDs
   */
  initialize(organization_id: string, gateway_id: string): void {
    this.organizationId = organization_id;
    this.gatewayId = gateway_id;
    this._initialized = true;
    log(
      6,
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

    log(
      6,
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

    log(6, 'GATEWAY_STATE', 'Organization context cleared');
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
          3,
          'GATEWAY_STATE',
          `Failed to collect data from provider '${id}': ${error.message}`
        );
      }
    }

    log(
      6,
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
      log(6, 'GATEWAY_STATE', 'No data to restore');
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
          log(6, 'GATEWAY_STATE', `Restored data for provider: ${id}`);
        } catch (error: any) {
          log(
            3,
            'GATEWAY_STATE',
            `Failed to restore data for provider '${id}': ${error.message}`
          );
        }
      }
    }

    log(6, 'GATEWAY_STATE', 'Data restoration complete');
  }

  /**
   * Push data snapshot to Ganymede
   * Called on autosave and shutdown
   */
  async pushDataToGanymede(): Promise<void> {
    if (!this.organizationId || !this.gatewayId || !this.organizationToken) {
      log(6, 'GATEWAY_STATE', 'No organization context, skipping push');
      return;
    }

    log(
      6,
      'GATEWAY_STATE',
      `Pushing data to Ganymede for org ${this.organizationId}`
    );

    try {
      const data = this.collectData();

      const response = await fetch(
        `https://${this.ganymedeFqdn}/gateway/data/push`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.organizationToken}`,
          },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            data,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Push failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      log(
        6,
        'GATEWAY_STATE',
        `✅ Data pushed successfully (${result.size_bytes} bytes)`
      );
    } catch (error: any) {
      log(2, 'GATEWAY_STATE', `Failed to push data:`, error.message);
      // Don't throw - push failure shouldn't crash gateway
    }
  }

  /**
   * Pull data snapshot from Ganymede
   * Called after allocation/handshake or during setOrganizationContext
   */
  async pullDataFromGanymede(): Promise<void> {
    if (!this.organizationId || !this.gatewayId || !this.organizationToken) {
      log(2, 'GATEWAY_STATE', 'Cannot pull: No organization context');
      throw new Error('No organization context for data pull');
    }

    log(
      6,
      'GATEWAY_STATE',
      `Pulling data from Ganymede for org ${this.organizationId}`
    );

    try {
      const response = await fetch(
        `https://${this.ganymedeFqdn}/gateway/data/pull`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.organizationToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pull failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error('Pull returned success=false');
      }

      if (result.exists && result.data) {
        log(
          6,
          'GATEWAY_STATE',
          `✅ Data retrieved (stored: ${result.stored_at})`
        );
        this.restoreData(result.data);
      } else {
        log(
          6,
          'GATEWAY_STATE',
          'No existing data for organization (new org or first allocation)'
        );
        this.pulledData = null; // Mark that there's no data
      }
    } catch (error: any) {
      log(2, 'GATEWAY_STATE', `Failed to pull data:`, error.message);
      throw error; // Pull failure during allocation should fail the allocation
    }
  }

  /**
   * Start periodic autosave
   * Pushes data every N minutes
   */
  startAutosave(intervalMs = 300000): void {
    if (this.autosaveTimer) {
      log(5, 'GATEWAY_STATE', 'Autosave already running');
      return;
    }

    log(
      6,
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
      log(6, 'GATEWAY_STATE', 'Autosave stopped');
    }
  }

  /**
   * Shutdown: stop autosave and push final data
   */
  async shutdown(): Promise<void> {
    log(
      6,
      'GATEWAY_STATE',
      'Shutting down - stopping autosave and pushing final data'
    );
    this.stopAutosave();
    await this.pushDataToGanymede();
    log(6, 'GATEWAY_STATE', 'Shutdown complete');
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
