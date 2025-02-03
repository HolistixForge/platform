import { KernelManager, ServerConnection } from '@jupyterlab/services';
import { IKernelConnection } from '@jupyterlab/services/lib/kernel/kernel';
import { IOutput, TJKID, TKernelType, TServerSettings } from './jupyter-types';
import { makeVirtualOutputArea } from './output-area';
import { log } from '@monorepo/log';

//
//

export class JupyterlabDriver {
  //
  km: KernelManager;
  kernelConnections: Map<string, IKernelConnection> = new Map();
  _ss: ServerConnection.ISettings;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jkid: TJKID = (kernel as any)._id;
      this.kernelConnections.set(jkid, kernel);
      return jkid;
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

  connectKernel = async (jkid: TJKID): Promise<IKernelConnection> => {
    await this.km.ready;
    const connectOptions: IKernelConnection.IOptions = {
      model: {
        id: jkid,
        name: 'python3',
      },
      handleComms: true,
    };
    const kernel = await this.km.connectTo(connectOptions);
    this.kernelConnections.set(jkid, kernel);
    return kernel;
  };

  //
  //

  stopKernel = async (jkid: TJKID) => {
    const kc = this.kernelConnections.get(jkid);
    if (kc) {
      await kc.shutdown();
      kc.dispose();
      this.kernelConnections.delete(jkid);
    }
  };

  //
  //

  getKernel = (jkid: TJKID): IKernelConnection => {
    const kernel = this.kernelConnections.get(jkid);
    if (!kernel) throw new Error(`No such kernel, jkid: [${jkid}]`);
    return kernel;
  };

  //
  //

  execute = async (jkid: TJKID, code: string): Promise<IOutput[]> => {
    log(7, 'JUPYTERLAB', '_execute', jkid);
    const virtualOutputArea = makeVirtualOutputArea();
    const kernel = this.getKernel(jkid);
    const shellFuture = kernel.requestExecute({ code });
    virtualOutputArea.future = shellFuture;
    return shellFuture.done.then(() => {
      return virtualOutputArea.model.toJSON();
    });
  };

  //
  //

  async destroy() {
    this.km.dispose();
    return;
  }
}
