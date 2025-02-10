import { ServerSystemInfo, TEc2InstanceState } from './servers-types';

export type TEventNewServer = {
  type: 'servers:new';
  serverName: string;
  imageId: number;
  origin?: {
    viewId: string;
    position: { x: number; y: number };
  };
};

export type TEventDeleteServer = {
  type: 'servers:delete';
  project_server_id: number;
};

export type TEventHostServer = {
  type: 'servers:host';
  project_server_id: number;
};

export type TEventServerToCloud = {
  type: 'servers:to-cloud';
  project_server_id: number;
  instanceType: string;
  storage: number;
};

export type TEventServerCloudPause = {
  type: 'servers:cloud-pause';
  project_server_id: number;
};

export type TEventServerCloudStart = {
  type: 'servers:cloud-start';
  project_server_id: number;
};

export type TEventServerCloudDelete = {
  type: 'servers:cloud-delete';
  project_server_id: number;
};

export type TEventUpdateInstanceState = {
  type: 'servers:_update-instance-state';
  project_server_id: number;
  state: TEc2InstanceState;
};

//

export type TEventServerWatchdog = {
  type: 'server:watchdog';
  host_user_id: string;
  system?: ServerSystemInfo;
};

export type TEventServerActivity = {
  type: 'servers:activity';
  last_activity: string;
};

export type TEventServerMapHttpService = {
  type: 'server:map-http-service';
  port: number;
  name: string;
};

//
//

export type TEventNewVolume = {
  type: 'servers:new-volume';
  name: string;
  storage: number;
  origin?: {
    viewId: string;
    position: { x: number; y: number };
  };
};

export type TEventMountVolume = {
  type: 'servers:mount-volume';
  project_server_id: number;
  volume_id: number;
  mount_point: string;
};

export type TEventUnmountVolume = {
  type: 'servers:unmount-volume';
  project_server_id: number;
  volume_id: number;
  mount_point: string;
};

export type TEventDeleteVolume = {
  type: 'servers:delete-volume';
  volume_id: number;
};

export type TServerEvents =
  | TEventNewServer
  | TEventDeleteServer
  | TEventHostServer
  | TEventServerToCloud
  | TEventServerCloudPause
  | TEventServerCloudStart
  | TEventServerCloudDelete
  | TEventUpdateInstanceState
  //
  | TEventServerWatchdog
  | TEventServerMapHttpService
  | TEventServerActivity
  //
  | TEventNewVolume
  | TEventMountVolume
  | TEventUnmountVolume
  | TEventDeleteVolume;
