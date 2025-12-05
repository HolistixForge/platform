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
  | TEventStart;
