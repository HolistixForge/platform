import { ServerConnection, TerminalManager } from '@jupyterlab/services';

import {
  Reducer,
  RequestData,
  TReducersBackendExports,
} from '@holistix/reducers';
import { TJsonArray, makeUuid } from '@holistix/shared-types';
import { NotFoundException } from '@holistix/log';
import { TCollabBackendExports } from '@holistix/collab';
import {
  TUserContainersSharedData,
  userContainerNodeId,
  TEventNew,
  TEventDelete,
  TUserContainersExports,
} from '@holistix/user-containers';
import { TCoreSharedData } from '@holistix/core-graph';

import {
  TJupyterEvent,
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
  TEventJupyterResourcesChanged,
} from './jupyter-events';
import { TJupyterSharedData } from './jupyter-shared-model';
import { DriversStoreBackend } from './ds-backend';
import {
  TCellNodeDataPayload,
  Terminal,
  Kernel,
  TKernelNodeDataPayload,
  TTerminalNodeDataPayload,
  TJupyterServerData,
} from './jupyter-types';

/**
 *
 */

export type TExtraArgs = {
  authorizationHeader: string;
};

type ReducedEvents = TJupyterEvent | TEventNew | TEventDelete;

type TRequired = {
  collab: TCollabBackendExports<
    TUserContainersSharedData & TJupyterSharedData & TCoreSharedData
  >;
  reducers: TReducersBackendExports;
  'user-containers': TUserContainersExports;
};

/**
 * Jupyter Reducer - Handles Jupyter-specific events
 */

export class JupyterReducer extends Reducer<ReducedEvents> {
  private readonly depsExports: TRequired;
  private _drivers: DriversStoreBackend;

  constructor(depsExports: TRequired) {
    super();
    this.depsExports = depsExports;

    const sd = depsExports.collab.collab.sharedData;
    this._drivers = new DriversStoreBackend(
      sd['jupyter:servers'] as any,
      sd['user-containers:containers'] as any
    );
  }

  /**
   * Check if a container image is a Jupyter image
   * by looking up its containerType in the image registry
   */
  private isJupyterImage(imageId: string): boolean {
    const imageDef =
      this.depsExports['user-containers'].imageRegistry.get(imageId);
    return (imageDef as any)?.options?.containerType === 'jupyter';
  }

  private async _getDriver(user_container_id: string, token: string) {
    return await this._drivers.getDriver(user_container_id, token);
  }

  private get sharedData() {
    return this.depsExports.collab.collab.sharedData;
  }

