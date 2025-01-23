import { ServerConnection } from '@jupyterlab/services';
import { TNotebookNode } from './node-types';
import { secondAgo } from '@monorepo/simple-types';
import { TSSS_Server } from '../project-server';

export type TDKID = string;

export type TJKID = string;

export type TKernelType = 'python3';

export type TServerSettings = {
  baseUrl: ServerConnection.ISettings['baseUrl'];
  token?: ServerConnection.ISettings['token'];
};

//

export type TJupyterKernelInfo = {
  dkid: TDKID;
  jkid?: TJKID;
  kernelName: string;
  kernelType: TKernelType;
};

export type TJupyterSpecificInfo = {
  type: 'jupyter';
  kernels: Array<TJupyterKernelInfo>;
};

export type TJupyterServerInfo = TSSS_Server & TJupyterSpecificInfo;

export type TPgadminSpecificInfo = {
  type: 'pgadmin';
};

export type TPgadminServerInfo = TSSS_Server & TPgadminSpecificInfo;

//

export type TServer = TJupyterServerInfo | TPgadminServerInfo;

//

/**
 * return a full url for a server, ssl default to true
 */

export const serverUrl = (a: {
  host: string;
  location: string;
  websocket?: boolean;
  ssl?: boolean;
  port?: number;
}) => {
  const { host, location, websocket, ssl, port } = a;

  let l = location;
  if (!l.startsWith('/')) l = `/${l}`;

  let protocol = 'http';
  if (websocket) protocol = 'ws';
  if (ssl === undefined || ssl === true) protocol = `${protocol}s`;

  return `${protocol}://${host}:${port || ''}${l}`;
};

/**
 *
 */

export type TNodeCommon = {
  id: string;
  busy?: boolean;
};

export type TNodeData = TNodeCommon & TNotebookNode;

export type TProjectMeta = {
  projectActivity: {
    last_activity: string;
    gateway_shutdown: string;
  };
};

/**
 * little helper function that go through servers Map to find which one
 * has a kernel with the given 'demiurge kernel id'
 */

export const dkidToServer = (
  projectServers: Map<string, TServer>,
  dkid: TDKID
): { server: TJupyterServerInfo; kernel: TJupyterKernelInfo } | undefined => {
  let server: TJupyterServerInfo | null = null,
    kernel: TJupyterKernelInfo | null = null;

  projectServers.forEach((s) => {
    const k = s.type === 'jupyter' && s.kernels.find((k) => k.dkid === dkid);
    if (k) {
      server = s;
      kernel = k;
    }
  });

  if (!server || !kernel) return undefined;

  return { server, kernel };
};

//

export const jupyterlabIsReachable = (s: TJupyterServerInfo) => {
  const isCon = s.last_watchdog_at && secondAgo(s.last_watchdog_at) < 30;
  if (!isCon) return false;
  const service = s.httpServices.find((serv) => serv.name === 'jupyterlab');
  if (!service) return false;
  return true;
};
