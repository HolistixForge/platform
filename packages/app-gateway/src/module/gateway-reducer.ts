import { EPriority, log } from '@holistix-forge/log';
import { inSeconds, isPassed } from '@holistix-forge/simple-types';
import { TEventPeriodic, RequestData, TBaseEvent } from '@holistix-forge/reducers';
import { TCollabBackendExports, ReducerWithCollab } from '@holistix-forge/collab';
import type { TGatewayExports, TGatewaySharedData, TGatewayMeta } from '@holistix-forge/gateway';
import type {
  TGatewayEvents,
  TEventDisableProjectUnloading,
} from '@holistix-forge/gateway';
import { getProjectRoomsManager } from '../initialization/gateway-instances';

/**
 * Project cleanup delay: 5 minutes of inactivity
 * After 5 minutes of no activity, project is aggressively cleaned up:
 * - WebSocket connections closed
 * - YJS doc unloaded
 * - Removed from ProjectRoomsManager
 */
export const PROJECT_INACTIVITY_CLEANUP_DELAY = 300; // 5 minutes in seconds

type RequiredExports = {
  collab: TCollabBackendExports;
  gateway: TGatewayExports;
};

export class GatewayReducer extends ReducerWithCollab<TGatewayEvents | TEventPeriodic, TGatewaySharedData> {
  constructor(depsExports: RequiredExports) {
    super(depsExports.collab.registry, 'gateway');
  }

  //

  override reduce(event: TBaseEvent, requestData: RequestData): Promise<void> {
    // Only rearm timer for user-initiated events, not system events
    // System events (periodic, watchdog, etc.) shouldn't affect activity tracking
    if (!event.systemEvent) {
      this.rearmProjectActivityTimer(event, requestData);
    }

    switch (event.type) {
      case 'reducers:periodic':
        return this._periodic(event as TEventPeriodic, requestData);
      case 'gateway:disable-project-unloading':
        return this._disableProjectCleanup(event as TEventDisableProjectUnloading, requestData);
    }
    return Promise.resolve();
  }

  //

  rearmProjectActivityTimer = (event: { type: string }, requestData: RequestData) => {
    const project_id = requestData.project_id;
    if (!project_id) {
      // Gateway-level events without project context (rare)
      return;
    }

    const collab = this.getCollab(requestData);
    const now = new Date();

    // Use project_id as key (per-project activity tracking)
    const curMeta = collab.sharedData['gateway:gateway'].get('meta');

    const prevLast = new Date(curMeta?.projectActivity.last_activity || '');

    if (prevLast.getTime() < now.getTime()) {
      log(
        EPriority.Debug,
        'PROJECT_ACTIVITY',
        `[${project_id}] Activity detected: ${now.toISOString()}`
      );

      const newMeta: TGatewayMeta = {
        ...curMeta,
        projectActivity: {
          last_activity: now.toISOString(),
          project_cleanup_time: inSeconds(
            PROJECT_INACTIVITY_CLEANUP_DELAY,
            now
          ).toISOString(),
          disable_project_cleanup:
            curMeta?.projectActivity.disable_project_cleanup || false,
        },
      };

      collab.sharedData['gateway:gateway'].set('meta', newMeta);
    }
  };

  //

  async _periodic(event: TEventPeriodic, requestData: RequestData): Promise<void> {
    const project_id = requestData.project_id;
    if (!project_id) {
      // Should not happen with per-project periodic events
      return;
    }

    const collab = this.getCollab(requestData);
    const meta = collab.sharedData['gateway:gateway'].get('meta');
    
    if (meta) {
      if (!meta.projectActivity.disable_project_cleanup) {
        const cleanup_time = new Date(meta.projectActivity.project_cleanup_time);
        
        if (isPassed(cleanup_time)) {
          log(
            EPriority.Info,
            'PROJECT_CLEANUP',
            `Project ${project_id} idle for ${PROJECT_INACTIVITY_CLEANUP_DELAY}s, cleaning up...`
          );

          // IMPORTANT: Push all data to Ganymede BEFORE cleanup
          // This ensures the project's final state (including any system event changes) is persisted
          // Once removed from ProjectRoomsManager, it won't be included in future autosaves
          //
          // NOTE: If multiple projects are idle (cleanup triggered in same periodic event),
          // we'll call pushDataToGanymede() multiple times (once per project cleanup).
          // This saves ALL projects multiple times in a row, which is inefficient but acceptable:
          // - Cleanup is infrequent (projects must be idle 5+ min)
          // - Data safety > performance optimization
          // - Could be batched later if needed (queue cleanups, push once, cleanup all)
          const instances = require('../initialization/gateway-instances').getGatewayInstances();
          if (instances && instances.gatewayState) {
            log(
              EPriority.Info,
              'PROJECT_CLEANUP',
              `Saving all gateway data before cleanup (includes final snapshot of ${project_id})`
            );
            try {
              await instances.gatewayState.pushDataToGanymede();
              log(
                EPriority.Info,
                'PROJECT_CLEANUP',
                `✅ Gateway data saved successfully before cleanup`
              );
            } catch (error: any) {
              log(
                EPriority.Error,
                'PROJECT_CLEANUP',
                `Failed to save data before cleanup: ${error.message}`
              );
              // Continue with cleanup anyway - data loss is better than memory leak
            }
          } else {
            log(
              EPriority.Warning,
              'PROJECT_CLEANUP',
              `GatewayState not available - cleanup proceeding without save!`
            );
          }

          // Aggressive cleanup: unload project, remove from ProjectRoomsManager
          const projectRooms = getProjectRoomsManager();
          if (projectRooms) {
            await projectRooms.cleanupProject(project_id);
            log(
              EPriority.Info,
              'PROJECT_CLEANUP',
              `Project ${project_id} successfully cleaned up`
            );
          } else {
            log(
              EPriority.Error,
              'PROJECT_CLEANUP',
              `ProjectRoomsManager not available for cleanup of ${project_id}`
            );
          }
        }
      }
    }
    return Promise.resolve();
  }

  _disableProjectCleanup(event: TEventDisableProjectUnloading, requestData: RequestData): Promise<void> {
    const project_id = requestData.project_id;
    if (!project_id) {
      return Promise.resolve();
    }

    const collab = this.getCollab(requestData);
    const meta = collab.sharedData['gateway:gateway'].get('meta');
    if (meta) {
      meta.projectActivity.disable_project_cleanup = true;
      collab.sharedData['gateway:gateway'].set('meta', meta);
      log(
        EPriority.Info,
        'PROJECT_CLEANUP',
        `Project ${project_id} cleanup disabled`
      );
    }
    return Promise.resolve();
  }
}
