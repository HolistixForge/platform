import { serverUrl } from '@monorepo/api-fetch';
import { TJsonObject } from '@monorepo/simple-types';

/** What user containers publish themselve */
export type TUserContainerPublishedInfo = {
  /** publish to Shared States Server by user containers themselves */
  ip?: string;
  httpServices: {
    host: string;
    port: number;
    name: string;
    secure?: boolean;
  }[];
  /** last time container call api (network watchdog) */
  last_watchdog_at: string | null;
  /** Last time container was used by user or task (used for inactive project shutdown) */
  last_activity: string | null;
  /** system usage stats, cpu ram storage etc. */
  system?: UserContainerSystemInfo;
};

/** what is maintain in Shared States Server (SSS) : app-gateway */
export type TUserContainer = {
  user_container_id: string;
  container_name: string;
  image_id: string;
  oauth: {
    service_name: string;
    client_id: string;
  }[];
  runner: { id: string } & TJsonObject;
  created_at: string;
} & TUserContainerPublishedInfo;

//

export type UserContainerSystemInfo = {
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

//

export const serviceUrl = (
  s: Pick<TUserContainer, 'ip' | 'httpServices'>,
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
    location: '',
    port,
    websocket,
    ssl,
  });
};
