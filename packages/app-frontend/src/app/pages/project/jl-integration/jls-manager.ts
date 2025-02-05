import { GanymedeApi } from '@monorepo/demiurge-data';
import {
  TDKID,
  TDemiurgeNotebookSharedData,
  TJKID,
  TJupyterServerInfo,
  dkidToServer,
  jupyterlabIsReachable,
  serverUrl,
} from '@monorepo/demiurge-types';
import { JupyterlabDriver } from '@monorepo/jupyterlab-api';
import { BrowserWidgetManager } from '@monorepo/jupyterlab-api-browser';
import { CollaborationProbe } from './jls-collaboration-probe';
import { TAwarenessUser } from '@monorepo/collaborative';

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

export type TOnNewDriverCb = (s: TJupyterServerInfo) => Promise<void>;

/**
 * JupyterLabs Manager
 */

export class JLsManager {
  _drivers: Map<number, Promise<JupyterlabDriver>> = new Map();
  _kernelPacks: Map<TDKID, TKernelPack> = new Map();
  _sd: TDemiurgeNotebookSharedData;
  _gatewayFQDN: string;
  _onNewDriver: TOnNewDriverCb;
  _ganymedeApi: GanymedeApi;

  _user: TAwarenessUser;
  _collaborationProbes: Map<number, CollaborationProbe | 'pending'> = new Map();

  /**
   *
   * @param sd
   * @param gatewayFQDN
   * @param onNewDriver
   */
  constructor(
    sd: TDemiurgeNotebookSharedData,
    api: GanymedeApi,
    gatewayFQDN: string,
    onNewDriver: TOnNewDriverCb,
    user: TAwarenessUser,
  ) {
    this._sd = sd;
    this._ganymedeApi = api;
    this._gatewayFQDN = gatewayFQDN;
    this._onNewDriver = onNewDriver;
    this._sd.projectServers.observe(() => this._onChange());
    this._user = user;
  }

  /**
   * when shared data change
   */
  private _onChange() {
    // for each kernel Pack,
    this._kernelPacks.forEach((kp) => this._updateKernelPack(kp));

    // for each server
    this._sd.projectServers.forEach(async (server) => {
      // we only consider jupyterlab server
      if (server.type === 'jupyter') {
        // if running and ready
        if (jupyterlabIsReachable(server)) {
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
          if (this._drivers.get(server.project_server_id))
            this._drivers.delete(server.project_server_id);
          if (this._collaborationProbes.get(server.project_server_id))
            this._collaborationProbes.delete(server.project_server_id);
        }
      }
    });
  }

  /**
   * sync kernel pack state with shared data
   * @param kp
   */
  private _updateKernelPack(kp: TKernelPack) {
    /**
     *  check if still exist, else delete
     *    - server still exist ?
     *    - kernel still exist ?
     */
    const s = this._sd.projectServers.get(`${kp.project_server_id}`);
    if (!s || s.type !== 'jupyter') {
      this._disposeKernelPack(kp);
      this._kernelPacks.delete(kp.dkid);
    } else {
      const k = s.kernels.find((k) => k.dkid === kp.dkid);
      if (!k) {
        this._disposeKernelPack(kp);
        this._kernelPacks.delete(kp.dkid);
      } else {
        /**
         * kernel still exist
         */
        if (jupyterlabIsReachable(s)) {
          // server is started
          if (lessThan(kp.state, 'server-started')) {
            // server has just started
            this._setState(kp, 'server-started');
          }
          if (k.jkid) {
            // kernel is started
            if (lessThan(kp.state, 'kernel-started')) {
              // kernel just started
              kp.jkid = k.jkid;
              this._setState(kp, 'kernel-started');
              // get driver
              this._getDriver(s).then((driver) => {
                this._setState(kp, 'driver-loaded');
                // connect kernel
                driver
                  .connectKernel(k.jkid as TJKID)
                  .then((kernelConnection) => {
                    this._setState(kp, 'kernel-connected');
                    // instantiate widget manager
                    const bwm = new BrowserWidgetManager(kernelConnection);
                    kp.widgetManager = bwm;
                    bwm.loadFromKernelDone.then(() => {
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
  getServerSetting = async (
    server: TJupyterServerInfo,
    websocket?: boolean,
  ) => {
    const oauth_client = server.oauth.find(
      (o) => o.service_name === 'jupyterlab',
    );
    if (!oauth_client) throw new Error('jupyterlab not mapped');

    const service = server.httpServices.find((s) => s.name === 'jupyterlab');
    if (!service) throw new Error('jupyterlab not mapped');

    let v;

    do {
      v = this._ganymedeApi._ts.get({ client_id: oauth_client.client_id });
      if (v.promise) await v.promise;
    } while (!v.value);
    const token = v.value.token.access_token;

    return {
      baseUrl: serverUrl({
        location: service.location,
        host: this._gatewayFQDN,
        websocket,
      }),
      token,
    };
  };

  /**
   *
   * @param project_server_id
   * @returns
   */
  private _getDriver(server: TJupyterServerInfo): Promise<JupyterlabDriver> {
    const p = this._drivers.get(server.project_server_id);
    if (!p) {
      const np = new Promise<JupyterlabDriver>((resolve, reject) => {
        this._onNewDriver(server).then(() => {
          this.getServerSetting(server).then((ss) => {
            const driver = new JupyterlabDriver(server.project_server_id, ss);
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
  getKernelPack(dkid: TDKID): TKernelPack | undefined {
    const p = this._kernelPacks.get(dkid);
    if (!p) {
      const r = dkidToServer(this._sd.projectServers, dkid);
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
      this._updateKernelPack(np);
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
    editor: any,
  ) {
    let probe = this._collaborationProbes.get(project_server_id);
    if (!probe || probe === 'pending') {
      console.log(
        `No probe for server [${project_server_id}], server does not exists or not started ?`,
      );
      return;
    }
    probe = probe as CollaborationProbe;
    probe.bindCellule(notebook, cellule, editor);
  }
}
