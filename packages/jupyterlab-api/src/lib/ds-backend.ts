import {
  TDKID,
  TJupyterKernelInfo,
  TJupyterServerInfo,
  TServerSettings,
  dkidToServer,
} from './types';
import { JupyterlabDriver } from './driver';
import { serverUrl } from '@monorepo/api-fetch';

//

export type TOnNewDriverCb = (s: TJupyterServerInfo) => Promise<void>;

//

export class DriversStoreBackend {
  //
  _drivers: Map<string, JupyterlabDriver> = new Map();
  _projectServers: Map<string, TJupyterServerInfo>;
  _onNewDriver?: TOnNewDriverCb;

  //

  constructor(
    pss: Map<string, TJupyterServerInfo>,
    onNewDriver?: TOnNewDriverCb
  ) {
    this._projectServers = pss;
    this._onNewDriver = onNewDriver;
  }

  //
  //

  getServerSetting(s: TJupyterServerInfo, token: string): TServerSettings {
    const service = s.httpServices.find((srv) => srv.name === 'jupyterlab');
    const baseUrl =
      service && s.ip
        ? serverUrl({
            host: s.ip,
            location: service.location,
            port: 8888,
          })
        : '';

    return {
      baseUrl,
      token,
    };
  }

  //
  //

  async getDriver(dkid: TDKID, token: string) {
    /*
     * get server and kernel information from share data by dkid
     */
    const r = dkidToServer(this._projectServers, dkid);
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
      driver = new JupyterlabDriver(this.getServerSetting(server, token));
      this._drivers.set(KEY, driver);
    }

    return {
      server: server as TJupyterServerInfo,
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
