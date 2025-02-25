import { serverUrl } from '@monorepo/api-fetch';
import { TServer, TServersSharedData } from '@monorepo/servers';

import { CollaborationProbe } from './jls-collaboration-probe';
import { dkidToServer, TDKID, TJKID } from '../jupyter-types';
import { BrowserWidgetManager } from './browser-widget-manager';
import { JupyterlabDriver } from '../driver';
import { TJupyterSharedData } from '../jupyter-shared-model';
import { jupyterlabIsReachable, serviceUrl } from '../ds-backend';
import { injectWidgetsScripts } from './widgets-js-dependencies';

//

type TKernelState =
  | 'server-stopped'
  | 'server-started'
  | 'kernel-started'
  | 'driver-loaded'
  | 'kernel-connected'
  | 'widget-manager-loaded';

type TKSProgress = { [key in TKernelState]: number };

const ksProgress: TKSProgress = {
  'server-stopped': 0,
  'server-started': 15,
  'kernel-started': 40,
  'driver-loaded': 75,
  'kernel-connected': 85,
  'widget-manager-loaded': 100,
};

export const lessThan = (s1: TKernelState, s2: TKernelState) =>
  ksProgress[s1] < ksProgress[s2];

export const greaterThan = (s1: TKernelState, s2: TKernelState) =>
  ksProgress[s1] > ksProgress[s2];

/**
 *
 */

export type TKernelPack = {
  project_server_id: number;
  dkid: TDKID;
  state: TKernelState;
  progress: number;
  jkid?: TJKID;
  widgetManager: BrowserWidgetManager | null;
  listeners: (() => void)[];
};

export type TOnNewDriverCb = (s: TServer) => Promise<void>;

/**
 * JupyterLabs Manager
 */

export class JLsManager {
  _drivers: Map<number, Promise<JupyterlabDriver>> = new Map();
  _kernelPacks: Map<TDKID, TKernelPack> = new Map();
  _sd: TJupyterSharedData & TServersSharedData;
  getToken: (s: TServer) => Promise<string>;
  _collaborationProbes: Map<number, CollaborationProbe | 'pending'> = new Map();

  /**
   *
   * @param sd
   * @param gatewayFQDN
   * @param onNewDriver
   */
  constructor(
    sd: TJupyterSharedData & TServersSharedData,
    getToken: (s: TServer) => Promise<string>
  ) {
    this._sd = sd;
    this.getToken = getToken;
    this._sd.jupyterServers.observe(() => this._onChange());
  }

  //

  private _onNewDriver(server: TServer) {
    if (server.type === 'jupyter') {
      const service = server.httpServices.find(
        (srv) => srv.name === 'jupyterlab'
      );
      if (service) {
        injectWidgetsScripts(
          serverUrl({
            host: service.host,
            location: service.location,
          })
        );
      }
    }
    return Promise.resolve();
  }

  /**
   * when shared data change
   */
  private _onChange() {
    // for each kernel Pack,
    this._kernelPacks.forEach(async (kp) => await this._updateKernelPack(kp));

    // for each server
    this._sd.jupyterServers.forEach(async (jupyterServer) => {
      const server = this._sd.projectServers.get(
        `${jupyterServer.project_server_id}`
      );

      // if running and ready
      if (server && (await jupyterlabIsReachable(server))) {
        // create probe if necessary
        /*
          TODO_JL_PROBE: uncomment
          if (!this._collaborationProbes.get(server.project_server_id)) {
            this._collaborationProbes.set(server.project_server_id, 'pending');
            const ss = await this.getServerSetting(server);
            this._collaborationProbes.set(
              server.project_server_id,
              new CollaborationProbe(server, ss, this._user)
            );
          }
          */
      }
      // else
      else {
        // delete driver and probe for stopped servers
        if (this._drivers.get(jupyterServer.project_server_id))
          this._drivers.delete(jupyterServer.project_server_id);
        if (this._collaborationProbes.get(jupyterServer.project_server_id))
          this._collaborationProbes.delete(jupyterServer.project_server_id);
      }
    });
  }

