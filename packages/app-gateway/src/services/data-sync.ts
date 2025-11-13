/**
 * Gateway Data Sync Service
 *
 * Manages data synchronization with Ganymede.
 * Gateway is stateless - all persistent data stored centrally in Ganymede.
 */

import { log } from '@monorepo/log';

export class GatewayDataSync {
  private ganymedeFqdn: string;
  private organizationToken: string | null = null;
  private organizationId: string | null = null;
  private gatewayId: string | null = null;

  constructor() {
    this.ganymedeFqdn = process.env.GANYMEDE_FQDN || 'ganymede.domain.local';
  }

  /**
   * Set organization token after handshake
   * Called after /collab/start completes
   */
  setOrganizationContext(
    organizationId: string,
    gatewayId: string,
    organizationToken: string
  ): void {
    this.organizationId = organizationId;
    this.gatewayId = gatewayId;
    this.organizationToken = organizationToken;

    log(
      6,
      'DATA_SYNC',
      `Organization context set: org=${organizationId}, gateway=${gatewayId}`
    );
  }

  /**
   * Clear organization context (on deallocation)
   */
  clearOrganizationContext(): void {
    this.organizationId = null;
    this.gatewayId = null;
    this.organizationToken = null;

    log(6, 'DATA_SYNC', 'Organization context cleared');
  }

  /**
   * Get current data snapshot from gateway state
   * Override this method to collect actual gateway state
   */
  protected async collectDataSnapshot(): Promise<any> {
    // TODO: Implement actual data collection from:
    // - YJS state (from collab service)
    // - Permission configurations
    // - OAuth tokens
    // - Any other runtime state

    log(6, 'DATA_SYNC', 'Collecting data snapshot (stub implementation)');

    return {
      yjs_state: {},
      gateway_state: {
        permissions: {},
        oauth_clients: {},
        container_tokens: {},
      },
    };
  }

  /**
   * Apply data snapshot to gateway state
   * Override this method to apply actual gateway state
   */
  protected async applyDataSnapshot(data: any): Promise<void> {
    // TODO: Implement actual data restoration to:
    // - YJS state (to collab service)
    // - Permission configurations
    // - OAuth tokens
    // - Any other runtime state

    log(6, 'DATA_SYNC', 'Applying data snapshot (stub implementation)', {
      has_yjs_state: !!data?.yjs_state,
      has_gateway_state: !!data?.gateway_state,
    });
  }

  /**
   * Push data snapshot to Ganymede
   * Called on autosave and shutdown
   */
  async pushDataToGanymede(): Promise<void> {
    if (!this.organizationId || !this.gatewayId || !this.organizationToken) {
      log(6, 'DATA_SYNC', 'No organization context, skipping push');
      return;
    }

    log(
      6,
      'DATA_SYNC',
      `Pushing data to Ganymede for org ${this.organizationId}`
    );

    try {
      const data = await this.collectDataSnapshot();

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
        'DATA_SYNC',
        `✅ Data pushed successfully (${result.size_bytes} bytes)`
      );
    } catch (error: any) {
      log(2, 'DATA_SYNC', `Failed to push data:`, error.message);
      // Don't throw - push failure shouldn't crash gateway
    }
  }

  /**
   * Pull data snapshot from Ganymede
   * Called after allocation/handshake
   */
  async pullDataFromGanymede(): Promise<void> {
    if (!this.organizationId || !this.gatewayId || !this.organizationToken) {
      log(2, 'DATA_SYNC', 'Cannot pull: No organization context');
      throw new Error('No organization context for data pull');
    }

    log(
      6,
      'DATA_SYNC',
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
        log(6, 'DATA_SYNC', `✅ Data retrieved (stored: ${result.stored_at})`);
        await this.applyDataSnapshot(result.data);
      } else {
        log(
          6,
          'DATA_SYNC',
          'No existing data for organization (new org or first allocation)'
        );
      }
    } catch (error: any) {
      log(2, 'DATA_SYNC', `Failed to pull data:`, error.message);
      throw error; // Pull failure during allocation should fail the allocation
    }
  }

  /**
   * Start periodic autosave
   * Pushes data every N minutes if dirty
   */
  startAutosave(intervalMs = 300000): NodeJS.Timeout {
    log(6, 'DATA_SYNC', `Starting autosave (interval: ${intervalMs / 1000}s)`);

    return setInterval(async () => {
      await this.pushDataToGanymede();
    }, intervalMs);
  }

  /**
   * Stop periodic autosave
   */
  stopAutosave(timer: NodeJS.Timeout): void {
    clearInterval(timer);
    log(6, 'DATA_SYNC', 'Autosave stopped');
  }
}

// Export singleton instance
export const gatewayDataSync = new GatewayDataSync();
