import { KernelManager, ServerConnection } from '@jupyterlab/services';
import { IKernelConnection } from '@jupyterlab/services/lib/kernel/kernel';

import { log } from '@monorepo/log';

import {
  IOutput,
  TKernelType,
  TServerSettings,
  Kernel,
  Terminal,
} from './jupyter-types';
import { makeVirtualOutputArea } from './output-area';

//
//

type ResourceListener = (kernels: Kernel[], terminals: Terminal[]) => void;

function shallowEqualKernels(a: Kernel[], b: Kernel[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].kernel_id !== b[i].kernel_id ||
      a[i].name !== b[i].name ||
      a[i].type !== b[i].type ||
      a[i].last_activity !== b[i].last_activity ||
      a[i].execution_state !== b[i].execution_state ||
      a[i].connections !== b[i].connections
    ) {
      return false;
    }
  }
  return true;
}

function shallowEqualTerminals(a: Terminal[], b: Terminal[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].terminal_id !== b[i].terminal_id ||
      a[i].last_activity !== b[i].last_activity
    ) {
      return false;
    }
  }
  return true;
}

export class JupyterlabDriver {
  //
  km: KernelManager;
  kernelConnections: Map<string, IKernelConnection> = new Map();
  _ss: ServerConnection.ISettings;

  private kernelResources: Kernel[] = [];
  private terminalResources: Terminal[] = [];
  private resourceListeners: Set<ResourceListener> = new Set();
  private pollingInterval: number = 10000; // 10 seconds
  private pollingTimer: any = null;

  //
  //

  constructor(server_settings: TServerSettings) {
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

  getKernel = (kid: string): IKernelConnection => {
    const kernel = this.kernelConnections.get(kid);
    if (!kernel) throw new Error(`No such kernel, kid: [${kid}]`);
    return kernel;
  };

  //
  //

  execute = async (kid: string, code: string): Promise<IOutput[]> => {
    log(7, 'JUPYTERLAB', '_execute', kid);
    const virtualOutputArea = makeVirtualOutputArea();
    const kernel = this.getKernel(kid);
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

  private pollResources = async () => {
    try {
      // Poll kernels
      await this.km.refreshRunning();
      const kernelModels = Array.from(await this.km.running());
      const newKernels: Kernel[] = kernelModels.map((k: any) => ({
        kernel_id: k.id,
        name: k.name,
        type: k.type,
        last_activity: k.last_activity,
        execution_state: k.execution_state || '',
        connections: k.connections || 0,
      }));
      // Poll terminals
      const terminalModels = await this.km.serverSettings.fetch(
        '/api/terminals'
      );
      const terminals = await terminalModels.json();
      const newTerminals: Terminal[] = terminals.map((t: any) => ({
        terminal_id: t.name,
        sessionModel: { name: t.name },
        last_activity: t.last_activity,
      }));
      // Only update and notify if changed
      const kernelsChanged = !shallowEqualKernels(
        this.kernelResources,
        newKernels
      );
      const terminalsChanged = !shallowEqualTerminals(
        this.terminalResources,
        newTerminals
      );
      if (kernelsChanged || terminalsChanged) {
        this.kernelResources = newKernels;
        this.terminalResources = newTerminals;
        this.notifyResourceListeners();
      }
    } catch (error) {
      // Optionally log or handle polling errors
      // console.error('Polling Jupyter resources failed:', error);
    }
  };
}
