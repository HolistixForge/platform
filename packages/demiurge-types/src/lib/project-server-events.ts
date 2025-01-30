import { ServerSystemInfo, TEc2InstanceState } from './servers';

export type TEventNewServer = {
  type: 'new-server';
  serverName: string;
  imageId: number;
  origin?: {
    viewId: string;
    position: { x: number; y: number };
  };
};

export type TEventDeleteServer = {
  type: 'delete-server';
  project_server_id: number;
};

export type TEventHostServer = {
  type: 'host-server';
  project_server_id: number;
};

export type TEventServerToCloud = {
  type: 'server-to-cloud';
  project_server_id: number;
  instanceType: string;
  storage: number;
};

export type TEventServerCloudPause = {
  type: 'server-cloud-pause';
  project_server_id: number;
};

export type TEventServerCloudStart = {
  type: 'server-cloud-start';
  project_server_id: number;
};

export type TEventServerCloudDelete = {
  type: 'server-cloud-delete';
  project_server_id: number;
};

export type TEventUpdateInstanceState = {
  type: '_update-instance-state';
  project_server_id: number;
  state: TEc2InstanceState;
};

//

export type TEventServerWatchdog = {
  type: 'server-watchdog';
  host_user_id: string;
  system?: ServerSystemInfo;
};

export type TEventServerActivity = {
  type: 'activity';
  last_activity: string;
};

export type TEventServerMapHttpService = {
  type: 'server-map-http-service';
  port: number;
  name: string;
};

//
//

export type TEventNewVolume = {
  type: 'new-volume';
  name: string;
  storage: number;
  origin?: {
    viewId: string;
    position: { x: number; y: number };
  };
};

export type TEventMountVolume = {
  type: 'mount-volume';
  project_server_id: number;
  volume_id: number;
  mount_point: string;
};

export type TEventUnmountVolume = {
  type: 'unmount-volume';
  project_server_id: number;
  volume_id: number;
  mount_point: string;
};

export type TEventDeleteVolume = {
  type: 'delete-volume';
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
