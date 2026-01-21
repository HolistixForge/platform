import { EPriority, log } from '@holistix-forge/log';
import type { ProjectRoomsManager } from '../state/ProjectRooms';
import { shutdownGateway } from '../initialization/gateway-init';

export interface GatewayShutdownTimerOptions {
  idleShutdownMs?: number; // How long to wait before shutdown (default: 30 min)
  checkIntervalMs?: number; // How often to check (default: 30 seconds)
  onShutdown?: () => Promise<void>; // Custom shutdown handler (for testing)
}

/**
 * Gateway Shutdown Timer
 * 
 * Monitors gateway activity and shuts down if ALL projects are idle for extended period
 * This is gateway-specific logic, separate from per-project cleanup
 * 
 * For testing: Use short delays like { idleShutdownMs: 1000, checkIntervalMs: 100 }
 */
export class GatewayShutdownTimer {
  private checkInterval: NodeJS.Timeout | null = null;
  private lastGatewayActivity: Date = new Date();
  private idleShutdownMs: number;
  private checkIntervalMs: number;
  private enabled = false;
  private onShutdown: () => Promise<void>;

  constructor(
    private projectRooms: ProjectRoomsManager,
    options: GatewayShutdownTimerOptions = {}
  ) {
    this.idleShutdownMs = options.idleShutdownMs ?? 30 * 60 * 1000; // Default: 30 minutes
    this.checkIntervalMs = options.checkIntervalMs ?? 30000; // Default: 30 seconds
    this.onShutdown = options.onShutdown ?? this.defaultShutdown.bind(this);
  }

  /**
   * Enable gateway-wide shutdown monitoring
   */
  enable(): void {
    if (this.enabled) {
      log(EPriority.Notice, 'GATEWAY_SHUTDOWN', 'Shutdown timer already enabled');
      return;
    }

    this.enabled = true;
    const idleMinutes = Math.floor(this.idleShutdownMs / 60000);
    log(
      EPriority.Info,
      'GATEWAY_SHUTDOWN',
      `Enabled gateway shutdown (${idleMinutes} min idle threshold, check every ${this.checkIntervalMs}ms)`
    );

    this.start();
  }

  /**
   * Disable gateway-wide shutdown monitoring
   */
  disable(): void {
    this.enabled = false;
    this.stop();
    log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Disabled gateway shutdown monitoring');
  }

  /**
   * Start monitoring for gateway shutdown
   */
  private start(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.checkAndShutdown();
    }, this.checkIntervalMs);

    log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Started gateway shutdown monitoring');
  }

  /**
   * Stop monitoring
   */
  private stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Stopped gateway shutdown monitoring');
    }
  }

  /**
   * Check if gateway should shutdown (no projects for extended period)
   * Can be called manually for testing
   */
  checkAndShutdown(): void {
    if (!this.enabled) {
      return;
    }

    const projectIds = this.projectRooms.getAllProjectIds();
    const now = new Date();
    const idleTimeMs = now.getTime() - this.lastGatewayActivity.getTime();

    // If projects exist, gateway is active - reset timer
    if (projectIds.length > 0) {
      this.lastGatewayActivity = now;
      return;
    }

    // No projects exist - check if idle long enough to shutdown
    if (idleTimeMs >= this.idleShutdownMs) {
      log(
        EPriority.Info,
        'GATEWAY_SHUTDOWN',
        `No active projects for ${idleTimeMs}ms - initiating shutdown`
      );
      this.initiateShutdown();
    } else {
      log(
        EPriority.Debug,
        'GATEWAY_SHUTDOWN',
        `No active projects, idle for ${idleTimeMs}/${this.idleShutdownMs}ms`
      );
    }
  }

  /**
   * Get current idle time in milliseconds (for testing)
   */
  getIdleTimeMs(): number {
    return new Date().getTime() - this.lastGatewayActivity.getTime();
  }

  /**
   * Reset activity timer (for testing)
   */
  resetActivityTimer(): void {
    this.lastGatewayActivity = new Date();
  }

  /**
   * Initiate gateway shutdown
   */
  private async initiateShutdown(): Promise<void> {
    this.stop(); // Stop monitoring

    log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Shutting down gateway due to inactivity');

    try {
      await this.onShutdown();
      log(EPriority.Info, 'GATEWAY_SHUTDOWN', 'Gateway shutdown complete');
    } catch (err) {
      log(EPriority.Error, 'GATEWAY_SHUTDOWN', 'Error during shutdown', err);
      throw err;
    }
  }

  /**
   * Default shutdown handler (used in production)
   */
  private async defaultShutdown(): Promise<void> {
    await shutdownGateway();
    process.exit(0);
  }
}
