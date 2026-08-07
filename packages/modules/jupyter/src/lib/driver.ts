import { KernelManager, ServerConnection } from '@jupyterlab/services';
import { IKernelConnection } from '@jupyterlab/services/lib/kernel/kernel';
import isEqual from 'lodash/isEqual';

import { EPriority, log } from '@holistix-forge/log';

import {
  IOutput,
  TKernelType,
  TUserContainerSettings,
  Kernel,
  Terminal,
} from './jupyter-types';
import { makeVirtualOutputArea } from './output-area';

//
//

type ResourceListener = (kernels: Kernel[], terminals: Terminal[]) => void;

function deepEqualKernels(a: Kernel[], b: Kernel[]): boolean {
  return isEqual(a, b);
}

function deepEqualTerminals(a: Terminal[], b: Terminal[]): boolean {
  return isEqual(a, b);
}

export class JupyterlabDriver {
  //
  km: KernelManager;
  kernelConnections: Map<string, IKernelConnection> = new Map();
  _ss: ServerConnection.ISettings;

  private kernelResources: Kernel[] = [];
  private terminalResources: Terminal[] = [];
  private resourceListeners: Set<ResourceListener> = new Set();
  private pollingInterval = 10000; // 10 seconds
  private pollingTimer: any = null;

  //
  //

  constructor(server_settings: TUserContainerSettings) {
    this._ss = ServerConnection.makeSettings(server_settings);
    this.km = new KernelManager({ serverSettings: this._ss });
  }

  //
  //

  newKernel = async (kernelType: TKernelType): Promise<string | undefined> => {
    await this.km.ready;
    try {
      const kernel = await this.km.startNew(
        { name: kernelType },
        {
          /* no kernel settings */
        }
      );

      const kid: string = (kernel as any)._id;
      this.kernelConnections.set(kid, kernel);
      return kid;
    } catch (error) {
      console.log(
        `KernelManager.startNew failed on [${this._ss.baseUrl}]: ${
          (error as Error).message
        }`
      );
      return undefined;
    }
  };

  //
  //

  connectKernel = async (kid: string): Promise<IKernelConnection> => {
    await this.km.ready;
    const connectOptions: IKernelConnection.IOptions = {
      model: {
        id: kid,
        name: 'python3',
      },
      handleComms: true,
    };
    const kernel = await this.km.connectTo(connectOptions);
    this.kernelConnections.set(kid, kernel);
    return kernel;
  };

  //
  //

  stopKernel = async (kid: string) => {
    const kc = this.kernelConnections.get(kid);
    if (kc) {
      await kc.shutdown();
      kc.dispose();
      this.kernelConnections.delete(kid);
    }
  };

  //
  //

  getKernel = async (kid: string): Promise<IKernelConnection> => {
    let kernel = this.kernelConnections.get(kid);
    if (!kernel) {
      await this.connectKernel(kid);
      kernel = this.kernelConnections.get(kid);
      if (!kernel) throw new Error(`No such kernel, kid: [${kid}]`);
    }
    return kernel;
  };

  //
  //

  execute = async (kid: string, code: string): Promise<IOutput[]> => {
    log(EPriority.Debug, 'JUPYTERLAB', '_execute', kid);
    const virtualOutputArea = makeVirtualOutputArea();
    const kernel = await this.getKernel(kid);
    const shellFuture = kernel.requestExecute({ code });
    virtualOutputArea.future = shellFuture;
    return shellFuture.done.then(() => {
      return virtualOutputArea.model.toJSON() as any;
    });
  };

  //
  //

  async destroy() {
    this.km.dispose();
    return;
  }

  startPollingResources = () => {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(this.pollResources, this.pollingInterval);
    // Initial poll
    this.pollResources();
  };

  stopPollingResources = () => {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  };

  subscribeResourceListener = (listener: ResourceListener) => {
    const wasEmpty = this.resourceListeners.size === 0;
    this.resourceListeners.add(listener);
    // Immediately notify with current state
    listener(this.kernelResources, this.terminalResources);
    // Start polling only if this is the first listener
    if (wasEmpty) {
      this.startPollingResources();
    }
  };

  unsubscribeResourceListener = (listener: ResourceListener) => {
    this.resourceListeners.delete(listener);
    // Stop polling if there are no more listeners
    if (this.resourceListeners.size === 0) {
      this.stopPollingResources();
    }
  };

  getKernels = () => this.kernelResources;
  getTerminals = () => this.terminalResources;

  private notifyResourceListeners = () => {
    for (const listener of this.resourceListeners) {
      listener(this.kernelResources, this.terminalResources);
    }
  };

