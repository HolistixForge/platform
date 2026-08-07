import { serverUrl } from '@holistix-forge/api-fetch';
import {
  TUserContainer,
  TUserContainersSharedData,
  serviceUrl,
} from '@holistix-forge/user-containers';
import { Listenable } from '@holistix-forge/simple-types';
import { FrontendDispatcher } from '@holistix-forge/reducers/frontend';

// Type-only, so nothing of it is evaluated when this module loads.
//
// `BrowserWidgetManager` reaches `@jupyter-widgets/html-manager`, which pulls a
// jQuery-UI slider that reads globals *while it is being evaluated* — built for
// webpack, where a ProvidePlugin supplies them. Imported eagerly, loading the
// Jupyter module took the whole application down before React mounted: a blank
// page and "ReferenceError: jQuery is not defined", then "Cannot read
// properties of undefined (reading 'mouse')" once jQuery was supplied.
//
// Widgets are an optional capability of one node type. Loading them the moment
// a kernel connects — and only then — costs nothing anyone will notice and
// keeps every other node, the terminal among them, independent of them.
import type { BrowserWidgetManager } from './browser-widget-manager';
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
  user_container_id: string;
  kernel_id: string;
  state: number;
  widgetManager: BrowserWidgetManager | null;
  listeners: (() => void)[];
};

export type TOnNewDriverCb = (s: TUserContainer) => Promise<void>;

/**
 * JupyterLabs Manager
 */

export class JLsManager extends Listenable {
  _drivers: Map<string, Promise<JupyterlabDriver>> = new Map();

  /** How many things are showing each container. See `watchResources`. */
  private _watchers: Map<string, number> = new Map();
  _kernelPacks: Map<string, TKernelPack> = new Map();

  /**
   * Resolves shared data for a project. Collab holds one document per project
   * since the registry landed, so there is no single set of shared data to
   * hand a manager built once at module load.
   */
  _getSharedData: (
    project_id: string
  ) => TJupyterSharedData & TUserContainersSharedData;

  _project_id: string | null = null;
  _sd: (TJupyterSharedData & TUserContainersSharedData) | null = null;

  _dispatcher: FrontendDispatcher<TJupyterEvent>;

  getToken: (s: TUserContainer, serviceName: string) => Promise<string>;

  constructor(
    getSharedData: (
      project_id: string
    ) => TJupyterSharedData & TUserContainersSharedData,
    dispatcher: FrontendDispatcher<TJupyterEvent>,
    getToken: (s: TUserContainer, serviceName: string) => Promise<string>
  ) {
    super();
    // The accessor, not the data. `frontend.ts` has always passed a function
    // here — `new JLsManager(getSharedData as any, …)` — and the constructor
    // indexed it as if it were the shared data itself. `as any` silenced
    // exactly the error that mattered, so the module threw on load with
    // "Cannot read properties of undefined (reading 'observe')" and the whole
    // Jupyter module failed to load. Four stories showed it; nothing else did.
    this._getSharedData = getSharedData;
    this._dispatcher = dispatcher;
    this.getToken = getToken;
  }

  /**
   * Point the manager at a project, the way `FrontendDispatcher.setProjectId`
   * does. Observation starts here rather than in the constructor: at
   * construction there is no project yet, and there is no longer one set of
   * shared data to observe.
   *
   * Idempotent for the same project, so a re-render costs nothing.
   */
  public setProjectId(project_id: string) {
    if (this._project_id === project_id && this._sd) return;

    // Off the previous project's documents first.
    //
    // `observe` was called without a matching `unobserve`, so every project
    // switch left another live observer on a document nobody is looking at —
    // and each of them still calls `_onChange`, which recomputes every pack
    // against whichever project is current. They accumulate for the life of
    // the page.
    this._detachObservers();

    this._project_id = project_id;
    this._sd = this._getSharedData(project_id);

    const onChange = () => this._onChange();
    this._sd['user-containers:containers'].observe(onChange);
    this._sd['jupyter:servers'].observe(onChange);
    this._detachObservers = () => {
      this._sd?.['user-containers:containers'].unobserve(onChange);
      this._sd?.['jupyter:servers'].unobserve(onChange);
      this._detachObservers = () => undefined;
    };

    // And recompute what already exists.
    //
    // `useKernelPack` calls `getKernelPack` during render, and this runs from
    // an effect — so every pack on the first render was built while `_sd` was
    // still null. `_updateKernelPack` returns early in that state, leaving the
    // pack at its initial `SERVER_DOES_NOT_EXIST`, and nothing here recomputed
    // it: the panel stayed greyed out with the server running until some
    // unrelated shared-data change happened to fire.
    this._onChange();
  }

