/*
 * based on: https://github.com/jupyter-widgets/ipywidgets
 * ipywidgets\examples\web3\src\manager.ts
 */

/* eslint-disable @typescript-eslint/no-empty-function */
import { HTMLManager, requireLoader } from '@jupyter-widgets/html-manager';
import * as base from '@jupyter-widgets/base';
import { IKernelConnection } from '@jupyterlab/services/lib/kernel/kernel';
import FrontendJsRenderer from './js-renderer';
import { makeOutputArea } from '../../index';

//
//
//
//

export class BrowserWidgetManager extends HTMLManager {
  kernel: IKernelConnection;
  loadFromKernelDone: Promise<void>;

  //
  //

  constructor(kernel: IKernelConnection) {
    // we use the loader based on requireJS, (matplotlib,...)
    super({ loader: requireLoader });
    this.kernel = kernel;

    kernel.registerCommTarget(this.comm_target_name, async (comm, msg) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oldComm = new base.shims.services.Comm(comm as any);
      await this.handle_comm_open(oldComm, msg);
    });

    /*
     * Add a factory for Bokeh and Javascript
     */
    this.renderMime.addFactory(
      {
        safe: false,
        mimeTypes: [
          'application/javascript',
          'text/javascript',
          'application/vnd.bokehjs_load.v0+json',
          'application/vnd.bokehjs_exec.v0+json',
        ],
        createRenderer: (options) => {
          /*
           * Interface IRenderer
           * A widget which displays the contents of a mime model.
           */
          return new FrontendJsRenderer(options);
        },
      },
      1
    );

    this.loadFromKernelDone = this._loadFromKernel().then(() =>
      console.log(`BWM for kernel [${kernel.id}] LOADED`)
    );
  }

  //
  //

  /**
   * Create a comm.
   */
  override async _create_comm(
    target_name: string,
    model_id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any
  ): Promise<base.shims.services.Comm> {
    const comm = this.kernel.createComm(target_name, model_id);
    if (data || metadata) {
      comm.open(data, metadata);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Promise.resolve(new base.shims.services.Comm(comm as any));
  }

  //
  //

  /**
   * Get the currently-registered comms.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override _get_comm_info(): Promise<any> {
    return this.kernel
      .requestCommInfo({ target_name: this.comm_target_name })
      .then((reply) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (reply.content as any).comms;
      });
  }

  //
  //

  createOutputArea() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return makeOutputArea(this.renderMime as any);
  }
}