  /**
   * What the browser presents to this container.
   *
   * The guard recognises a browser two ways, and only one of them exists at any
   * moment: a session cookie, which is there once that container's page has
   * been opened, and a credential it validates and checks the permission for. A
   * node on a whiteboard has opened nothing, so the cookie alone answers 401.
   * Sending both means the answer does not depend on which.
   *
   * The token is the user's own, never the service's: the guard swaps in the
   * token that opens the service upstream, after deciding this user may reach
   * it.
   */
  private authorizedInit(): RequestInit {
    const token = this.km.serverSettings.token;
    return {
      credentials: 'include',
      headers: token ? { Authorization: `token ${token}` } : undefined,
    };
  }

  /**
   * The container's kernels, or null when the question could not be asked.
   *
   * Null and empty are different answers and used to be the same one: a single
   * `try` wrapped both halves of the poll, so a refused request wrote an empty
   * list into shared state and the project showed no terminals while three were
   * running. A caller that cannot tell them apart cannot do anything sensible,
   * so the distinction is in the type.
   */
  private async pollKernels(): Promise<unknown[] | null> {
    try {
      await this.km.refreshRunning();
      return Array.from(await this.km.running());
    } catch (error) {
      console.error(
        `[jupyter] polling kernels failed on ${this.km.serverSettings.baseUrl}`,
        error
      );
      return null;
    }
  }

  /** The container's terminals, or null when the question could not be asked. */
  private async pollTerminals(): Promise<Terminal[] | null> {
    const url = `${this.km.serverSettings.baseUrl}api/terminals`;
    try {
      const response = await fetch(url, this.authorizedInit());
      if (!response.ok) {
        // Named rather than swallowed. A 401 here is the guard refusing the
        // credential, and it looked exactly like a container with nothing in
        // it.
        console.error(
          `[jupyter] polling terminals answered ${response.status} on ${url}`
        );
        return null;
      }
      const terminals = await response.json();
      return terminals.map((t: { name: string; last_activity?: string }) => ({
        terminal_id: t.name,
        sessionModel: { name: t.name },
        last_activity: t.last_activity,
      }));
    } catch (error) {
      console.error(`[jupyter] polling terminals failed on ${url}`, error);
      return null;
    }
  }

  /** Sessions, used only to name which notebook a kernel belongs to. */
  private async pollSessions(): Promise<
    { type?: string; kernel?: { id: string }; path?: string; name?: string }[]
  > {
    const url = `${this.km.serverSettings.baseUrl}api/sessions`;
    try {
      const response = await fetch(url, this.authorizedInit());
      if (!response.ok) {
        console.error(
          `[jupyter] polling sessions answered ${response.status} on ${url}`
        );
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error(`[jupyter] polling sessions failed on ${url}`, error);
      return [];
    }
  }

  private pollResources = async () => {
    // Each half asks for itself and reports its own failure. One `try` around
    // both meant a refusal anywhere produced an empty list, which is also what
    // an idle container produces — and the shared state was overwritten with
    // it.
    const [kernelModels, terminals] = await Promise.all([
      this.pollKernels(),
      this.pollTerminals(),
    ]);

    // Nothing could be asked. Writing now would replace what is known with
    // what could not be read.
    if (kernelModels === null && terminals === null) return;

    const newKernels: Kernel[] = (kernelModels ?? this.kernelResources).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (k: any) => ({
        kernel_id: k.kernel_id ?? k.id,
        name: k.name,
        type: k.type,
        last_activity: k.last_activity,
        execution_state: k.execution_state || '',
        connections: k.connections || 0,
        notebooks: [],
      })
    );

    // Only when the kernels are fresh: naming notebooks on a stale list would
    // attach one run's sessions to another's kernels.
    if (kernelModels !== null) {
      for (const session of await this.pollSessions()) {
        if (session.type !== 'notebook' || !session.kernel) continue;
        const kernel = newKernels.find(
          (k) => k.kernel_id === session.kernel?.id
        );
        if (kernel)
          kernel.notebooks.push({
            path: session.path ?? '',
            name: session.name ?? '',
          });
      }
    }

    const newTerminals = terminals ?? this.terminalResources;

    const kernelsChanged = !deepEqualKernels(this.kernelResources, newKernels);
    const terminalsChanged = !deepEqualTerminals(
      this.terminalResources,
      newTerminals
    );
    if (kernelsChanged || terminalsChanged) {
      this.kernelResources = newKernels;
      this.terminalResources = newTerminals;
      this.notifyResourceListeners();
    }
  };
}
