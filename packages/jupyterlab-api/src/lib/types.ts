import { ServerConnection } from '@jupyterlab/services';
import * as nbformat from '@jupyterlab/nbformat';

//

export type IOutput = nbformat.IOutput;

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

export type TJupyterServerData = {
  type: 'jupyter';
  kernels: Array<TJupyterKernelInfo>;
  ip?: string;
  httpServices: { name: string; location: string; port: number }[];
};

/**
 * little helper function that go through servers Map to find which one
 * has a kernel with the given 'demiurge kernel id'
 */

export const dkidToServer = (
  projectServers: Map<string, TJupyterServerData>,
  dkid: TDKID
): { server: TJupyterServerData; kernel: TJupyterKernelInfo } | undefined => {
  //
  let server: TJupyterServerData | null = null;
  let kernel: TJupyterKernelInfo | null = null;

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
