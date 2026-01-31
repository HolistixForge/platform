/**
 * System Events
 *
 * Infrastructure-level events that can be handled by any reducer.
 * These events are emitted by the platform (gateway, scheduler, etc.)
 * and are available to all modules for coordinated periodic tasks.
 */

/**
 * Periodic Event
 *
 * Emitted at regular intervals (default: 5 seconds) to all active projects.
 * Reducers can handle this event to perform scheduled tasks like:
 * - Cleanup of expired data
 * - Status checks and updates
 * - Activity tracking
 * - Resource monitoring
 *
 * Note: This is a system event (systemEvent: true) and does NOT rearm
 * project activity timers.
 */
export type TEventPeriodic = {
  type: 'reducers:periodic';
  date: Date;
  interval: number;
  systemEvent: true;  // Don't rearm project activity timer
};
