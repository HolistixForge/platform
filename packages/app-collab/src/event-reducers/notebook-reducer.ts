import { EventSourcePolyfill } from 'event-source-polyfill';
import * as _ from 'lodash.isequal';

import {
  Dispatcher,
  ReduceArgs,
  Reducer,
  TCollabNativeEvent,
} from '@monorepo/collaborative';
import {
  TNodePython,
  TNodeGeneric,
  TDemiurgeNotebookSharedData,
  TNodeData,
  TEventKernelStarted,
  TDemiurgeSpaceSharedData,
  TGraphView,
  TDemiurgeSpaceEvent,
  dkidToServer,
  TEventStopKernel,
  TDKID,
  TEventDeleteNode,
  TDemiurgeEdge,
  TEventDeleteKernel,
  TDemiurgeNotebookEvent,
  TEventClearNodeOutput,
  TEventExecutePythonNode,
  TEventPythonNodeOutput,
  TEventStartKernel,
  TEventNewKernel,
  TEventNewNode,
  TPosition,
  TEventNewChat,
  TEdgeChatAnchor,
  nodeViewDefaultStatus,
  TNotebookNode,
  TDemiurgeEdgeData,
  TEventUpdateGraphView,
} from '@monorepo/demiurge-types';
import { TMyfetchRequest, makeUuid } from '@monorepo/simple-types';
import { NotFoundException } from '@monorepo/backend-engine';
import { DriversStoreBackend } from '@monorepo/jupyterlab-api';
import { projectServerNodeId } from './project-server-reducer';

/**
 *
 */

export type TNotebookReducersExtraArgs = {
  toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
  toGanymedeEventSource: (
    r: TMyfetchRequest,
    onMessage: (event, resolve, reject, es: EventSourcePolyfill) => void
  ) => Promise<void>;
  authorizationHeader: string;
};

type ReducedEvents =
  | TDemiurgeNotebookEvent
  | TEventNewChat
  | TDemiurgeSpaceEvent
  | TCollabNativeEvent;

type DispatchedEvents = TDemiurgeNotebookEvent | TDemiurgeSpaceEvent;

type UsedSharedData = TDemiurgeNotebookSharedData & TDemiurgeSpaceSharedData;

type Ra<T> = ReduceArgs<
  UsedSharedData,
  T,
  DispatchedEvents,
  TNotebookReducersExtraArgs
>;

/**
 *
 */

export class NotebookReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  DispatchedEvents,
  TNotebookReducersExtraArgs
