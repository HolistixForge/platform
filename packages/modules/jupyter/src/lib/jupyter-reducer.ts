import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TMyfetchRequest, makeUuid } from '@monorepo/simple-types';
import { NotFoundException } from '@monorepo/log';
import { TServersSharedData, projectServerNodeId } from '@monorepo/servers';
import { TEventDeleteNode, TEventNewNode } from '@monorepo/core';
import { TEventNewServer } from '@monorepo/servers';

import {
  TEventKernelStarted,
  TEventStopKernel,
  TEventDeleteKernel,
  TDemiurgeNotebookEvent,
  TEventClearNodeOutput,
  TEventExecutePythonNode,
  TEventPythonNodeOutput,
  TEventStartKernel,
  TEventNewCell,
  TEventNewKernel,
} from './jupyter-events';
import { TDKID, dkidToServer } from './jupyter-types';
import { TJupyterSharedData } from './jupyter-shared-model';
import { DriversStoreBackend } from './ds-backend';

/**
 *
 */

export type TExtraArgs = {
  toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
  authorizationHeader: string;
};

type ReducedEvents = TDemiurgeNotebookEvent | TEventNewServer;

type DispatchedEvents =
  | TDemiurgeNotebookEvent
  | TEventNewNode
  | TEventDeleteNode;

type UsedSharedData = TServersSharedData & TJupyterSharedData;

type Ra<T> = ReduceArgs<UsedSharedData, T, DispatchedEvents, TExtraArgs>;

//

const JUPYTER_IMAGE_IDS = [2, 3];

/**
 *
 */

export class JupyterReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  DispatchedEvents,
  TExtraArgs
