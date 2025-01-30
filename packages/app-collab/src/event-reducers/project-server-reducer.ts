import _ from 'lodash.isequal';

import {
  ReduceArgs,
  Reducer,
  TCollabNativeEvent,
  TEventPeriodic,
} from '@monorepo/collab-engine';
import {
  TNodeData,
  TEventNewServer,
  TEventNewVolume,
  TApi_Volume,
  TEventMountVolume,
  TApi_Mount,
  TEventUnmountVolume,
  TEventDeleteVolume,
  TEventDeleteServer,
  TEventServerWatchdog,
  TEventServerActivity,
  TEventServerMapHttpService,
  TG_Server,
  TServerEvents,
  TEventHostServer,
  TEventServerToCloud,
  TEc2InstanceState,
  TEventServerCloudPause,
  TEventServerCloudStart,
  TEventServerCloudDelete,
  TEventUpdateInstanceState,
  TJwtServer,
  TJwtUser,
  TPgadminServerData,
  TServer,
} from '@monorepo/demiurge-types';
import { TMyfetchRequest, secondAgo } from '@monorepo/simple-types';
import { runScript } from '../run-script';
import { updateProjectMetaActivity } from './meta-reducer';
import {
  deleteNode,
  dispatchUpdateAllGraphViews,
  newNode,
} from './notebook-reducer';
import { error, log } from '@monorepo/log';
import { TGanymedeEventSourceCallback } from '../build-collab';
import {
  TNotebookSharedData,
  TSpaceSharedData,
} from '@monorepo/shared-data-model';
import { TJupyterServerData } from '@monorepo/jupyterlab-api';
import { TEdge, TPosition } from '@monorepo/demiurge-ui-components';
import { UserException } from '@monorepo/backend-engine';

/**
 *
 */

export type TProjectServerReducersExtraArgs = {
  toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
  toGanymedeEventSource: (
    r: TMyfetchRequest,
    onMessage: TGanymedeEventSourceCallback
  ) => Promise<void>;
  authorizationHeader: string;
  jwt: TJwtServer | TJwtUser;
  ip: string;
};

type ReducedEvents = TServerEvents | TCollabNativeEvent;

type UsedSharedData = TNotebookSharedData & TSpaceSharedData;

type Ra<T> = ReduceArgs<
  UsedSharedData,
  T,
  TEventUpdateInstanceState | TEventUpdateGraphView,
  TProjectServerReducersExtraArgs
>;

/**
 *
 */

export class ProjectServerReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  null,
  TProjectServerReducersExtraArgs
