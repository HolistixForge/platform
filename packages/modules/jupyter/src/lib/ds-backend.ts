import { TUserContainer, serviceUrl } from '@holistix-forge/user-containers';

import { TJupyterServerData, TUserContainerSettings } from './jupyter-types';
import { JupyterlabDriver } from './driver';
import { SharedMap } from '@holistix-forge/collab-engine';

//

export type TOnNewDriverCb = (s: TJupyterServerData) => Promise<void>;

//

export const jupyterlabIsReachable = async (s: TUserContainer) => {
  let r = false;
  const url = serviceUrl(s, 'jupyterlab');
  if (url)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${url}/api`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.status === 200) r = true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  _jupyterServers: SharedMap<TJupyterServerData>;
  _servers: SharedMap<TUserContainer>;
  _onNewDriver?: TOnNewDriverCb;

  //

  constructor(
    jss: SharedMap<TJupyterServerData>,
    pss: SharedMap<TUserContainer>,
    onNewDriver?: TOnNewDriverCb
  ) {
    this._jupyterServers = jss;
    this._servers = pss;
    this._onNewDriver = onNewDriver;
  }

  //
  //

  getServerSetting(psid: string, token: string): TUserContainerSettings {
    const server = this._servers.get(`${psid}`);
    if (server) {
      const url = serviceUrl(server, 'jupyterlab');
      if (!url)
        throw new Error(
          `no such server or is down [${psid}, ${server.container_name}]`
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

  async getDriver(user_container_id: string, token: string) {
    /*
     * get server and kernel information from share data by dkid
     */

    const server = this._servers.get(`${user_container_id}`);
    if (!server) throw new Error(`server [${user_container_id}] is unknown`);

    if (!jupyterlabIsReachable(server))
      throw new Error(
        `jupyterlab not ready on server [${server.container_name}]`
      );

    /*
     * get the corresponding driver, (dedicated jupyterlab server driver)
     * by 'server id' (and 'token' if provided: only backend cause one driver per user)
     * or build it if it doesn't exist yet
     */

    const jupyterServer = this._jupyterServers.get(`${user_container_id}`);
    if (!jupyterServer)
      throw new Error(`server [${user_container_id}] is unknown`);

    const KEY = token;

    let driver = this._drivers.get(KEY);
    if (!driver) {
      await this._onNewDriver?.(jupyterServer);
      driver = new JupyterlabDriver(
        this.getServerSetting(server.user_container_id, token)
      );
      this._drivers.set(KEY, driver);
    }

    return driver;
  }
}