> {
  //

  _drivers: DriversStoreBackend;

  constructor(sd: TServersSharedData & TJupyterSharedData) {
    super();
    this._drivers = new DriversStoreBackend(
      sd.jupyterServers as any,
      sd.projectServers as any
    );
  }

  //

  private async _getDriver(g: Ra<{ dkid: TDKID }>) {
    return await this._drivers.getDriver(
      g.event.dkid,
      g.extraArgs.authorizationHeader
    );
  }

  //
  //
  //

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'servers:new':
        return this._newServer(g as Ra<TEventNewServer>);
      case 'jupyter:new-cell':
        return this._newCell(g as Ra<TEventNewCell>);
      case 'jupyter:execute-python-node':
        return this._execute(g as Ra<TEventExecutePythonNode>);
      case 'jupyter:python-node-output':
        return this._nodeOutput(g as Ra<TEventPythonNodeOutput>);
      case 'jupyter:start-kernel':
        return this._startKernel(g as Ra<TEventStartKernel>);
      case 'jupyter:_kernel-started_':
        return this._kernelStarted(g as Ra<TEventKernelStarted>);
      case 'jupyter:clear-node-output':
        return this._clearOutput(g as Ra<TEventClearNodeOutput>);
      case 'jupyter:new-kernel':
        return this._newKernel(g as Ra<TEventNewKernel>);
      case 'jupyter:delete-kernel':
        return this._deleteKernel(g as Ra<TEventDeleteKernel>);
      case 'jupyter:stop-kernel':
        return this._stopKernel(g as Ra<TEventStopKernel>);

      default:
        return Promise.resolve();
    }
  }

  //

  async _newServer(g: Ra<TEventNewServer>): Promise<void> {
    const r = g.event.result;
    if (r && JUPYTER_IMAGE_IDS.includes(g.event.imageId))
      g.sd.jupyterServers.set(`${r.project_server_id}`, {
        project_server_id: r.project_server_id,
        kernels: [],
      });
  }

  //

  _newCell(g: Ra<TEventNewCell>): Promise<void> {
    const dkid = g.event.dkid;
    const cellId = makeUuid();
    g.sd.cells.set(cellId, { dkid, cellId, busy: false, outputs: [] });
    return Promise.resolve();
  }

  //

  async _execute(g: Ra<TEventExecutePythonNode>): Promise<void> {
    const cell = g.sd.cells.get(g.event.cellId);
    if (cell) {
      g.sd.cells.set(g.event.cellId, {
        ...cell,
        busy: true,
        outputs: [],
      });

      const { kernel, driver } = await this._getDriver(g);

      if (kernel.jkid) {
        return driver
          .execute(kernel.jkid, g.event.code)
          .then((output) => {
            g.dispatcher.dispatch({
              type: 'jupyter:python-node-output',
              cellId: g.event.cellId,
              output,
            });
          })
          .catch((e) => {
            g.sd.cells.set(g.event.cellId, {
              ...cell,
              busy: false,
            });
            throw e;
          });
      }
    }
  }

  //

  _nodeOutput(g: Ra<TEventPythonNodeOutput>): Promise<void> {
    const cell = g.sd.cells.get(g.event.cellId);
    if (cell)
      g.sd.cells.set(g.event.cellId, {
        ...cell,
        outputs: g.event.output,
        busy: false,
      });
    return Promise.resolve();
  }

  //

  _clearOutput(g: Ra<TEventClearNodeOutput>): Promise<void> {
    const cell = g.sd.cells.get(g.event.cellId);
    if (cell)
      g.sd.cells.set(g.event.cellId, {
        ...cell,
        outputs: [],
        busy: false,
      });
    return Promise.resolve();
  }

  //

  async _startKernel(g: Ra<TEventStartKernel>): Promise<void> {
    const { kernel, driver } = await this._getDriver(g);
    if (kernel.jkid) throw new Error('kernel started yet');
    return driver.newKernel('python3').then((jkid) => {
      if (jkid)
        g.dispatcher.dispatch({
          type: 'jupyter:_kernel-started_',
          dkid: g.event.dkid,
          jkid,
        });
    });
  }

  /**
   * set kernel's jkid property
   * @param g
   * @returns
   */

  _kernelStarted(g: Ra<TEventKernelStarted>): Promise<void> {
    const r = dkidToServer(g.sd.jupyterServers as any, g.event.dkid);
    if (r) {
      const { server, kernel } = r;
      kernel.jkid = g.event.jkid;
      g.sd.jupyterServers.set(`${server.project_server_id}`, server);
    }
    return Promise.resolve();
  }

  /**
   * dispose kernel connection and set kernel's jkid property to undefined
   * @param g
   */

  async _stopKernel(g: Ra<TEventStopKernel>): Promise<void> {
    const { server, kernel, driver } = await this._getDriver(g);
    console.log('_stopKernel', { server, kernel, driver });
    if (!kernel.jkid) throw new Error('kernel not started');
    await driver.stopKernel(kernel.jkid);
    kernel.jkid = undefined;
    g.sd.jupyterServers.set(`${server.project_server_id}`, server);
  }

  /**
   *
   */

  //

  makeKernelNodeId(dkid: string) {
    return `kernel:${dkid}`;
  }

  //

  async _newKernel(g: Ra<TEventNewKernel>) {
    // add kernel to project server
    const js = g.sd.jupyterServers.get(`${g.event.project_server_id}`);
    if (!js)
      throw new NotFoundException([
        { message: `No such project server [${g.event.project_server_id}]` },
      ]);
    const dkid = makeUuid();
    js.kernels = [
      ...js.kernels,
      {
        dkid,
        kernelName: g.event.kernelName,
        kernelType: 'python3',
      },
    ];
    g.sd.jupyterServers.set(`${g.event.project_server_id}`, js);
    // add new node representing the kernel and link to project server node
    const id = this.makeKernelNodeId(dkid);

    g.dispatcher.dispatch({
      type: 'core:new-node',
      nodeData: {
        id,
        name: `kernel ${dkid}`,
        type: 'jupyter-kernel',
        root: false,
        data: { dkid },
        connectors: [
          { connectorName: 'inputs', pins: [] },
          { connectorName: 'outputs', pins: [] },
        ],
      },
      edges: [
        {
          from: {
            node: projectServerNodeId(g.event.project_server_id),
            connectorName: 'outputs',
          },
          to: { node: id, connectorName: 'inputs' },
          type: 'referenced_by',
        },
      ],
    });
  }

  /**
   * TODO: orphan code cells
   */
  async _deleteKernel(g: Ra<TEventDeleteKernel>) {
    const { server, kernel, driver } = await this._getDriver(g);
    const index = server.kernels.findIndex((k) => k.dkid === g.event.dkid);
    if (index !== -1) {
      if (kernel.jkid) driver.stopKernel(kernel.jkid);
      server.kernels.splice(index, 1);
      g.sd.jupyterServers.set(`${server.project_server_id}`, server);
    }

    g.dispatcher.dispatch({
      type: 'core:delete-node',
      id: this.makeKernelNodeId(kernel.dkid),
    });
  }
}
