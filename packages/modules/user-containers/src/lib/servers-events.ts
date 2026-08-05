import { TEventOrigin } from '@holistix-forge/core-graph';

import { UserContainerSystemInfo, TUserContainer } from './servers-types';

//

export type TEventNew = {
  type: 'user-container:new';
  project_id: string;
  containerName: string;
  imageId: string;
  origin?: TEventOrigin;
  /** Do not provide this value, servers reducers will fill it for others subsequent reducers */
  result?: {
    userContainer: TUserContainer;
  };
};

export type TEventDelete = {
  type: 'user-container:delete';
  user_container_id: string;
};

export type TEventWatchdog = {
  type: 'user-container:watchdog';
  system?: UserContainerSystemInfo;
  systemEvent: true; // Automated health check from container
};

export type TEventActivity = {
  type: 'user-container:activity';
  last_activity: string;
};

export type TEventMapHttpService = {
  type: 'user-container:map-http-service';
  port: number;
  name: string;
};

export type TEventSelectRunner = {
  type: 'user-container:set-runner';
  user_container_id: string;
  runner_id: string;
  /**
   * Which machine, for a local placement. Required when `runner_id` is
   * `local`, meaningless otherwise.
   *
   * The list to choose from comes from Ganymede — `GET /runners` returns the
   * caller's enrolled machines — and not from the project's machine catalog,
   * which only holds machines whose runner is already heartbeating into this
   * project. A machine's *first* placement is what puts it there, so requiring
   * it to be there first would mean no machine could ever join.
   */
  machine_id?: string;
};

/**
 * A runner saying it is still connected.
 *
 * The same shape as the container watchdog and read the same way: a machine
 * that stops sending these disappears from the project's targets, because a
 * runner that went quiet and a laptop that was closed are indistinguishable —
 * and identical in consequence.
 */
export type TEventRunnerHealth = {
  type: 'user-container:runner-health';
  machine_id: string;
  label: string;
  systemEvent: true;
};

export type TEventStart = {
  type: 'user-container:start';
  user_container_id: string;
};

export type TUserContainersEvents =
  | TEventNew
  | TEventDelete
  | TEventWatchdog
  | TEventMapHttpService
  | TEventActivity
  | TEventSelectRunner
  | TEventRunnerHealth
  | TEventStart;