  /**
   * Undoes the observers installed for the current project.
   *
   * Not unit-tested, and it is worth saying why rather than leaving the gap
   * silent: this module cannot be loaded under Jest at all. Importing it
   * reaches `@jupyter-widgets/html-manager`, which is ESM — and allowing Jest
   * to transform it only gets as far as `@lumino/dragdrop` wanting a `DragEvent`
   * that jsdom does not define. That is why this package has one dummy spec and
   * nothing else. What does exercise it is the Storybook suite, which loads the
   * Jupyter stories in a real browser.
   */
  private _detachObservers: () => void = () => undefined;

  /**
   * when shared data change
   */
  private _onChange() {
    this._kernelPacks.forEach((kp) => this._updateKernelPack(kp));
  }

  //

  private async _updateKernelPack(kp: TKernelPack) {
    // Nothing to update before a project is chosen, and treating that as
    // "server does not exist" would be a lie the kernel pack then acts on.
    if (!this._sd) return;

    const server = this._sd['user-containers:containers'].get(
      `${kp.user_container_id}`
    );
    const jupyterServer = this._sd['jupyter:servers'].get(
      `${kp.user_container_id}`
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
            // Loaded here rather than at module load — see the import above.
            import('./browser-widget-manager').then(
              ({ BrowserWidgetManager }) => {
                const bwm = new BrowserWidgetManager(kernelConnection);
                kp.widgetManager = bwm;
                bwm.loadFromKernelDone.then(() => {
                  this._changeKernelPackState(kp, READY);
                });
              }
            );
          });
        }
      });
    }
  }

  //

  private _onNewDriver(server: TUserContainer) {
    if (server.image_id.includes('jupyter:')) {
      const service = server.httpServices.find(
        (srv) => srv.name === 'jupyterlab'
      );
      if (service) {
        injectWidgetsScripts(
          serverUrl({
            host: service.host,
            location: '',
          })
        );
      }
    }
    return Promise.resolve();
  }
  //

  public async getServerSetting(server: TUserContainer, websocket?: boolean) {
    const token = await this.getToken(server, 'jupyterlab');

    const url = serviceUrl(server, 'jupyterlab', websocket);
    if (!url)
      throw new Error(
        `no such server or is down [${server.user_container_id}, ${server.container_name}]`
      );

    const r = {
      baseUrl: url,
      token,
      // Cross-origin, so the session cookie only travels if asked for. It is
      // what the container's guard authorizes on; the token that opens the
      // service itself is added by the guard upstream and never comes here.
      init: { credentials: 'include' as RequestCredentials },
    };

    return r;
  }

  //

  private _getDriver(server: TUserContainer): Promise<JupyterlabDriver> {
    const p = this._drivers.get(server.user_container_id);
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
                user_container_id: server.user_container_id,
                resources,
                systemEvent: true,
              });
            });
            resolve(driver);
          });
        });
      });
      this._drivers.set(server.user_container_id, np);
      return np;
    }
    return p;
  }

  //

  // just ensure a driver is created, it will start polling resources
  public startPollingResources(server: TUserContainer) {
    this._getDriver(server);
  }

  /**
   * Watch a container's kernels and terminals for as long as something shows
   * them, and stop when nothing does.
   *
   * The driver already counts its listeners and polls only while it has one —
   * `subscribeResourceListener` starts, the last `unsubscribe` stops. What was
   * missing is anyone subscribing outside a creation form: `startPollingResources`
   * was called from `new-terminal` and `new-kernel` and nowhere else, so with no
   * form open nothing polled, no `jupyter:resources-changed` ever reached the
   * gateway, and a terminal opened inside JupyterLab stayed invisible to the
   * project. Measured: two terminals live in the container, zero events.
   *
   * Reference-counted per container rather than per component, so three nodes
   * showing the same notebook cost one timer, and the timer goes away with the
   * last of them.
   *
   * Returns the release. A caller that drops it leaves a container polling for
   * the life of the page, which is the failure this is meant to end.
   */
  public watchResources(server: TUserContainer): () => void {
    const id = server.user_container_id;
    let released = false;

    const count = (this._watchers.get(id) ?? 0) + 1;
    this._watchers.set(id, count);
    if (count === 1) this.startPollingResources(server);

    return () => {
      // Idempotent: React calls a cleanup once, but a caller that releases
      // twice would otherwise stop a poll another node still needs.
      if (released) return;
      released = true;

      const left = (this._watchers.get(id) ?? 1) - 1;
      if (left > 0) {
        this._watchers.set(id, left);
        return;
      }
      this._watchers.delete(id);
      this._drivers
        .get(id)
        ?.then((driver) => driver.stopPollingResources())
        .catch(() => {
          // A driver that never resolved has nothing to stop.
        });
    };
  }

  //

  private _changeKernelPackState(kp: TKernelPack, s: number) {
    kp.state = s;
    kp.listeners.forEach((f) => f());
  }

  //

  public getKernelPack(
    user_container_id: string,
    kernel_id: string
  ): TKernelPack | false {
    const pack = this._kernelPacks.get(kernel_id);

    if (!pack) {
      const newPack: TKernelPack = {
        user_container_id,
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