> {
  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'new-server':
        return this._newServer(g as Ra<TEventNewServer>);
      case 'delete-server':
        return this._deleteServer(g as Ra<TEventDeleteServer>);
      case 'periodic':
        return this._periodic(g as Ra<TEventPeriodic>);
      case 'server-watchdog':
        return this._serverWatchdog(g as Ra<TEventServerWatchdog>);
      case 'server-map-http-service':
        return this._serverMapHttpService(g as Ra<TEventServerMapHttpService>);
      case 'activity':
        return this._serverActivity(g as Ra<TEventServerActivity>);
      case 'host-server':
        return this._hostServer(g as Ra<TEventHostServer>);
      case 'server-to-cloud':
        return this._serverToCloud(g as Ra<TEventServerToCloud>);
      case 'server-cloud-pause':
        return this._serverCloudPause(g as Ra<TEventServerCloudPause>);
      case 'server-cloud-start':
        return this._serverCloudStart(g as Ra<TEventServerCloudStart>);
      case 'server-cloud-delete':
        return this._serverCloudDelete(g as Ra<TEventServerCloudDelete>);
      case '_update-instance-state':
        return this._updateInstanceState(g as Ra<TEventUpdateInstanceState>);

      case 'new-volume':
        return this._newVolume(g as Ra<TEventNewVolume>);
      case 'mount-volume':
        return this._mountVolume(g as Ra<TEventMountVolume>);
      case 'unmount-volume':
        return this._unmountVolume(g as Ra<TEventUnmountVolume>);
      case 'delete-volume':
        return this._deleteVolume(g as Ra<TEventDeleteVolume>);

      default:
        return Promise.resolve();
    }
  }

  //

  async _getUpToDateServerData(g: Ra<{}>, psid: number) {
    // get all project's servers and find the new one's data

    const r2 = await g.extraArgs.toGanymede<{ _0: TG_Server[] }>({
      url: '/projects/{project_id}/servers',
      method: 'GET',
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    const servers = r2._0;

    const newServer = servers.find((s) => s.project_server_id === psid);
    return newServer;
  }

  //

  async _newServer(g: Ra<TEventNewServer>) {
    // call api endpoint to create a server

    const r = await g.extraArgs.toGanymede<{
      _0: { new_project_server_id: number };
    }>({
      url: '/projects/{project_id}/servers',
      method: 'POST',
      jsonBody: {
        name: g.event.serverName,
        imageId: g.event.imageId,
      },
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    const newServer = await this._getUpToDateServerData(
      g,
      r._0.new_project_server_id
    );

    // create corresponding node in each view
    if (newServer) addServer(g.sd, newServer, g.event.position);

    dispatchUpdateAllGraphViews(g, 'new-server');

    return;
  }

  //

  async _serverWatchdog(g: Ra<TEventServerWatchdog>) {
    const jwt = g.extraArgs.jwt as TJwtServer;
    const psid = jwt.project_server_id;
    if (psid) {
      const s = g.sd.projectServers.get(`${psid}`);
      if (s) {
        g.sd.projectServers.set(`${psid}`, {
          ...s,
          last_watchdog_at: new Date().toISOString(),
          ip: g.extraArgs.ip,
          host_user_id:
            g.event.host_user_id === 'null' ? null : g.event.host_user_id,
          system: g.event.system,
        });
      }
    }
  }

  //

  async _serverActivity(g: Ra<TEventServerActivity>) {
    const jwt = g.extraArgs.jwt as TJwtServer;
    const psid = jwt.project_server_id;
    if (psid) {
      const s = g.sd.projectServers.get(`${psid}`);
      if (s) {
        g.sd.projectServers.set(`${psid}`, {
          ...s,
          last_activity: g.event.last_activity,
        });
        updateProjectMetaActivity(g.sd.meta, new Date(g.event.last_activity));
      }
    }
  }

  //

  async _hostServer(g: Ra<TEventHostServer>) {
    const psid = g.event.project_server_id;
    if (psid) {
      const s = g.sd.projectServers.get(`${psid}`);
      if (s) {
        await g.extraArgs.toGanymede({
          url: '/projects/{project_id}/server/{project_server_id}/host',
          pathParameters: {
            project_server_id: g.event.project_server_id,
          },
          method: 'POST',
          headers: { authorization: g.extraArgs.authorizationHeader },
        });

        const newServer = await this._getUpToDateServerData(g, psid);

        g.sd.projectServers.set(`${psid}`, {
          ...s,
          ...newServer,
        });
      }
    }
  }

  /**
   *
   * @param g
   * @param timeout secondes
   */
  async _pollCloudInstanceState(
    g: Ra<{ project_server_id: number }>,
    timeout = 300
  ) {
    const { project_server_id } = g.event;

    const s = g.sd.projectServers.get(`${project_server_id}`);
    if (!s) return;

    let state = null;
    let attempts = 0;
    const interval = 5000; //ms
    const maxAttempts = (timeout * 1000) / interval; // Maximum attempts to poll before giving up
    const stableStates = ['running', 'stopped', 'terminated'];

    while (attempts < maxAttempts) {
      log(
        7,
        'CLOUD_INSTANCE',
        `attemps: ${attempts}, maxAttemps: ${maxAttempts}`
      );
      try {
        const response = await g.extraArgs.toGanymede<{
          state: TEc2InstanceState;
        }>({
          url: '/projects/{project_id}/server/{project_server_id}/instance-state',
          pathParameters: {
            project_server_id,
          },
          method: 'GET',
          headers: { authorization: g.extraArgs.authorizationHeader },
        });
        state = response.state;
      } catch (err) {
        error('CLOUD_INSTANCE', `Error polling instance state: ${err}`);
      }
      attempts++;

      g.dispatcher.dispatch({
        type: '_update-instance-state',
        project_server_id,
        state,
      });

      if (state && stableStates.includes(state)) {
        log(7, 'CLOUD_INSTANCE', `reached stable state: ${state}`);

        const update = await this._getUpToDateServerData(g, project_server_id);

        g.sd.projectServers.set(`${project_server_id}`, {
          ...s,
          ...update,
          ec2_instance_state: state,
        });

        break; // Exit the loop if the state is stable
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before next attempt
    }

    if (attempts === maxAttempts) {
      error(
        'CLOUD_INSTANCE',
        `Failed to determine stable instance state for project_server_id: ${project_server_id}`
      );
    } else {
      log(
        7,
        'CLOUD_INSTANCE',
        `Instance state for project_server_id: ${project_server_id} is ${state}`
      );
    }
  }

  //

  async _updateInstanceState(g: Ra<TEventUpdateInstanceState>) {
    const { project_server_id, state } = g.event;

    const s = g.sd.projectServers.get(`${project_server_id}`);
    if (!s) return;

    g.sd.projectServers.set(`${project_server_id}`, {
      ...s,
      ec2_instance_state: state,
    });
  }

  //

  async _serverToCloud(g: Ra<TEventServerToCloud>) {
    const { project_server_id: psid, instanceType, storage } = g.event;
    if (psid) {
      const s = g.sd.projectServers.get(`${psid}`);
      if (s) {
        await g.extraArgs.toGanymede({
          url: '/projects/{project_id}/server/{project_server_id}/to-cloud',
          pathParameters: {
            project_server_id: g.event.project_server_id,
          },
          jsonBody: {
            instanceType,
            storage,
          },
          method: 'POST',
          headers: { authorization: g.extraArgs.authorizationHeader },
        });

        const newServer = await this._getUpToDateServerData(g, psid);

        g.sd.projectServers.set(`${psid}`, {
          ...s,
          ...newServer,
        });

        // start polling state (do not await this)
        this._pollCloudInstanceState(g);
      }
    }
  }

  //

  async _serverCloudPause(g: Ra<TEventServerCloudPause>) {
    const { project_server_id: psid } = g.event;
    if (psid) {
      const s = g.sd.projectServers.get(`${psid}`);
      if (s) {
        await g.extraArgs.toGanymede({
          url: '/projects/{project_id}/server/{project_server_id}/stop',
          pathParameters: {
            project_server_id: g.event.project_server_id,
          },
          method: 'POST',
          headers: { authorization: g.extraArgs.authorizationHeader },
        });

        // start polling state (do not await this)
        this._pollCloudInstanceState(g);
      }
    }
  }

  //

  async _serverCloudStart(g: Ra<TEventServerCloudStart>) {
    const { project_server_id: psid } = g.event;
    if (psid) {
      const s = g.sd.projectServers.get(`${psid}`);
      if (s) {
        await g.extraArgs.toGanymede({
          url: '/projects/{project_id}/server/{project_server_id}/start',
          pathParameters: {
            project_server_id: g.event.project_server_id,
          },
          method: 'POST',
          headers: { authorization: g.extraArgs.authorizationHeader },
        });
        // start polling state (do not await this)
        this._pollCloudInstanceState(g);
      }
    }
  }

  //

  async _serverCloudDelete(g: Ra<TEventServerCloudDelete>) {
    const { project_server_id: psid } = g.event;
    if (psid) {
      const s = g.sd.projectServers.get(`${psid}`);
      if (s) {
        await g.extraArgs.toGanymede({
          url: '/projects/{project_id}/server/{project_server_id}/delete-cloud',
          pathParameters: {
            project_server_id: g.event.project_server_id,
          },
          method: 'POST',
          headers: { authorization: g.extraArgs.authorizationHeader },
        });
        // start polling state (do not await this)
        this._pollCloudInstanceState(g);
      }
    }
  }

  //

  async _serverMapHttpService(g: Ra<TEventServerMapHttpService>) {
    const jwt = g.extraArgs.jwt as TJwtServer;
    const psid = jwt.project_server_id;
    if (psid) {
      const s = g.sd.projectServers.get(`${psid}`);
      if (s) {
        const httpServices = [...s.httpServices];
        if (
          !httpServices.find(
            (service) =>
              service.name === g.event.name && service.port === g.event.port
          )
        ) {
          httpServices.push({
            name: g.event.name,
            port: g.event.port,
            location: `${psid}/${g.event.name}`,
          });
          g.sd.projectServers.set(`${psid}`, {
            ...s,
            httpServices,
          });

          await this._updateNginx(g.sd);
        }
      }
    }
  }

  //

  async _updateNginx(sd: UsedSharedData) {
    const locations: string[] = [];
    sd.projectServers.forEach((server) => {
      if (server.ip) {
        server.httpServices.forEach((hs) => {
          locations.push(`${hs.location} ${server.ip} ${hs.port}\n`);
        });
      }
    });
    const scriptInput = locations.join('');
    runScript('update-nginx-locations', scriptInput);
  }

  //

  async _periodic(g: Ra<TEventPeriodic>) {
    // remove declared http services for server that did not
    // sent watchdog event for 30 secondes (down)
    g.sd.projectServers.forEach((server) => {
      if (
        server.httpServices.length > 0 &&
        (!server.last_watchdog_at ||
          secondAgo(server.last_watchdog_at, g.event.date) > 30)
      ) {
        g.sd.projectServers.set(`${server.project_server_id}`, {
          ...server,
          httpServices: [],
        });
      }
    });
    this._updateNginx(g.sd);
  }

  //

  /*
  async _updateProjectServers(g: Ra<TDemiurgeNotebookEvent>) {
    // TODO: polling 6 x 10s, why ?
    repeatFunction(
      async () => {
        const r2 = await g.extraArgs.toGanymede<{ _0: TApi_Server[] }>({
          url: '/projects/{project_id}/servers',
          method: 'GET',
          headers: { authorization: g.extraArgs.authorizationHeader },
        });

        const servers = r2._0;

        servers.forEach((s) => {
          const prev = g.sd.projectServers.get(`${s.project_server_id}`);
          // new server declared
          if (!prev)
            g.sd.projectServers.set(`${s.project_server_id}`, {
              ...s,
              kernels: [],
              last_watchdog_at: null,
              httpServices: [],
              type: 'jupyter',
              last_activity: new Date().toISOString(),
            });
          else
            g.sd.projectServers.set(`${s.project_server_id}`, {
              ...prev,
              ...s,
            });
        });
      },
      6,
      10000
    );
  }
  */

  //

  //   async _startServer(g: Ra<TEventStartServer>) {
  //     const pathParameters = {
  //       project_server_id: g.event.project_server_id,
  //     };

  //     // call api endpoint to start a server
  //     await g.extraArgs.toGanymede({
  //       url: '/projects/{project_id}/server/{project_server_id}/start',
  //       pathParameters,
  //       method: 'POST',
  //       headers: { authorization: g.extraArgs.authorizationHeader },
  //     });

  //     return;
  //   }

  //

  async _deleteServer(g: Ra<TEventDeleteServer>) {
    const pid = g.event.project_server_id;
    await g.extraArgs.toGanymede({
      url: '/projects/{project_id}/server/{project_server_id}',
      method: 'DELETE',
      pathParameters: {
        project_server_id: pid,
      },
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    g.sd.projectServers.delete(`${pid}`);
    const id = projectServerNodeId(pid);
    deleteNode(g.sd, id);
    dispatchUpdateAllGraphViews(g, 'new-server');
    return;
  }
  //

  //

  //   async _stopServer(g: Ra<TEventStopServer>) {
  //     /*
  //      * stop all kernels
  //      */
  //     const s = g.sd.projectServers.get(`${g.event.project_server_id}`);
  //     for (let i = 0; i < s.kernels.length; i++) {
  //       const k = s.kernels[i];
  //       if (k.jkid) {
  //         await this._stopKernel({
  //           ...g,
  //           event: {
  //             dkid: k.dkid,
  //             type: 'stop-kernel',
  //           },
  //         });
  //       }
  //     }
  //     /*
  //      * call api endpoint to stop a server
  //      */
  //     await g.extraArgs.toGanymede({
  //       url: '/projects/{project_id}/server/{project_server_id}/stop',
  //       pathParameters: {
  //         project_server_id: g.event.project_server_id,
  //       },
  //       method: 'POST',
  //       headers: { authorization: g.extraArgs.authorizationHeader },
  //     });

  //     /**
  //      * delete driver
  //      */
  //     this._drivers.deleteDrivers(s.project_server_id);

  //     this._updateProjectServers(g);

  //     return;
  //   }

  //

  async _newVolume(g: Ra<TEventNewVolume>) {
    const r = await g.extraArgs.toGanymede<{ _0: { new_volume_id: number } }>({
      url: '/projects/{project_id}/volume',
      method: 'POST',
      jsonBody: {
        name: g.event.name,
        storage: g.event.storage,
      },
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    // get all project's volume and find the new one's data
    const r2 = await g.extraArgs.toGanymede<{ _0: TApi_Volume[] }>({
      url: '/projects/{project_id}/volume',
      method: 'GET',
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    const volumes = r2._0;
    const newVolume = volumes.find((s) => s.volume_id === r._0.new_volume_id);

    if (newVolume) addVolume(g.sd, newVolume, g.event.position);

    dispatchUpdateAllGraphViews(g, 'new-volume');

    return;
  }

  /**
   *
   */

  async _mountVolume(g: Ra<TEventMountVolume>) {
    await g.extraArgs.toGanymede({
      url: '/projects/{project_id}/server/{project_server_id}/mount',
      method: 'POST',
      pathParameters: {
        project_server_id: g.event.project_server_id,
      },
      jsonBody: {
        volume_id: g.event.volume_id,
        mount_point: g.event.mount_point,
      },
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    addMountEdge(g.sd, g.event, g.event.project_server_id);

    dispatchUpdateAllGraphViews(g, 'mount-volume');

    return;
  }

  /**
   *
   */

  async _unmountVolume(g: Ra<TEventUnmountVolume>) {
    await g.extraArgs.toGanymede({
      url: '/projects/{project_id}/server/{project_server_id}/unmount',
      method: 'POST',
      pathParameters: {
        project_server_id: g.event.project_server_id,
      },
      jsonBody: {
        volume_id: g.event.volume_id,
        mount_point: g.event.mount_point,
      },
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    // we make the exact edge to match for deletion
    const match = makeMountEdge(g.event, g.event.project_server_id);

    // we delete matching edges (should be only one)
    g.sd.edges.deleteMatching((e) => _.isEqual(match, e));

    dispatchUpdateAllGraphViews(g, 'unmount-volume');

    return;
  }

  /**
   *
   */

  async _deleteVolume(g: Ra<TEventDeleteVolume>) {
    await g.extraArgs.toGanymede({
      url: '/projects/{project_id}/volume/{volume_id}',
      method: 'DELETE',
      pathParameters: {
        volume_id: g.event.volume_id,
      },
      headers: { authorization: g.extraArgs.authorizationHeader },
    });

    deleteNode(g.sd, projectVolumeNodeId(g.event.volume_id));

    dispatchUpdateAllGraphViews(g, 'delete-volume');

    return;
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

const jupyterServerInitialInfo = (): TJupyterServerData => ({
  kernels: [],
  type: 'jupyter',
  ip: undefined,
  httpServices: [],
});

const pgadminServerInitialInfo = (): TPgadminServerData => ({
  type: 'pgadmin',
});

const serverInitialInfo = (image_id: number) => {
  switch (image_id) {
    case 2:
    case 3:
      return jupyterServerInitialInfo();
    case 4:
      return pgadminServerInitialInfo();
  }
  throw new UserException('server image unknown');
};

export const addServer = (
  sd: TSpaceSharedData & TNotebookSharedData,
  s: TG_Server,
  position?: TPosition,
  ec2_instance_state?: TEc2InstanceState
) => {
  const data: TServer = {
    ...s,
    httpServices: [],
    last_watchdog_at: null,
    last_activity: null,
    ec2_instance_state: ec2_instance_state || null,
    ...serverInitialInfo(s.image_id),
  };

  // store server data
  sd.projectServers.set(`${s.project_server_id}`, data);

  const id = projectServerNodeId(s.project_server_id);

  // create a node representing this server
  const nd: TNodeData = {
    id,
    type: 'server',
    server_name: s.server_name,
    project_server_id: s.project_server_id,
  };

  newNode(sd, nd, position || { x: 0, y: 0 }, true);
};

/**
 *
 */
export const addVolume = (
  sd: TSpaceSharedData & TNotebookSharedData,
  v: TApi_Volume,
  position: TPosition
) => {
  const nd: TNodeData = {
    id: projectVolumeNodeId(v.volume_id),
    type: 'volume',
    ...v,
  };
  newNode(sd, nd, position, true);
};

/**
 *
 */

const makeMountEdge = (
  m: Pick<TApi_Mount, 'mount_point' | 'volume_id'>,
  project_server_id: number
) => {
  const edge: TEdge = {
    from: {
      node: projectVolumeNodeId(m.volume_id),
      connectorName: 'outputs',
    },
    to: {
      node: projectServerNodeId(project_server_id),
      connectorName: 'inputs',
      data: {
        mount_point: m.mount_point,
      },
    },
    type: 'wired_to',
    data: {
      demiurge_type: 'mount',
    },
  };
  return edge;
};

export const addMountEdge = (
  sd: TSpaceSharedData & TNotebookSharedData,
  m: Pick<TApi_Mount, 'mount_point' | 'volume_id'>,
  project_server_id: number
) => {
  const e = makeMountEdge(m, project_server_id);
  sd.edges.push([e]);
};

/**
 *
 */
export const projectServerNodeId = (project_server_id: number) =>
  `project-server:${project_server_id}`;

const projectVolumeNodeId = (volume_id: number) =>
  `project-volume:${volume_id}`;
