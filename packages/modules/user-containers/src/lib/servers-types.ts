import { serverUrl } from '@holistix-forge/api-fetch';
import { TJsonObject } from '@holistix-forge/simple-types';

/**
 * token given to users's project server container
 */
export type TJwtUserContainer = {
  type: 'user_container_token';
  project_id: string;
  user_container_id: string;
  scope: string;
};

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
  /**
   * Per-container OAuth client used by the auth guard.
   *
   * The matching secret is deliberately absent: this type is stored in collab
   * shared state, which is a CRDT replicated to every client in the project.
   * The secret stays on the gateway and reaches the container through its
   * environment only — see `TRunnerConfig.auth_guard_client_secret`.
   */
  auth_guard?: {
    client_id: string;
  };
  /**
   * Where this service runs, and for a local placement, which machine.
   *
   * `{ id: 'local', user_id, machine_id }` — one enrolled machine. Both
   * fields, and not just the owner: "local" is not one place, and neither is
   * one person. Enrolment mints an identifier per machine, so a member with a
   * laptop and a desktop has two, and `user_id` alone cannot say which of them
   * was asked. The runner on the other end refuses a placement that does not
   * name it, so an ambiguous one is a placement nobody will act on.
   *
   * `{ id: 'platform', host, runtime }` — the platform, owned by no one, and
   * carrying no machine: there is only one.
   *
   * Whatever the runner reports back on start is merged in alongside.
   */
  runner: {
    id: string;
    user_id?: string;
    machine_id?: string;
  } & TJsonObject;
  created_at: string;
} & TUserContainerPublishedInfo;

/**
 * A runner this gateway actually offers.
 *
 * Replicated to the frontend because the set is deployment-dependent: the
 * platform runner only registers where a container broker is configured, and a
 * UI that offers it anyway hands the user a button that fails on click.
 */
export type TContainerRunnerInfo = {
  runnerId: string;
};

/**
 * A machine enrolled in this project, and whether it is still there.
 *
 * Distinct from `TContainerRunnerInfo`, which lists the *kinds* of runner a
 * deployment offers. This is the instances: "local" is not one place, and a
 * project needs to know which machines it can actually reach.
 *
 * A machine appears here when its owner makes the first placement on it, which
 * is how it opts into the project. It stays only while its runner keeps saying
 * so — liveness is derived from `last_health_at` the same way a container's is
 * derived from `last_watchdog_at`, on the same 30 second threshold, because a
 * runner that stopped answering and a machine that was closed are the same
 * thing to everyone else in the project.
 */
export type TRunnerMachine = {
  /** Stable across restarts; assigned at enrolment. */
  machine_id: string;
  /** Whose machine. Only its owner can make the first placement on it. */
  user_id: string;
  /** What to show in the UI — a hostname, usually. */
  label: string;
  /** Last `health` from the runner, or null if it never sent one. */
  last_health_at: string | null;
};

/**
 * Whether a machine is still reachable.
 *
 * Shares the 30 second threshold with the container watchdog rather than
 * inventing its own: the two mean the same thing to a user looking at a card,
 * and two different timeouts would show a live container on a dead machine.
 */
export const MACHINE_HEALTH_TIMEOUT_SECONDS = 30;

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