  /**
   * sync kernel pack state with shared data
   * @param kp
   */
  private async _updateKernelPack(kp: TKernelPack) {
    /**
     *  check if still exist, else delete
     *    - server still exist ?
     *    - kernel still exist ?
     */
    const server = this._sd.projectServers.get(`${kp.project_server_id}`);
    const jupyterServer = this._sd.jupyterServers.get(
      `${kp.project_server_id}`
    );

    const log = (...args: any[]) => {};

    log('updateKernelPack', { kp, server, jupyterServer });

    if (!server || !jupyterServer) {
      this._disposeKernelPack(kp);
      this._kernelPacks.delete(kp.dkid);
    } else {
      const k = jupyterServer.kernels.find((k) => k.dkid === kp.dkid);
      if (!k) {
        this._disposeKernelPack(kp);
        this._kernelPacks.delete(kp.dkid);
      } else {
        /**
         * kernel still exist
         */

        log('go to jupyterlabIsReachable');

        if (await jupyterlabIsReachable(server)) {
          // server is started
          if (lessThan(kp.state, 'server-started')) {
            // server has just started
            this._setState(kp, 'server-started');
          }
          if (k.jkid) {
            log('kernel is started');
            // kernel is started
            if (lessThan(kp.state, 'kernel-started')) {
              // kernel just started
              kp.jkid = k.jkid;
              this._setState(kp, 'kernel-started');
              // get driver
              this._getDriver(server).then((driver) => {
                log('driver loaded', driver);
                this._setState(kp, 'driver-loaded');
                // connect kernel
                driver
                  .connectKernel(k.jkid as TJKID)
                  .then((kernelConnection) => {
                    log('kernel connected');
                    this._setState(kp, 'kernel-connected');
                    // instantiate widget manager
                    const bwm = new BrowserWidgetManager(kernelConnection);
                    kp.widgetManager = bwm;
                    bwm.loadFromKernelDone.then(() => {
                      log('widget manager loaded');
                      this._setState(kp, 'widget-manager-loaded');
                    });
                  });
              });
            }
          } else {
            // kernel is stopped
            if (greaterThan(kp.state, 'server-started')) {
              // kernel just stopped
              this._setState(kp, 'server-started');
            }
          }
        } else {
          // server is stopped
          if (greaterThan(kp.state, 'server-stopped')) {
            // server just stopped
            this._setState(kp, 'server-stopped');
          }
        }
      }
    }
  }

  /**
   *
   */
  getServerSetting = async (server: TServer, websocket?: boolean) => {
    const service = server.httpServices.find((s) => s.name === 'jupyterlab');
    if (!service) throw new Error('jupyterlab not mapped');

    const token = await this.getToken(server);

    const url = serviceUrl(server, websocket);
    if (!url)
      throw new Error(
        `no such server or is down [${server.project_server_id}, ${server.server_name}]`
      );

    const r = {
      baseUrl: url,
      token,
    };

    return r;
  };

  /**
   *
   * @param project_server_id
   * @returns
   */
  private _getDriver(server: TServer): Promise<JupyterlabDriver> {
    const p = this._drivers.get(server.project_server_id);
    if (!p) {
      const np = new Promise<JupyterlabDriver>((resolve, reject) => {
        this._onNewDriver(server).then(() => {
          this.getServerSetting(server).then((ss) => {
            const driver = new JupyterlabDriver(ss);
            resolve(driver);
          });
        });
      });
      this._drivers.set(server.project_server_id, np);
      return np;
    }
    return p;
  }

  /**
   * set a kernel pack a new state and call listener
   * @param kp
   * @param s
   */
  private _setState(kp: TKernelPack, s: TKernelState) {
    kp.state = s;
    kp.progress = ksProgress[s];
    if (lessThan(s, 'kernel-started')) {
      kp.widgetManager?.disconnect();
      kp.widgetManager?.kernel.dispose();
      kp.widgetManager = null;
      kp.jkid = undefined;
    }
    kp.listeners.forEach((f) => f());
  }

  /**
   * free ressource in a kernel pack to be deleted
   * @param kp the kernel pack to free
   */
  private _disposeKernelPack(kp: TKernelPack) {
    console.error('?');
  }

  /**
   * return the kernel pack for demiurge kernel id 'dkid'
   * build a new kernel pack if necessary
   * @param dkid the demiurge kernel id
   */
  async getKernelPack(dkid: TDKID): Promise<TKernelPack | undefined> {
    const p = this._kernelPacks.get(dkid);
    if (!p) {
      const r = dkidToServer(this._sd.jupyterServers as any, dkid);
      if (r === undefined) return undefined;
      const { server } = r;

      const np: TKernelPack = {
        project_server_id: server.project_server_id,
        dkid,
        state: 'server-stopped',
        progress: 0,
        widgetManager: null,
        listeners: [],
      };
      await this._updateKernelPack(np);
      this._kernelPacks.set(dkid, np);
      return np;
    } else return p;
  }

  /**
   * add a listener to be called ach time the pack state change
   * @param dkid the demiurge kernel id
   * @param f  the callback to add
   */
  addListener(dkid: TDKID, f: () => void) {
    const p = this._kernelPacks.get(dkid);
    if (!p) throw new Error(`no kernel pack for id [${dkid}]`);
    p.listeners.push(f);
  }

  /**
   * remove a previously added listener
   * @param dkid the demiurge kernel id
   * @param f the callback to remove
   */
  removeListener(dkid: TDKID, f: () => void) {
    const p = this._kernelPacks.get(dkid);
    if (p) p.listeners = p.listeners.filter((l) => Object.is(l, f));
  }

  /**
   *
   * @param project_server_id
   * @param notebook
   * @param cellule
   */
  bindCellule(
    project_server_id: number,
    notebook: string,
    cellule: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor: any
  ) {
    let probe = this._collaborationProbes.get(project_server_id);
    if (!probe || probe === 'pending') {
      console.log(
        `No probe for server [${project_server_id}], server does not exists or not started ?`
      );
      return;
    }
    probe = probe as CollaborationProbe;
    probe.bindCellule(notebook, cellule, editor);
  }
}