  private get sharedEditor() {
    return this.depsExports.collab.collab.sharedEditor;
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

  async reduce(event: ReducedEvents, requestData: RequestData): Promise<void> {
    switch (event.type) {
      case 'user-container:new':
        return this._newServer(event as TEventNew, requestData);
      case 'user-container:delete':
        return this._deleteServer(event as TEventDelete, requestData);
      // cells
      case 'jupyter:new-cell':
        return this._newCell(event as TEventNewCell, requestData);
      case 'jupyter:delete-cell':
        return this._deleteCell(event as TEventDeleteCell, requestData);
      case 'jupyter:execute-python-node':
        return this._execute(event as TEventExecutePythonNode, requestData);
      case 'jupyter:python-node-output':
        return this._nodeOutput(event as TEventPythonNodeOutput, requestData);
      case 'jupyter:clear-node-output':
        return this._clearOutput(event as TEventClearNodeOutput, requestData);
      //
      case 'jupyter:resources-changed':
        return this._resourcesChanged(
          event as TEventJupyterResourcesChanged,
          requestData
        );
      // terminal
      case 'jupyter:new-terminal':
        return this._newTerminal(event as TEventNewTerminal, requestData);
      case 'jupyter:new-terminal-node':
        return this._newTerminalNode(
          event as TEventNewTerminalNode,
          requestData
        );
      case 'jupyter:delete-terminal':
        return this._deleteTerminal(event as TEventDeleteTerminal, requestData);
      case 'jupyter:delete-terminal-node':
        return this._deleteTerminalNode(
          event as TEventDeleteTerminalNode,
          requestData
        );
      // kernel
      case 'jupyter:new-kernel-node':
        return this._newKernelNode(event as TEventNewKernelNode, requestData);
      case 'jupyter:delete-kernel-node':
        return this._deleteKernelNode(
          event as TEventDeleteKernelNode,
          requestData
        );
      //
      default:
        return Promise.resolve();
    }
  }

  async _newServer(event: TEventNew, requestData: RequestData): Promise<void> {
    const result = event.result;
    if (!result) return;

    // Check if this is a Jupyter image using the image registry
    if (!this.isJupyterImage(result.userContainer.image_id)) {
      return; // Not a Jupyter container, ignore
    }

    // Check if server already exists
    if (
      this.sharedData['jupyter:servers'].get(
        `${result.userContainer.user_container_id}`
      )
    ) {
      return; // Already initialized
    }

    // Initialize Jupyter server data for this container
    this.sharedData['jupyter:servers'].set(
      `${result.userContainer.user_container_id}`,
      {
        user_container_id: result.userContainer.user_container_id,
        kernels: {},
        cells: {},
        terminals: {},
      }
    );
  }

  async _resourcesChanged(
    event: TEventJupyterResourcesChanged,
    requestData: RequestData
  ): Promise<void> {
    const { resources } = event;
    const { kernels, terminals } = resources;
    const server = this.sharedData['jupyter:servers'].get(
      `${event.user_container_id}`
    );
    if (!server) return;

    const newKernels = kernels.reduce((acc, kernel) => {
      acc[kernel.kernel_id] = kernel;
      return acc;
    }, {} as Record<string, Kernel>);

    server.kernels = newKernels;

    const newTerminals = terminals.reduce((acc, terminal) => {
      acc[terminal.terminal_id] = terminal;
      return acc;
    }, {} as Record<string, Terminal>);

    server.terminals = newTerminals;

    this.sharedData['jupyter:servers'].set(
      `${server.user_container_id}`,
      server
    );
  }

  makeKernelNodeId(id: string) {
    return `kernel:${id}`;
  }

  async _newCell(
    event: TEventNewCell,
    requestData: RequestData
  ): Promise<void> {
    // TODO: TEventNewCell should include kernelId for the new model
    const kid = event.kernel_id;
    if (!kid) throw new Error('kernelId is required for new cell');
    const server: TJupyterServerData | undefined = this.findServerByKernelId(
      Array.from(this.sharedData['jupyter:servers'].values()),
      kid
    );
    if (!server)
      throw new NotFoundException([
        { message: `No server for kernelId [${kid}]` },
      ]);

    const cell_id = makeUuid();

    const id = makeUuid();

    await this.sharedEditor.createEditor(cell_id, '');

    const data: TCellNodeDataPayload = {
      user_container_id: server.user_container_id,
      cell_id,
    };

    await this.depsExports.reducers.processEvent(
      {
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
        origin: event.origin,
      },
      requestData
    );

    server.cells[cell_id] = {
      cell_id,
      kernel_id: kid,
      busy: false,
      outputs: [],
    };

    this.sharedData['jupyter:servers'].set(
      `${server.user_container_id}`,
      server
    );
  }

  async _deleteCell(
    event: TEventDeleteCell,
    requestData: RequestData
  ): Promise<void> {
    const cellId = event.cell_id;
    const server = this.findServerByCellId(
      Array.from(this.sharedData['jupyter:servers'].values()),
      cellId
    );
    if (server && server.cells[cellId]) {
      delete server.cells[cellId];
      // Delete node from graph
      this.sharedData['core-graph:nodes'].forEach((node, id) => {
        if (
          node.type === 'jupyter-cell' &&
          (node.data as TCellNodeDataPayload).cell_id === cellId
        ) {
          this.depsExports.reducers.processEvent(
            {
              type: 'core:delete-node',
              id,
            },
            requestData
          );
        }
      });

      this.sharedEditor.deleteEditor(cellId);
      this.sharedData['jupyter:servers'].set(
        `${server.user_container_id}`,
        server
      );
    }
  }

  async _execute(
    event: TEventExecutePythonNode,
    requestData: RequestData
  ): Promise<void> {
    const { cell_id, code } = event;
    const server: TJupyterServerData | undefined = this.findServerByCellId(
      Array.from(this.sharedData['jupyter:servers'].values()),
      cell_id
    );
    if (!server) return;
    const cell = server.cells[cell_id];
    if (cell) {
      // Extract authorization from requestData
      const authHeader = requestData.headers['authorization'] || '';

      const driver = await this._getDriver(
        server.user_container_id,
        authHeader
      );

      const kernel = server.kernels[cell.kernel_id];

      if (kernel.kernel_id) {
        return driver
          .execute(kernel.kernel_id, code)
          .then((output) => {
            this.depsExports.reducers.processEvent(
              {
                type: 'jupyter:python-node-output',
                cell_id: event.cell_id,
                output,
              },
              requestData
            );
          })
          .catch((e) => {
            cell.outputs = [];
            this.sharedData['jupyter:servers'].set(
              `${server.user_container_id}`,
              server
            );
            throw e;
          });
      }

      cell.busy = true;
      cell.outputs = [];
      this.sharedData['jupyter:servers'].set(
        `${server.user_container_id}`,
        server
      );
    }
  }

  _nodeOutput(
    event: TEventPythonNodeOutput,
    requestData: RequestData
  ): Promise<void> {
    const { cell_id, output } = event;
    const server = this.findServerByCellId(
      Array.from(this.sharedData['jupyter:servers'].values()),
      cell_id
    );
    if (server && server.cells[cell_id]) {
      server.cells[cell_id].outputs = output as unknown as TJsonArray;
      server.cells[cell_id].busy = false;
    }
    this.sharedData['jupyter:servers'].set(
      `${server.user_container_id}`,
      server
    );
    return Promise.resolve();
  }

  _clearOutput(
    event: TEventClearNodeOutput,
    requestData: RequestData
  ): Promise<void> {
    const { cell_id } = event;
    const server = this.findServerByCellId(
      Array.from(this.sharedData['jupyter:servers'].values()),
      cell_id
    );
    if (server && server.cells[cell_id]) {
      server.cells[cell_id].outputs = [];
      server.cells[cell_id].busy = false;
    }
    this.sharedData['jupyter:servers'].set(
      `${server.user_container_id}`,
      server
    );
    return Promise.resolve();
  }

  //

  async _newTerminal(
    event: TEventNewTerminal,
    requestData: RequestData
  ): Promise<void> {
    const server = this.sharedData['jupyter:servers'].get(
      `${event.user_container_id}`
    );
    if (!server)
      throw new NotFoundException([
        { message: `No such project server [${event.user_container_id}]` },
      ]);

    // Extract authorization from requestData
    const authHeader = requestData.headers['authorization'] || '';

    const ss = this._drivers.getServerSetting(
      event.user_container_id,
      authHeader
    );

    const settings = ServerConnection.makeSettings(ss);
    const manager = new TerminalManager({
      serverSettings: settings,
    });
    const session = await manager.startNew();

    const terminal_id = session.model.name as unknown as string;

    // manager.connectTo({model: session.model});

    server.terminals[terminal_id] = {
      terminal_id,
      sessionModel: { name: terminal_id },
    };

    this.sharedData['jupyter:servers'].set(
      `${server.user_container_id}`,
      server
    );

    await this.depsExports.reducers.processEvent(
      {
        type: 'jupyter:new-terminal-node',
        user_container_id: event.user_container_id,
        origin: event.origin,
        client_id: authHeader,
        terminal_id: terminal_id,
      },
      requestData
    );
  }

  //

  async _newTerminalNode(
    event: TEventNewTerminalNode,
    requestData: RequestData
  ): Promise<void> {
    const { terminal_id } = event;

    const nodeId = makeUuid();

    const data: TTerminalNodeDataPayload = {
      user_container_id: event.user_container_id,
      terminal_id,
    };

    await this.depsExports.reducers.processEvent(
      {
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
              node: userContainerNodeId(event.user_container_id.toString()),
              connectorName: 'outputs',
            },
            to: { node: nodeId, connectorName: 'inputs' },
            semanticType: 'referenced_by',
          },
        ],
        origin: event.origin,
      },
      requestData
    );
  }

  //

  async _deleteTerminal(
    event: TEventDeleteTerminal,
    requestData: RequestData
  ): Promise<void> {
    const { terminal_id } = event;

    const server = this.findServerByTerminalId(
      Array.from(this.sharedData['jupyter:servers'].values()),
      terminal_id
    );
    if (server && server.terminals[terminal_id]) {
      this.sharedData['core-graph:nodes'].forEach((node, id) => {
        if (
          node.type === 'jupyter-terminal' &&
          (node.data as TTerminalNodeDataPayload).terminal_id === terminal_id
        ) {
          this.depsExports.reducers.processEvent(
            {
              type: 'core:delete-node',
              id,
            },
            requestData
          );
        }
      });

      delete server.terminals[terminal_id];
      this.sharedData['jupyter:servers'].set(
        `${server.user_container_id}`,
        server
      );
    }
  }

  async _deleteTerminalNode(
    event: TEventDeleteTerminalNode,
    requestData: RequestData
  ): Promise<void> {
    await this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
  }

  async _deleteServer(
    event: TEventDelete,
    requestData: RequestData
  ): Promise<void> {
    const projectServerId = event.user_container_id;
    const jupyterServer = this.sharedData['jupyter:servers'].get(
      `${projectServerId}`
    );

    if (jupyterServer) {
      // Delete all kernels associated with this server
      for (const kernel in jupyterServer.kernels) {
        await this.depsExports.reducers.processEvent(
          {
            type: 'jupyter:delete-kernel-node',
            nodeId: this.makeKernelNodeId(kernel),
          },
          requestData
        );
      }

      for (const terminal in jupyterServer.terminals) {
        await this.depsExports.reducers.processEvent(
          {
            type: 'jupyter:delete-terminal',
            terminal_id: terminal,
          },
          requestData
        );
      }

      for (const cell in jupyterServer.cells) {
        await this.depsExports.reducers.processEvent(
          {
            type: 'jupyter:delete-cell',
            cell_id: cell,
          },
          requestData
        );
      }

      // Remove the server from jupyterServers
      this.sharedData['jupyter:servers'].delete(`${projectServerId}`);
    }
  }

  async _newKernelNode(
    event: TEventNewKernelNode,
    requestData: RequestData
  ): Promise<void> {
    const { user_container_id, kernel_id, origin } = event;
    const nodeId = this.makeKernelNodeId(kernel_id);

    const data: TKernelNodeDataPayload = {
      user_container_id,
      kernel_id,
    };

    await this.depsExports.reducers.processEvent(
      {
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
              node: userContainerNodeId(user_container_id),
              connectorName: 'outputs',
            },
            to: { node: nodeId, connectorName: 'inputs' },
            semanticType: 'referenced_by',
          },
        ],
        origin,
      },
      requestData
    );
  }

  async _deleteKernelNode(
    event: TEventDeleteKernelNode,
    requestData: RequestData
  ): Promise<void> {
    await this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
  }
}
