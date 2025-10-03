import { serverUrl } from '@monorepo/api-fetch';
import {
  TServer,
  TServersSharedData,
  serviceUrl,
} from '@monorepo/user-containers';
import { Listenable } from '@monorepo/simple-types';
import { FrontendDispatcher } from '@monorepo/collab-engine';

import { BrowserWidgetManager } from './browser-widget-manager';
import { JupyterlabDriver } from '../driver';
import { TJupyterSharedData } from '../jupyter-shared-model';
import { TJupyterEvent } from '../jupyter-events';
import { jupyterlabIsReachable } from '../ds-backend';
import { injectWidgetsScripts } from './widgets-js-dependencies';

//

const SERVER_DOES_NOT_EXIST = 0;
const KERNEL_DOES_NOT_EXIST = 1;
const UNREACHABLE = 2;
const DRIVER_LOADING = 3;
const CONNECTING_KERNEL = 4;
const WIDGET_MANAGER_LOADING = 5;
const READY = 6;

export const stateToProgress = (state: number) => {
  return Math.ceil((state / READY) * 100);
};

export const stateToLabel = (state: number) => {
  switch (state) {
    case READY:
      return 'Ready';
    case DRIVER_LOADING:
      return 'Driver Loading';
    case CONNECTING_KERNEL:
      return 'Connecting Kernel';
    case WIDGET_MANAGER_LOADING:
      return 'Widget Manager Loading';
    case SERVER_DOES_NOT_EXIST:
      return 'Server Does Not Exist';
    case KERNEL_DOES_NOT_EXIST:
      return 'Kernel Does Not Exist';
    case UNREACHABLE:
      return 'Unreachable';
    default:
      return 'Unknown';
  }
};

//

export type TKernelPack = {
  project_server_id: number;
  kernel_id: string;
  state: number;
  widgetManager: BrowserWidgetManager | null;
  listeners: (() => void)[];
};

export type TOnNewDriverCb = (s: TServer) => Promise<void>;

/**
 * JupyterLabs Manager
 */

export class JLsManager extends Listenable {
  _drivers: Map<number, Promise<JupyterlabDriver>> = new Map();
  _kernelPacks: Map<string, TKernelPack> = new Map();

  _sd: TJupyterSharedData & TServersSharedData;
  _dispatcher: FrontendDispatcher<TJupyterEvent>;

  getToken: (s: TServer, serviceName: string) => Promise<string>;

  constructor(
    sd: TJupyterSharedData & TServersSharedData,
    dispatcher: FrontendDispatcher<TJupyterEvent>,
    getToken: (s: TServer, serviceName: string) => Promise<string>
  ) {
    super();
    this._sd = sd;
    this._dispatcher = dispatcher;
    this.getToken = getToken;
    this._sd.projectServers.observe(() => this._onChange());
    this._sd.jupyterServers.observe(() => this._onChange());
  }

  /**
   * when shared data change
   */
  private _onChange() {
    this._kernelPacks.forEach((kp) => this._updateKernelPack(kp));
  }

  //

  private async _updateKernelPack(kp: TKernelPack) {
    const server = this._sd.projectServers.get(`${kp.project_server_id}`);
    const jupyterServer = this._sd.jupyterServers.get(
      `${kp.project_server_id}`
    );

    if (!server || !jupyterServer) {
      this._changeKernelPackState(kp, SERVER_DOES_NOT_EXIST);
      return;
    }

    const kernel = jupyterServer.kernels[kp.kernel_id];
    if (!kernel) {
      this._changeKernelPackState(kp, KERNEL_DOES_NOT_EXIST);
      return;
    }

    if (!(await jupyterlabIsReachable(server))) {
      this._changeKernelPackState(kp, UNREACHABLE);
      return;
    }

    // was previously unreachable
    if (kp.state <= UNREACHABLE) {
      this._changeKernelPackState(kp, DRIVER_LOADING);
      // get driver
      this._getDriver(server).then((driver) => {
        if (kp.widgetManager) {
          this._changeKernelPackState(kp, READY);
        } else {
          this._changeKernelPackState(kp, CONNECTING_KERNEL);
          // connect kernel
          driver.connectKernel(kernel.kernel_id).then((kernelConnection) => {
            this._changeKernelPackState(kp, WIDGET_MANAGER_LOADING);
            // instantiate widget manager
            const bwm = new BrowserWidgetManager(kernelConnection);
            kp.widgetManager = bwm;
            bwm.loadFromKernelDone.then(() => {
              this._changeKernelPackState(kp, READY);
            });
          });
        }
      });
    }
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
  //

  public async getServerSetting(server: TServer, websocket?: boolean) {
    const token = await this.getToken(server, 'jupyterlab');

    const url = serviceUrl(server, 'jupyterlab', websocket);
    if (!url)
      throw new Error(
        `no such server or is down [${server.project_server_id}, ${server.server_name}]`
      );

    const r = {
      baseUrl: url,
      token,
    };

    return r;
  }

  //

  private _getDriver(server: TServer): Promise<JupyterlabDriver> {
    const p = this._drivers.get(server.project_server_id);
    if (!p) {
      const np = new Promise<JupyterlabDriver>((resolve, reject) => {
        this._onNewDriver(server).then(() => {
          this.getServerSetting(server).then((ss) => {
            const driver = new JupyterlabDriver(ss);
            driver.subscribeResourceListener(() => {
              const resources = {
                kernels: driver.getKernels(),
                terminals: driver.getTerminals(),
              };
              // send new resource to backend, that it will push back through shared state
              // that will trig _onChange() and update kernel packs and UI
              this._dispatcher.dispatch({
                type: 'jupyter:resources-changed',
                project_server_id: server.project_server_id,
                resources,
              });
            });
            resolve(driver);
          });
        });
      });
      this._drivers.set(server.project_server_id, np);
      return np;
    }
    return p;
  }

  //

  // just ensure a driver is created, it will start polling resources
  public startPollingResources(server: TServer) {
    this._getDriver(server);
  }

  //

  private _changeKernelPackState(kp: TKernelPack, s: number) {
    kp.state = s;
    kp.listeners.forEach((f) => f());
  }

  //

  public getKernelPack(
    project_server_id: number,
    kernel_id: string
  ): TKernelPack | false {
    const pack = this._kernelPacks.get(kernel_id);

    if (!pack) {
      const newPack: TKernelPack = {
        project_server_id,
        kernel_id,
        state: SERVER_DOES_NOT_EXIST,
        widgetManager: null,
        listeners: [],
      };

      this._updateKernelPack(newPack);

      this._kernelPacks.set(kernel_id, newPack);
      return newPack;
    } else return pack;
  }

  //

  override addListener(f: () => void, dkid: string) {
    const p = this._kernelPacks.get(dkid);
    if (p) p.listeners.push(f);
  }

  //

  override removeListener(f: () => void, dkid: string) {
    const p = this._kernelPacks.get(dkid);
    if (p) p.listeners = p.listeners.filter((l) => Object.is(l, f));
  }
}
