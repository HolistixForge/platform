import { TEventOrigin } from '@monorepo/core-graph';

import { ServerSystemInfo, TServer } from './servers-types';

//

export type TEventNewServer = {
  type: 'user-container:new';
  from: {
    new?: { serverName: string; imageId: string };
    user_container_id?: string;
  };
  origin?: TEventOrigin;
  /** Do not provide this value, servers reducers will fill it for others subsequent reducers */
  result?: {
    server: TServer;
  };
};

export type TEventDeleteServer = {
  type: 'user-container:delete';
  user_container_id: string;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
};

export type TEventHostServer = {
  type: 'user-container:host';
  user_container_id: string;
};

export type TEventServerToCloud = {
  type: 'user-container:to-cloud';
  user_container_id: string;
  instanceType: string;
  storage: number;
};

export type TEventServerCloudPause = {
  type: 'user-container:cloud-pause';
  user_container_id: string;
};

export type TEventServerCloudStart = {
  type: 'user-container:cloud-start';
  user_container_id: string;
};

export type TEventServerCloudDelete = {
  type: 'user-container:cloud-delete';
  user_container_id: string;
};

//

export type TEventServerWatchdog = {
  type: 'server:watchdog';
  host_user_id: string;
  system?: ServerSystemInfo;
};

export type TEventServerActivity = {
  type: 'user-container:activity';
  last_activity: string;
};

export type TEventServerMapHttpService = {
  type: 'server:map-http-service';
  port: number;
  name: string;
};

export type TServerEvents =
  | TEventNewServer
  | TEventDeleteServer
  | TEventHostServer
  | TEventServerToCloud
  | TEventServerCloudPause
  | TEventServerCloudStart
  | TEventServerCloudDelete
  //
  | TEventServerWatchdog
  | TEventServerMapHttpService
  | TEventServerActivity;
