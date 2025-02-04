import * as nbformat from '@jupyterlab/nbformat';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { OutputAreaModel, OutputArea } from '@jupyterlab/outputarea';
import { JSONObject } from '@lumino/coreutils';

//
//

export const makeOutputArea = (registry: RenderMimeRegistry): OutputArea => {
  const model = new OutputAreaModel({ trusted: true });
  const outputArea = new OutputArea({
    model: model,
    rendermime: registry,
  });
  return outputArea;
};

//
//

export const makeVirtualOutputArea = () => {
  const model = new OutputAreaModel({ trusted: true });
  const outputArea = new VirtualOutputArea({
    model: model,
  });
  return outputArea;
};

//
//

/**
 * a OutputArea that do not extends Widget from '@lumino/widgets'
 * So it can be used in nodeJS application
 * JupyterlabDrive binds kernel.requestExecute() on it
 * and then serialize the resulting model, then to be pushed in collab data
 * TODO: check origin OutputArea class code divergence :
 *    https://github.com/jupyterlab/jupyterlab/blob/main/packages/outputarea/src/widget.ts
 *    Pull Request a Parent class to factorize common code
 *
 */
class VirtualOutputArea {
  model: OutputAreaModel;
  _future: Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > | null = null;
  _displayIdMap = new Map<string, number[]>();

  constructor(option: { model: OutputAreaModel }) {
    this.model = option.model;
  }

  set future(
    value: Kernel.IShellFuture<
      KernelMessage.IExecuteRequestMsg,
      KernelMessage.IExecuteReplyMsg
    >
  ) {
    // Bail if the model is disposed.
    if (this.model.isDisposed) {
      throw Error('Model is disposed');
    }
    if (this._future === value) {
      return;
    }
    if (this._future) {
      this._future.dispose();
    }
    this._future = value;

    this.model.clear();

    // Handle published messages.
    value.onIOPub = this._onIOPub;

    // Handle the execute reply.
    value.onReply = this._onExecuteReply;

    // Handle stdin.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    value.onStdin = (msg) => {
      //
    };
  }

  /**
   * Handle an iopub message.
   */
  private _onIOPub = (msg: KernelMessage.IIOPubMessage) => {
    const model = this.model;
    const msgType = msg.header.msg_type;
    let output: nbformat.IOutput;

    const transient = ((msg.content as any).transient || {}) as JSONObject;
    const displayId = transient['display_id'] as string;
    let targets: number[] | undefined;

    switch (msgType) {
      case 'execute_result':
      case 'display_data':
      case 'stream':
      case 'error':
        output = { ...msg.content, output_type: msgType };
        model.add(output);
        break;
      case 'clear_output': {
        const wait = (msg as KernelMessage.IClearOutputMsg).content.wait;
        model.clear(wait);
        break;
      }
      case 'update_display_data':
        output = { ...msg.content, output_type: 'display_data' };
        targets = this._displayIdMap.get(displayId);
        if (targets) {
          for (const index of targets) {
            model.set(index, output);
          }
        }
        break;
      default:
        break;
    }
    if (displayId && msgType === 'display_data') {
      targets = this._displayIdMap.get(displayId) || [];
      targets.push(model.length - 1);
      this._displayIdMap.set(displayId, targets);
    }
  };

  /**
   * Handle an execute reply message.
   */
  private _onExecuteReply = (msg: KernelMessage.IExecuteReplyMsg) => {
    // API responses that contain a pager are special cased and their type
    // is overridden from 'execute_reply' to 'display_data' in order to
    // render output.
    const model = this.model;
    const content = msg.content;
    if (content.status !== 'ok') {
      return;
    }
    const payload = content && content.payload;
    if (!payload || !payload.length) {
      return;
    }

    const pages = payload.filter((i: any) => (i as any).source === 'page');
    if (!pages.length) {
      return;
    }
    const page = JSON.parse(JSON.stringify(pages[0]));
    const output: nbformat.IOutput = {
      output_type: 'display_data',

      data: (page as any).data as nbformat.IMimeBundle,
      metadata: {},
    };
    model.add(output);
  };
}
