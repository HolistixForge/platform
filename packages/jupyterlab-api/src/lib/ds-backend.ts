import {
  TDKID,
  TJupyterKernelInfo,
  TJupyterServerData,
  TServerSettings,
  dkidToServer,
} from './types';
import { JupyterlabDriver } from './driver';
import { serverUrl } from '@monorepo/api-fetch';
import { TServer } from '@monorepo/demiurge-types';

//

export type TOnNewDriverCb = (s: TJupyterServerData) => Promise<void>;

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
    if (server && server.ip) {
      const service = server.httpServices.find(
        (srv) => srv.name === 'jupyterlab'
      );
      if (service) {
        const baseUrl = serverUrl({
          host: server.ip,
          location: service.location,
          port: 8888,
        });
        return {
          baseUrl,
          token,
        };
      }
    }
    throw new Error('no such server or is down');
  }

  //
  //

  async getDriver(dkid: TDKID, token: string) {
    /*
     * get server and kernel information from share data by dkid
     */
    const r = dkidToServer(this._jupyterServers, dkid);
    if (!r) throw new Error(`kernel [${dkid}] is unknown`);

    const { server, kernel } = r;

    /*
    if (!jupyterlabIsReachable(server))
      throw new Error(`jupyterlab not ready on server [${server_name}]`);

    TODO_: replace by an api call to check is alive

    export const jupyterlabIsReachable = (s: TJupyterServerInfo) => {
      const isCon = s.last_watchdog_at && secondAgo(s.last_watchdog_at) < 30;
      if (!isCon) return false;
      const service = s.httpServices.find((serv) => serv.name === 'jupyterlab');
      if (!service) return false;
      return true;
    };

    */

    /*
     * get the corresponding driver, (dedicated jupyterlab server driver)
     * by 'server id' (and 'token' if provided: only backend cause one driver per user)
     * or build it if it doesn't exist yet
     */

    const KEY = token;

    let driver = this._drivers.get(KEY);
    if (!driver) {
      await this._onNewDriver?.(server);
      driver = new JupyterlabDriver(
        this.getServerSetting(server.project_server_id, token)
      );
      this._drivers.set(KEY, driver);
    }

    return {
      server: server as TJupyterServerData,
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
