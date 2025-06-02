import { TG_User } from '@monorepo/demiurge-types';
import { TG_ServerImage } from '@monorepo/frontend-data';
import { serverUrl } from '@monorepo/api-fetch';

//

/** what is store in Database */
export type TD_ServerImage = TG_ServerImage & {
  image_uri: string;
  options: TServerImageOptions;
  user_available: boolean;
};

export type TServerImageOptions = {
  ports?: number[];
  oauthClients?: {
    serviceName: string;
    /** secondes */
    accessTokenLifetime?: number;
  }[];
};

/** what is store in Database */
export type TD_Server = {
  project_server_id: number;
  project_id: number;
  server_name: string;
  image_id: number;
  host_user_id: string | null;
  ec2_instance_id: string;
  // TODO
  oauth: {
    service_name: string;
    client_id: string;
  }[];
};

/** what is returned by Ganyemde API */
export type TG_Server = Omit<TD_Server, 'ec2_instance_id'> & {
  /**
   * host_user_id is null and ec2_instance_id is null => none
   * host_user_id is not null => hosted
   * ec2_instance_id is not null => aws
   */
  location: 'hosted' | 'aws' | 'none';
};

/** What server publish themselve to Shared States Server */
export type TServerPublishedInfo = {
  /** publish to Shared States Server by project server themselves */
  ip?: string;
  httpServices: {
    host: string;
    port: number;
    name: string;
    location: string;
    secure?: boolean;
  }[];
  /** last time server call api (network watchdog) */
  last_watchdog_at: string | null;
  /** Last time server was used by user or task (used for inactive project shutdown) */
  last_activity: string | null;
  /** system usage stats, cpu ram storage etc. */
  system?: ServerSystemInfo;
};

/** what is maintain in Shared States Server (SSS) : app-collab */
export type TSSS_Server = TG_Server &
  TServerPublishedInfo & {
    /** from AWS API via Ganymede API */
    ec2_instance_state: TEc2InstanceState | null;
  };

/** what server react component receive */
export type TServerComponentProps = Omit<
  TSSS_Server,
  | 'host_user_id'
  | 'last_activity'
  | 'last_watchdog_at'
  | 'project_id'
  | 'image_id'
> & {
  host?: TG_User;
  /** last time server call api (network watchdog) */
  last_watchdog_at: Date | null;
  /** Last time server was used by user or task (used for inactive project shutdown) */
  last_activity: Date | null;
  image: TG_ServerImage;
};

//

export type TServerComponentCallbacks = {
  onCloud: (InstanceType: string, storage: number) => Promise<void>;
  onCloudStart: () => Promise<void>;
  onCloudStop: () => Promise<void>;
  onCloudDelete: () => Promise<void>;
  //
  onHost: () => Promise<void>;
  onCopyCommand?: () => Promise<string>;
  /** remove server declaration in Demiurge */
  onDelete: () => Promise<void>;
  onOpenService?: (name: string) => Promise<void>;
};

export const TSSS_Server_to_TServerComponentProps = (
  server: TSSS_Server,
  host?: TG_User,
  images?: TG_ServerImage[]
): TServerComponentProps => {
  const image = images?.find((i) => i.image_id === server.image_id) || {
    image_id: -1,
    image_name: 'loading...',
    image_tag: 'loading...',
    image_sha256: 'loading...',
  };
  return {
    ...server,
    image,
    last_watchdog_at: server.last_watchdog_at
      ? new Date(server.last_watchdog_at)
      : null,
    last_activity: server.last_activity ? new Date(server.last_activity) : null,
    host,
  };
};

//

export type ServerSystemInfo = {
  cpu?: {
    usage: string; // "0.08, 0.18, 0.11",
    count: string; // "4",
    threads_per_core: string; // "2",
    model: string; // "Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz"
  };
  memory?: {
    free: number; // 13935,
    total: number; // 15926
  };
  disk?: {
    size: string; // "251.0G",
    usage: string; // "13.00%"
  };
  network?: {
    ping_time: string; // "197.507/202.170/209.814/5.448 ms"
  };
  graphic?: {
    cards: string; // "Nvidia TRX3060 Cuda 12.6"
  };
};

export type TEc2InstanceState =
  | 'allocating'
  | 'pending'
  | 'running'
  | 'shutting-down'
  | 'stopped'
  | 'stopping'
  | 'terminated';

//

export type TServer = TSSS_Server & { type: string };

export type TApi_Volume = {
  volume_id: number;
  volume_name: string;
  volume_storage: number;
};

export type TApi_Mount = {
  volume_id: number;
  volume_name: string;
  volume_storage: number;
  mount_point: string;
};

//

//

export const serviceUrl = (
  s: Pick<TServer, 'ip' | 'httpServices'>,
  serviceName: string,
  websocket = false
) => {
  const isBackend = typeof window === 'undefined';

  const service = s.httpServices.find((serv) => serv.name === serviceName);
  if (!service) return false;

  const host = isBackend ? s.ip : service.host;
  if (!host) return false;

  const port =
    isBackend ||
    // for jupyter stories with a local jupyterlab container
    (service.host === '127.0.0.1' && service.secure === false)
      ? service.port
      : undefined;

  const ssl = isBackend ? false : service.secure;

  return serverUrl({
    host,
    location: service.location,
    port,
    websocket,
    ssl,
  });
};