> {
  //

  _drivers: DriversStoreBackend;

  constructor(js: DriversStoreBackend) {
    super();
    this._drivers = js;
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
      case 'execute-python-node':
        return this._execute(g as Ra<TEventExecutePythonNode>);
      case 'python-node-output':
        return this._nodeOutput(g as Ra<TEventPythonNodeOutput>);
      case 'start-kernel':
        return this._startKernel(g as Ra<TEventStartKernel>);
      case 'kernel-started':
        return this._kernelStarted(g as Ra<TEventKernelStarted>);
      case 'clear-node-output':
        return this._clearOutput(g as Ra<TEventClearNodeOutput>);
      case 'new-kernel':
        return this._newKernel(g as Ra<TEventNewKernel>);
      case 'delete-kernel':
        return this._deleteKernel(g as Ra<TEventDeleteKernel>);
      case 'new-node':
        return this._newNode(
          g as Ra<TEventNewNode<TNotebookNode, TDemiurgeEdgeData>>
        );
      case 'delete-node':
        return this._deleteNode(g as Ra<TEventDeleteNode>);
      case 'stop-kernel':
        return this._stopKernel(g as Ra<TEventStopKernel>);
      case 'new-chat':
        return this._newChat(g as Ra<TEventNewChat>);

      default:
        return Promise.resolve();
    }
  }

  //

  async _execute(g: Ra<TEventExecutePythonNode>): Promise<void> {
    const nd = g.sd.nodeData.get(g.event.nid);
    if (nd)
      g.sd.nodeData.set(g.event.nid, {
        ...(nd as TNodeData & TNodeGeneric<'python', TNodePython>),
        busy: true,
        output: [],
      });

    const { kernel, driver } = await this._getDriver(g);
    return driver
      .execute(kernel.jkid, g.event.code)
      .then((output) => {
        g.dispatcher.dispatch({
          type: 'python-node-output',
          nid: g.event.nid,
          output,
        });
      })
      .catch((e) => {
        g.sd.nodeData.set(g.event.nid, {
          ...(nd as TNodeData & TNodeGeneric<'python', TNodePython>),
          busy: false,
        });
        throw e;
      });
  }

  //

  _nodeOutput(g: Ra<TEventPythonNodeOutput>): Promise<void> {
    const nd = g.sd.nodeData.get(g.event.nid);
    if (nd)
      g.sd.nodeData.set(g.event.nid, {
        ...(nd as TNodeData & TNodeGeneric<'python', TNodePython>),
        output: g.event.output,
        busy: false,
      });
    return Promise.resolve();
  }

  //

  _clearOutput(g: Ra<TEventClearNodeOutput>): Promise<void> {
    const nd = g.sd.nodeData.get(g.event.nid);
    if (nd)
      g.sd.nodeData.set(g.event.nid, {
        ...(nd as TNodeData & TNodeGeneric<'python', TNodePython>),
        output: [],
        busy: false,
      });
    return Promise.resolve();
  }

  //

  async _startKernel(g: Ra<TEventStartKernel>): Promise<void> {
    const { server, kernel, driver } = await this._getDriver(g);
    console.log('_startKernel', { server, kernel, driver });
    if (kernel.jkid) throw new Error('kernel started yet');
    return driver.newKernel('python3').then((jkid) => {
      if (jkid)
        g.dispatcher.dispatch({
          type: 'kernel-started',
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
    const { server, kernel } = dkidToServer(g.sd.projectServers, g.event.dkid);
    kernel.jkid = g.event.jkid;
    g.sd.projectServers.set(`${server.project_server_id}`, server);
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
    g.sd.projectServers.set(`${server.project_server_id}`, server);
  }

  /**
   *
   */

  async _newKernel(g: Ra<TEventNewKernel>) {
    // add kernel to project server
    const ps = g.sd.projectServers.get(`${g.event.project_server_id}`);
    if (!ps || ps.type !== 'jupyter')
      throw new NotFoundException([
        { message: `No such project server [${g.event.project_server_id}]` },
      ]);
    const dkid = makeUuid();
    ps.kernels = [
      ...ps.kernels,
      {
        dkid,
        kernelName: g.event.kernelName,
        kernelType: 'python3',
      },
    ];
    g.sd.projectServers.set(`${g.event.project_server_id}`, ps);
    // add new node representing the kernel and link to project server node
    const id = `kernel:${dkid}`;
    newNode(
      g.sd,
      {
        id,
        project_server_id: g.event.project_server_id,
        dkid,
        type: 'kernel',
      },
      g.event.position,
      false,
      [
        {
          from: {
            node: projectServerNodeId(g.event.project_server_id),
          },
          to: {
            node: id,
          },
          type: 'REFERENCE',
        },
      ]
    );
    dispatchUpdateAllGraphViews(g, 'new-kernel');
    return;
  }

  /**
   * TODO: orphan code cells
   */
  async _deleteKernel(g: Ra<TEventDeleteKernel>) {
    const { server, kernel, driver } = await this._getDriver(g);
    const index = server.kernels.findIndex((k) => k.dkid === g.event.dkid);
    if (index !== -1) {
      driver.stopKernel(kernel.jkid);
      server.kernels.splice(index, 1);
      g.sd.projectServers.set(`${server.project_server_id}`, server);
    }
    const id = `kernel:${g.event.dkid}`;
    deleteNode(g.sd, id);
    dispatchUpdateAllGraphViews(g, 'delete-kernel');
    return;
  }

  /**
   * new simple node: youtube embed, etc.
   */

  async _newNode(g: Ra<TEventNewNode<TNotebookNode, TDemiurgeEdgeData>>) {
    const nd: TNodeData = { id: makeUuid(), ...g.event.nodeData };

    let rootNode = false;
    if (nd.type === 'video' /* ... */) rootNode = true;

    const edges: TDemiurgeEdge[] = g.event.from
      ? [
          {
            from: g.event.from,
            to: {
              node: nd.id,
            },
            type: 'REFERENCE',
            data: g.event.edgeData,
          },
        ]
      : [];
    newNode(g.sd, nd, g.event.position, rootNode, edges);
    dispatchUpdateAllGraphViews(g, 'new-node');
    return;
  }

  /**
   * delete simple node: youtube embed, etc.
   */

  async _deleteNode(g: Ra<TEventDeleteNode>) {
    // delete edges, node data and node views
    deleteNode(g.sd, g.event.id);
    dispatchUpdateAllGraphViews(g, 'delete-node');
    return;
  }

  //

  _newChat(g: Ra<TEventNewChat>): Promise<void> {
    console.log({ event: g.event });

    const nca: TNodeData = {
      type: 'chat-anchor',
      id: makeUuid(),
      chatId: g.event.__private__.id,
    };

    const nc: TNodeData = {
      type: 'chat',
      id: makeUuid(),
      chatId: g.event.__private__.id,
    };

    const edge: TEdgeChatAnchor = {
      from: {
        node: nca.id,
      },
      to: {
        node: nc.id,
      },
      type: 'REFERENCE',
      data: {
        demiurge_type: 'chat-anchor',
      },
    };

    newNode(g.sd, nca, g.event.position, true);

    newNode(
      g.sd,
      nc,
      { x: g.event.position.x + 150, y: g.event.position.y - 150 },
      false,
      [edge]
    );

    dispatchUpdateAllGraphViews(g, 'new-chat');
    return Promise.resolve();
  }
}

/*
 *
 *
 *
 *
 *
 *
 *
 *
 */

/**
 *
 * @param g
 * @param why
 */
export const dispatchUpdateAllGraphViews = (
  g: {
    dispatcher: Dispatcher<TEventUpdateGraphView, {}>;
    sd: TDemiurgeSpaceSharedData;
  },
  why: string
) => {
  g.sd.graphViews.forEach((gv, k) => {
    g.dispatcher.dispatch({
      type: '_update-graph-view_',
      why,
      viewId: k,
    });
  });
};

/**
 *
 * @param sd
 * @param nodeData
 * @param position
 */
export const newNode = (
  sd: TDemiurgeSpaceSharedData & TDemiurgeNotebookSharedData,
  nodeData: TNodeData,
  position: TPosition,
  isRootNode: boolean,
  edges?: TDemiurgeEdge[]
) => {
  // add node data
  sd.nodeData.set(nodeData.id, nodeData);

  // add this node to each view
  sd.graphViews.forEach((gv, k) => {
    const ngv = { ...gv };
    ngv.nodeViews = [
      ...ngv.nodeViews,
      {
        id: nodeData.id,
        position,
        status: nodeViewDefaultStatus(),
      },
    ];

    if (isRootNode) ngv.roots = [...ngv.roots, nodeData.id];
    sd.graphViews.set(k, ngv);
  });
  // add edges
  if (edges) {
    sd.edges.push(edges);
  }
};

/**
 *
 * @param sd
 * @param nodeData
 * @param position
 */
export const deleteNode = (
  sd: TDemiurgeSpaceSharedData & TDemiurgeNotebookSharedData,
  id: string
) => {
  // delete all edges from or to this node
  // console.log({ before: 'before', edges: edgesToStrings(sd.edges) });
  sd.edges.deleteMatching((e) => e.from.node === id || e.to.node === id);
  // console.log({ after: 'after', edges: edgesToStrings(sd.edges) });
  // delete this node in each view
  sd.graphViews.forEach((gv, k) => {
    const ngv = structuredClone(gv);
    const index = ngv.nodeViews.findIndex((nv) => nv.id === id);
    if (index !== -1) {
      ngv.nodeViews.splice(index, 1);
      sd.graphViews.set(k, ngv);
    }
  });
  // delete node data
  sd.nodeData.delete(id);
};

/**
 *
 * create a default view
 *
 */
export const newView = (): TGraphView => ({
  params: {
    maxRank: 2,
  },
  nodeViews: [],
  graph: {
    nodes: [],
    edges: [],
  },
  roots: [],
});
