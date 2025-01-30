import _ from 'lodash.isequal';

import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import {
  TNodePython,
  TNodeGeneric,
  TNodeData,
  TEventKernelStarted,
  TEventStopKernel,
  TEventDeleteKernel,
  TDemiurgeNotebookEvent,
  TEventClearNodeOutput,
  TEventExecutePythonNode,
  TEventPythonNodeOutput,
  TEventStartKernel,
  TEventNewKernel,
} from '@monorepo/demiurge-types';
import { TMyfetchRequest, makeUuid } from '@monorepo/simple-types';
import { NotFoundException } from '@monorepo/backend-engine';
import {
  DriversStoreBackend,
  TDKID,
  dkidToServer,
} from '@monorepo/jupyterlab-api';
import { projectServerNodeId } from './servers-reducer';
import { TNotebookSharedData } from '@monorepo/shared-data-model';

/**
 *
 */

type TExtraArgs = {
  toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
  authorizationHeader: string;
};

type ReducedEvents = TDemiurgeNotebookEvent;

type DispatchedEvents = TDemiurgeGraphEvent;

type UsedSharedData = TNotebookSharedData;

type Ra<T> = ReduceArgs<UsedSharedData, T, DispatchedEvents, TExtraArgs>;

/**
 *
 */

export class NotebookReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  DispatchedEvents,
  TExtraArgs
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
      case 'stop-kernel':
        return this._stopKernel(g as Ra<TEventStopKernel>);

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
    return;
  }
}
