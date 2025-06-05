import { ServerConnection, TerminalManager } from '@jupyterlab/services';

import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TJsonArray, TMyfetchRequest, makeUuid } from '@monorepo/simple-types';
import { NotFoundException } from '@monorepo/log';
import {
  TServersSharedData,
  projectServerNodeId,
  TEventNewServer,
  TEventDeleteServer,
} from '@monorepo/servers';
import {
  TEventDeleteNode,
  TEventNewNode,
  TCoreSharedData,
} from '@monorepo/core';

import {
  TDemiurgeNotebookEvent,
  TEventClearNodeOutput,
  TEventExecutePythonNode,
  TEventPythonNodeOutput,
  TEventNewCell,
  TEventNewTerminal,
  TEventDeleteCell,
  TEventDeleteTerminal,
  TEventNewKernelNode,
  TEventNewTerminalNode,
  TEventDeleteKernelNode,
  TEventDeleteTerminalNode,
} from './jupyter-events';
import { TJupyterSharedData } from './jupyter-shared-model';
import { DriversStoreBackend } from './ds-backend';
import {
  TCellNodeDataPayload,
  TKernelNodeDataPayload,
  TTerminalNodeDataPayload,
} from './jupyter-types';

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

  private async _getDriver(project_server_id: number, token: string) {
    return await this._drivers.getDriver(project_server_id, token);
  }

  //

  // Helper to find the server containing a given kernel/cell/terminal id
  private findServerByKernelId(
    jupyterServers: Iterable<any>,
    kernelId: string
  ) {
    for (const server of jupyterServers) {
      if (server.kernels && server.kernels[kernelId]) return server;
    }
    return undefined;
  }
  private findServerByCellId(jupyterServers: Iterable<any>, cellId: string) {
    for (const server of jupyterServers) {
      if (server.cells && server.cells[cellId]) return server;
    }
    return undefined;
  }
  private findServerByTerminalId(
    jupyterServers: Iterable<any>,
    terminalId: string
  ) {
    for (const server of jupyterServers) {
      if (server.terminals && server.terminals[terminalId]) return server;
    }
    return undefined;
  }

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'servers:new':
        return this._newServer(g as Ra<TEventNewServer>);
      case 'servers:delete':
        return this._deleteServer(g as Ra<TEventDeleteServer>);
      // cells
      case 'jupyter:new-cell':
        return this._newCell(g as Ra<TEventNewCell>);
      case 'jupyter:delete-cell':
        return this._deleteCell(g as Ra<TEventDeleteCell>);
      case 'jupyter:execute-python-node':
        return this._execute(g as Ra<TEventExecutePythonNode>);
      case 'jupyter:python-node-output':
        return this._nodeOutput(g as Ra<TEventPythonNodeOutput>);
      case 'jupyter:clear-node-output':
        return this._clearOutput(g as Ra<TEventClearNodeOutput>);
      // terminal
      case 'jupyter:new-terminal':
        return this._newTerminal(g as Ra<TEventNewTerminal>);
      case 'jupyter:new-terminal-node':
        return this._newTerminalNode(g as Ra<TEventNewTerminalNode>);
      case 'jupyter:delete-terminal':
        return this._deleteTerminal(g as Ra<TEventDeleteTerminal>);
      case 'jupyter:delete-terminal-node':
        return this._deleteTerminalNode(g as Ra<TEventDeleteTerminalNode>);
      // kernel
      case 'jupyter:new-kernel-node':
        return this._newKernelNode(g as Ra<TEventNewKernelNode>);
      case 'jupyter:delete-kernel-node':
        return this._deleteKernelNode(g as Ra<TEventDeleteKernelNode>);
      //
      default:
        return Promise.resolve();
    }
  }

  async _newServer(g: Ra<TEventNewServer>): Promise<void> {
    const r = g.event.result;
    if (r && JUPYTER_IMAGE_IDS.includes(r.server.image_id)) {
      if (g.sd.jupyterServers.get(`${r.server.project_server_id}`)) return;
      g.sd.jupyterServers.set(`${r.server.project_server_id}`, {
        project_server_id: r.server.project_server_id,
        kernels: {},
        cells: {},
        terminals: {},
      });
    }
  }

  makeKernelNodeId(id: string) {
    return `kernel:${id}`;
  }

  async _newCell(g: Ra<TEventNewCell>): Promise<void> {
    // TODO: TEventNewCell should include kernelId for the new model
    const kid = g.event.kernel_id;
    if (!kid) throw new Error('kernelId is required for new cell');
    const server = this.findServerByKernelId(
      Array.from(g.sd.jupyterServers.values()),
      kid
    );
    if (!server)
      throw new NotFoundException([
        { message: `No server for kernelId [${kid}]` },
      ]);

    const cell_id = makeUuid();

    const id = makeUuid();

    await g.sharedEditor.createEditor(cell_id, '');

    const data: TCellNodeDataPayload = {
      project_server_id: server.project_server_id,
      cell_id,
    };

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id,
        name: `cell ${cell_id}`,
        type: 'jupyter-cell',
        root: false,
        data,
        connectors: [
          { connectorName: 'inputs', pins: [] },
          { connectorName: 'outputs', pins: [] },
        ],
      },
      edges: [
        {
          from: {
            node: this.makeKernelNodeId(kid),
            connectorName: 'outputs',
          },
          to: { node: id, connectorName: 'inputs' },
          semanticType: 'referenced_by',
        },
      ],
      origin: g.event.origin,
    });

    server.cells[cell_id] = {
      id: cell_id,
      kernelId: kid,
      busy: false,
      outputs: [],
    };
    // Optionally: create editor, add node, etc.
    // ...
  }

  async _deleteCell(g: Ra<TEventDeleteCell>): Promise<void> {
    const cellId = g.event.cell_id;
    const server = this.findServerByCellId(
      Array.from(g.sd.jupyterServers.values()),
      cellId
    );
    if (server && server.cells[cellId]) {
      delete server.cells[cellId];
      // Delete node from graph
      g.sd.nodes.forEach((node, id) => {
        if (
          node.type === 'jupyter-cell' &&
          (node.data as TCellNodeDataPayload).cell_id === cellId
        ) {
          g.bep.process({
            type: 'core:delete-node',
            id,
          });
        }
      });

      g.sharedEditor.deleteEditor(cellId);
      g.sd.jupyterServers.set(`${server.project_server_id}`, server);
    }
  }

  async _execute(g: Ra<TEventExecutePythonNode>): Promise<void> {
    const { cell_id, code } = g.event;
    const server = this.findServerByCellId(
      Array.from(g.sd.jupyterServers.values()),
      cell_id
    );
    if (!server) return;
    const cell = server.cells[cell_id];
    if (cell) {
      const driver = await this._getDriver(
        server.project_server_id,
        g.extraArgs.authorizationHeader
      );

      const kernel = server.kernels[cell.kernel_id];

      if (kernel.id) {
        return driver
          .execute(kernel.id, code)
          .then((output) => {
            g.bep.process({
              type: 'jupyter:python-node-output',
              cell_id: g.event.cell_id,
              output,
            });
          })
          .catch((e) => {
            cell.outputs = [];
            g.sd.jupyterServers.set(`${server.project_server_id}`, server);
            throw e;
          });
      }

      cell.busy = true;
      cell.outputs = [];
      g.sd.jupyterServers.set(`${server.project_server_id}`, server);
    }
  }

  _nodeOutput(g: Ra<TEventPythonNodeOutput>): Promise<void> {
    const { cell_id, output } = g.event;
    const server = this.findServerByCellId(
      Array.from(g.sd.jupyterServers.values()),
      cell_id
    );
    if (server && server.cells[cell_id]) {
      server.cells[cell_id].outputs = output as unknown as TJsonArray;
      server.cells[cell_id].busy = false;
    }
    g.sd.jupyterServers.set(`${server.project_server_id}`, server);
    return Promise.resolve();
  }

  _clearOutput(g: Ra<TEventClearNodeOutput>): Promise<void> {
    const { cell_id } = g.event;
    const server = this.findServerByCellId(
      Array.from(g.sd.jupyterServers.values()),
      cell_id
    );
    if (server && server.cells[cell_id]) {
      server.cells[cell_id].outputs = [];
      server.cells[cell_id].busy = false;
    }
    g.sd.jupyterServers.set(`${server.project_server_id}`, server);
    return Promise.resolve();
  }

  //

  async _newTerminal(g: Ra<TEventNewTerminal>): Promise<void> {
    const server = g.sd.jupyterServers.get(`${g.event.project_server_id}`);
    if (!server)
      throw new NotFoundException([
        { message: `No such project server [${g.event.project_server_id}]` },
      ]);

    const ss = this._drivers.getServerSetting(
      g.event.project_server_id,
      g.extraArgs.authorizationHeader
    );

    const settings = ServerConnection.makeSettings(ss);
    const manager = new TerminalManager({
      serverSettings: settings,
    });
    const session = await manager.startNew();

    const terminal_id = session.model as unknown as string;

    // manager.connectTo({model: session.model});

    server.terminals[terminal_id] = {
      terminal_id,
      sessionModel: { name: terminal_id },
    };

    g.sd.jupyterServers.set(`${server.project_server_id}`, server);

    await g.bep.process({
      type: 'jupyter:new-terminal-node',
      project_server_id: g.event.project_server_id,
      origin: g.event.origin,
      client_id: g.extraArgs.authorizationHeader,
      terminal_id: terminal_id,
    });
  }

  //

  async _newTerminalNode(g: Ra<TEventNewTerminalNode>): Promise<void> {
    const { terminal_id } = g.event;

    const nodeId = makeUuid();

    const data: TTerminalNodeDataPayload = {
      project_server_id: g.event.project_server_id,
      terminal_id,
    };

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id: nodeId,
        name: `terminal ${terminal_id}`,
        type: 'jupyter-terminal',
        root: false,
        data,
        connectors: [{ connectorName: 'inputs', pins: [] }],
      },
      edges: [
        {
          from: {
            node: projectServerNodeId(g.event.project_server_id),
            connectorName: 'outputs',
          },
          to: { node: nodeId, connectorName: 'inputs' },
          semanticType: 'referenced_by',
        },
      ],
      origin: g.event.origin,
    });
  }

  //

  async _deleteTerminal(g: Ra<TEventDeleteTerminal>): Promise<void> {
    const { terminal_id } = g.event;

    const server = this.findServerByTerminalId(
      Array.from(g.sd.jupyterServers.values()),
      terminal_id
    );
    if (server && server.terminals[terminal_id]) {
      g.sd.nodes.forEach((node, id) => {
        if (
          node.type === 'jupyter-terminal' &&
          (node.data as TTerminalNodeDataPayload).terminal_id === terminal_id
        ) {
          g.bep.process({
            type: 'core:delete-node',
            id,
          });
        }
      });

      delete server.terminals[terminal_id];
      g.sd.jupyterServers.set(`${server.project_server_id}`, server);
    }
  }

  async _deleteTerminalNode(g: Ra<TEventDeleteTerminalNode>): Promise<void> {
    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
  }

  async _deleteServer(g: Ra<TEventDeleteServer>): Promise<void> {
    const projectServerId = g.event.project_server_id;
    const jupyterServer = g.sd.jupyterServers.get(`${projectServerId}`);

    if (jupyterServer) {
      // Delete all kernels associated with this server
      for (const kernel in jupyterServer.kernels) {
        await g.bep.process({
          type: 'jupyter:delete-kernel-node',
          nodeId: this.makeKernelNodeId(kernel),
        });
      }

      for (const terminal in jupyterServer.terminals) {
        await g.bep.process({
          type: 'jupyter:delete-terminal',
          terminal_id: terminal,
        });
      }

      for (const cell in jupyterServer.cells) {
        await g.bep.process({
          type: 'jupyter:delete-cell',
          cell_id: cell,
        });
      }

      // Remove the server from jupyterServers
      g.sd.jupyterServers.delete(`${projectServerId}`);
    }
  }

  async _newKernelNode(g: Ra<TEventNewKernelNode>): Promise<void> {
    const { project_server_id, kernel_id, origin } = g.event;
    const nodeId = this.makeKernelNodeId(kernel_id);

    const data: TKernelNodeDataPayload = {
      project_server_id,
      kernel_id,
    };

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id: nodeId,
        name: `kernel ${kernel_id}`,
        type: 'jupyter-kernel',
        root: false,
        data,
        connectors: [
          { connectorName: 'inputs', pins: [] },
          { connectorName: 'outputs', pins: [] },
        ],
      },
      edges: [
        {
          from: {
            node: projectServerNodeId(project_server_id),
            connectorName: 'outputs',
          },
          to: { node: nodeId, connectorName: 'inputs' },
          semanticType: 'referenced_by',
        },
      ],
      origin,
    });
  }

  async _deleteKernelNode(g: Ra<TEventDeleteKernelNode>): Promise<void> {
    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
  }
}
