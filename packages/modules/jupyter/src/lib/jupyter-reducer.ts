import { ServerConnection, TerminalManager } from '@jupyterlab/services';

import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TJsonArray, TMyfetchRequest, makeUuid } from '@monorepo/simple-types';
import { NotFoundException } from '@monorepo/log';
import { TServersSharedData, projectServerNodeId } from '@monorepo/servers';
import {
  TEventDeleteNode,
  TEventNewNode,
  TCoreSharedData,
} from '@monorepo/core';
import { TEventNewServer, TEventDeleteServer } from '@monorepo/servers';

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
  TEventNewTerminal,
  TEventDeleteCell,
  TEventDeleteTerminal,
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

type ReducedEvents =
  | TDemiurgeNotebookEvent
  | TEventNewServer
  | TEventDeleteServer;

type DispatchedEvents =
  | TDemiurgeNotebookEvent
  | TEventNewNode
  | TEventDeleteNode;

type UsedSharedData = TServersSharedData & TJupyterSharedData & TCoreSharedData;

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
      case 'servers:delete':
        return this._deleteServer(g as Ra<TEventDeleteServer>);
      case 'jupyter:new-cell':
        return this._newCell(g as Ra<TEventNewCell>);
      case 'jupyter:delete-cell':
        return this._deleteCell(g as Ra<TEventDeleteCell>);
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
      case 'jupyter:new-terminal':
        return this._newTerminal(g as Ra<TEventNewTerminal>);
      case 'jupyter:delete-terminal':
        return this._deleteTerminal(g as Ra<TEventDeleteTerminal>);

      default:
        return Promise.resolve();
    }
  }

  //

  async _newServer(g: Ra<TEventNewServer>): Promise<void> {
    const r = g.event.result;
    if (r && JUPYTER_IMAGE_IDS.includes(r.server.image_id)) {
      // if exists, do nothing, do not override kernels
      if (g.sd.jupyterServers.get(`${r.server.project_server_id}`)) return;

      g.sd.jupyterServers.set(`${r.server.project_server_id}`, {
        project_server_id: r.server.project_server_id,
        kernels: [],
      });
    }
  }

  //

  async _newCell(g: Ra<TEventNewCell>): Promise<void> {
    const dkid = g.event.dkid;
    const cellId = makeUuid();
    g.sd.cells.set(cellId, { dkid, cellId, busy: false, outputs: [] });

    const id = makeUuid();

    await g.sharedEditor.createEditor(cellId, '');

    g.dispatcher.dispatch({
      type: 'core:new-node',
      nodeData: {
        id,
        name: `cell ${cellId}`,
        type: 'jupyter-cell',
        root: false,
        data: { cellId },
        connectors: [
          { connectorName: 'inputs', pins: [] },
          { connectorName: 'outputs', pins: [] },
        ],
      },
      edges: [
        {
          from: {
            node: this.makeKernelNodeId(dkid),
            connectorName: 'outputs',
          },
          to: { node: id, connectorName: 'inputs' },
          type: 'referenced_by',
        },
      ],
      origin: g.event.origin,
    });
  }

  //

  async _deleteCell(g: Ra<TEventDeleteCell>): Promise<void> {
    const cellId = g.event.cellId;
    const cell = g.sd.cells.get(cellId);

    if (cell) {
      // Delete node from graph
      g.sd.nodes.forEach((node, id) => {
        if (node.type === 'jupyter-cell' && node.data?.cellId === cellId) {
          g.dispatcher.dispatch({
            type: 'core:delete-node',
            id,
          });
        }
      });

      g.sharedEditor.deleteEditor(cellId);

      // Delete cell from shared data
      g.sd.cells.delete(cellId);
    }
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
        outputs: g.event.output as unknown as TJsonArray,
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
      origin: g.event.origin,
    });
  }

  /**
   * Delete kernel and all associated cells
   */
  async _deleteKernel(g: Ra<TEventDeleteKernel>) {
    // Find and delete all cells associated with this kernel
    for (const cell of g.sd.cells.values()) {
      if (cell.dkid === g.event.dkid) {
        await g.dispatcher.dispatch({
          type: 'jupyter:delete-cell',
          cellId: cell.cellId,
        });
      }
    }

    const { server, kernel, driver } = await this._getDriver(g);
    const index = server.kernels.findIndex((k) => k.dkid === g.event.dkid);
    if (index !== -1) {
      if (kernel.jkid) driver.stopKernel(kernel.jkid);
      server.kernels.splice(index, 1);
      g.sd.jupyterServers.set(`${server.project_server_id}`, server);
    }

    // Delete kernel node
    g.dispatcher.dispatch({
      type: 'core:delete-node',
      id: this.makeKernelNodeId(kernel.dkid),
    });
  }

  //

  async _newTerminal(g: Ra<TEventNewTerminal>): Promise<void> {
    const terminalId = makeUuid();

    const ss = this._drivers.getServerSetting(
      g.event.project_server_id,
      g.extraArgs.authorizationHeader
    );
    const settings = ServerConnection.makeSettings(ss);
    const manager = new TerminalManager({
      serverSettings: settings,
    });
    const session = await manager.startNew();
    console.log({ session: session.model });

    // manager.connectTo({model: session.model});

    g.sd.terminals.set(terminalId, {
      terminalId,
      project_server_id: g.event.project_server_id,
      jupyterTerminalSessionModel: session.model as any,
    });

    g.dispatcher.dispatch({
      type: 'core:new-node',
      nodeData: {
        id: terminalId,
        name: `terminal ${terminalId}`,
        type: 'jupyter-terminal',
        root: false,
        data: { terminalId },
        connectors: [{ connectorName: 'inputs', pins: [] }],
      },
      edges: [
        {
          from: {
            node: projectServerNodeId(g.event.project_server_id),
            connectorName: 'outputs',
          },
          to: { node: terminalId, connectorName: 'inputs' },
          type: 'referenced_by',
        },
      ],
      origin: g.event.origin,
    });
  }

  /**
   * Delete terminal
   */
  async _deleteTerminal(g: Ra<TEventDeleteTerminal>): Promise<void> {
    const terminalId = g.event.terminalId;
    const terminal = g.sd.terminals.get(terminalId);

    if (terminal) {
      // Delete terminal from shared data
      g.sd.terminals.delete(terminalId);

      // todo: dispose terminal in jupyter

      // Delete node from graph
      g.dispatcher.dispatch({
        type: 'core:delete-node',
        id: terminalId,
      });
    }
  }

  /**
   * Delete all kernels and terminals associated with a server when the server is deleted
   */
  async _deleteServer(g: Ra<TEventDeleteServer>): Promise<void> {
    const projectServerId = g.event.project_server_id;
    const jupyterServer = g.sd.jupyterServers.get(`${projectServerId}`);

    if (jupyterServer) {
      // Delete all kernels associated with this server
      for (const kernel of jupyterServer.kernels) {
        await g.dispatcher.dispatch(
          {
            type: 'jupyter:delete-kernel',
            dkid: kernel.dkid,
            client_id: '_unused_',
          },
          // must contain authorizationHeader, must be jupyter server specific JWT token
          // so dispatch must have set property client_id
          g.extraArgs
        );
      }

      // Remove the server from jupyterServers
      g.sd.jupyterServers.delete(`${projectServerId}`);

      for (const terminal of g.sd.terminals.values()) {
        if (terminal.project_server_id === projectServerId) {
          await g.dispatcher.dispatch({
            type: 'jupyter:delete-terminal',
            terminalId: terminal.terminalId,
          });
        }
      }
    }
  }
}
