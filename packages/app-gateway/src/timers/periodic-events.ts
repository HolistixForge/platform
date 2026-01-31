import { EPriority, log } from '@holistix-forge/log';
import { TEventPeriodic, type TReducersBackendExports } from '@holistix-forge/reducers';
import type { ProjectRoomsManager } from '../state/ProjectRooms';

/**
 * Gateway Periodic Event Timer
 * 
 * Emits periodic events for each active project (5 second interval)
 * This is gateway-specific logic, not part of the generic BackendEventProcessor
 */
export class GatewayPeriodicTimer {
  private intervalHandle: NodeJS.Timeout | null = null;
  private interval = 5000; // 5 seconds

  constructor(
    private projectRooms: ProjectRoomsManager,
    private eventProcessor: TReducersBackendExports
  ) {}

  /**
   * Start emitting periodic events per-project
   */
  start(): void {
    if (this.intervalHandle) {
      log(EPriority.Notice, 'GATEWAY_TIMER', 'Periodic timer already running');
      return;
    }

    log(EPriority.Info, 'GATEWAY_TIMER', `Starting per-project periodic events (${this.interval}ms interval)`);

    this.intervalHandle = setInterval(() => {
      try {
        this.emitPeriodicEvents();
      } catch (err) {
        log(EPriority.Error, 'GATEWAY_TIMER', 'Error emitting periodic events', err);
      }
    }, this.interval);
  }

  /**
   * Stop emitting periodic events
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      log(EPriority.Info, 'GATEWAY_TIMER', 'Periodic timer stopped');
    }
  }

  /**
   * Emit periodic event for each active project
   */
  private emitPeriodicEvents(): void {
    const projectIds = this.projectRooms.getAllProjectIds();
    const now = new Date();

    const event: TEventPeriodic = {
      type: 'reducers:periodic',
      date: now,
      interval: this.interval,
      systemEvent: true,  // Don't rearm project activity timer
    };

    // Emit event for each project
    for (const project_id of projectIds) {
      const requestData = {
        ip: 'system-periodic',
        user_id: 'system',
        jwt: {},
        headers: {},
        project_id,
      };

      this.eventProcessor.processEvent(event, requestData).catch((err) => {
        log(
          EPriority.Error,
          'GATEWAY_TIMER',
          `Error processing periodic event for project ${project_id}`,
          err
        );
      });
    }
  }
}
