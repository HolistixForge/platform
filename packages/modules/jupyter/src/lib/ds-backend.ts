import { TServer, serviceUrl } from '@monorepo/servers';

import {
  TDKID,
  TJupyterKernelInfo,
  TJupyterServerData,
  TServerSettings,
  dkidToServer,
} from './jupyter-types';
import { JupyterlabDriver } from './driver';

//

export type TOnNewDriverCb = (s: TJupyterServerData) => Promise<void>;

//

export const jupyterlabIsReachable = async (s: TServer) => {
  let r = false;
  const url = serviceUrl(s, 'jupyterlab');
  if (url)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const response = await fetch(`${url}/api`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.status === 200) r = true;
    } catch (error) {
      //
    }
  /*
  console.log(
    `jupyterlabIsReachable (${s.server_name})`,
    url ? url : 'no jupyterlab service',
    r
  );
  */
  return r;
};

//

export class DriversStoreBackend {
  //
  _drivers: Map<string, JupyterlabDriver> = new Map();
  _jupyterServers: Map<string, TJupyterServerData>;
  _servers: Map<string, TServer>;
  _onNewDriver?: TOnNewDriverCb;

  //

  constructor(
    jss: Map<string, TJupyterServerData>,
    pss: Map<string, TServer>,
    onNewDriver?: TOnNewDriverCb
  ) {
    this._jupyterServers = jss;
    this._servers = pss;
    this._onNewDriver = onNewDriver;
  }

  //
  //

  getServerSetting(psid: number, token: string): TServerSettings {
    const server = this._servers.get(`${psid}`);
    if (server) {
      const url = serviceUrl(server, 'jupyterlab');
      if (!url)
        throw new Error(
          `no such server or is down [${psid}, ${server.server_name}]`
        );
      return {
        baseUrl: url,
        token,
      };
    }
    throw new Error(`no such server or is down [${psid}]`);
  }

  //
  //

  async getDriver(dkid: TDKID, token: string) {
    /*
     * get server and kernel information from share data by dkid
     */
    const r = dkidToServer(this._jupyterServers, dkid);
    if (!r) throw new Error(`kernel [${dkid}] is unknown`);

    const server = this._servers.get(`${r.server.project_server_id}`);
    if (!server)
      throw new Error(`server [${r.server.project_server_id}] is unknown`);

    const { server: jupyterServer, kernel } = r;

    if (!jupyterlabIsReachable(server))
      throw new Error(`jupyterlab not ready on server [${server.server_name}]`);

    /*
     * get the corresponding driver, (dedicated jupyterlab server driver)
     * by 'server id' (and 'token' if provided: only backend cause one driver per user)
     * or build it if it doesn't exist yet
     */

    const KEY = token;

    let driver = this._drivers.get(KEY);
    if (!driver) {
      await this._onNewDriver?.(jupyterServer);
      driver = new JupyterlabDriver(
        this.getServerSetting(server.project_server_id, token)
      );
      this._drivers.set(KEY, driver);
    }

    return {
      server: jupyterServer as TJupyterServerData,
      kernel: kernel as TJupyterKernelInfo,
      driver,
    };
  }

  /**
   * delete all drivers (for all users) for this project_server_id
   * @param project_server_id
   */

  /*
  TODO_: delete (LRU ? or ? ...)
  async deleteDrivers(project_server_id: number) {
    const keys = this._drivers.entries();
    for (const [key, driver] of keys) {
      if (driver.project_server_id === project_server_id)
        this._drivers.delete(key);
    }
  }
  */
}
