import {
  ReduceArgs,
  Reducer,
  TCollabNativeEvent,
  TEventPeriodic,
} from '@monorepo/collab-engine';
import { TJwtServer, TJwtUser } from '@monorepo/demiurge-types';
import { TMyfetchRequest, secondAgo } from '@monorepo/simple-types';
import { error, log } from '@monorepo/log';
import {
  TCoreSharedData,
  TGraphNode,
  TEventDeleteEdge,
  TEventDeleteNode,
  TEventNewEdge,
  TEventNewNode,
  TEdge,
} from '@monorepo/core';
import { UserException } from '@monorepo/log';

import { TServersSharedData } from './servers-shared-model';
import {
  TApi_Volume,
  TG_Server,
  TEc2InstanceState,
  TServer,
} from './servers-types';
import {
  TEventNewServer,
  TEventNewVolume,
  TEventMountVolume,
  TEventUnmountVolume,
  TEventDeleteVolume,
  TEventDeleteServer,
  TEventServerWatchdog,
  TEventServerActivity,
  TEventServerMapHttpService,
  TServerEvents,
  TEventHostServer,
  TEventServerToCloud,
  TEventServerCloudPause,
  TEventServerCloudStart,
  TEventServerCloudDelete,
  TEventUpdateInstanceState,
} from './servers-events';

/**
 *
 */

type TExtraArgs = {
  toGanymede: <T>(r: TMyfetchRequest) => Promise<T>;
  authorizationHeader: string;
  jwt: TJwtServer | TJwtUser;
  ip: string;
};

type ReducedEvents = TServerEvents | TCollabNativeEvent;

type DispatchedEvents =
  | TEventUpdateInstanceState
  | TEventNewNode
  | TEventDeleteNode
  | TEventNewEdge
  | TEventDeleteEdge;

type UsedSharedData = TCoreSharedData & TServersSharedData;

type Ra<T> = ReduceArgs<UsedSharedData, T, DispatchedEvents, TExtraArgs>;

//

type Turp = (
  locations: { location: string; ip: string; port: number }[]
) => Promise<void>;

export class ServersReducer extends Reducer<
  UsedSharedData,
  ReducedEvents,
  DispatchedEvents,
  TExtraArgs
> {
  updateReverseProxy: Turp;

  constructor(updateReverseProxy: Turp) {
    super();
    this.updateReverseProxy = updateReverseProxy;
  }

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
    if (newServer) {
      const { node, projectServer } = makeServer(newServer);
      g.sd.projectServers.set(
        `${projectServer.project_server_id}`,
        projectServer
      );

      g.dispatcher.dispatch({
        type: 'core:new-node',
        nodeData: node,
        edges: [],
        origin: g.event.origin,
      });
    }

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

      if (state) {
        g.dispatcher.dispatch({
          type: '_update-instance-state',
          project_server_id,
          state,
        });

        if (stableStates.includes(state)) {
          log(7, 'CLOUD_INSTANCE', `reached stable state: ${state}`);

          const update = await this._getUpToDateServerData(
            g,
            project_server_id
          );

          g.sd.projectServers.set(`${project_server_id}`, {
            ...s,
            ...update,
            ec2_instance_state: state,
          });

          break; // Exit the loop if the state is stable
        }
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
    const locations: { location: string; ip: string; port: number }[] = [];
    sd.projectServers.forEach((server) => {
      if (server.ip) {
        server.httpServices.forEach((hs) => {
          locations.push({
            location: hs.location,
            ip: server.ip as string,
            port: hs.port,
          });
        });
      }
    });
    this.updateReverseProxy(locations);
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

    g.dispatcher.dispatch({ type: 'core:delete-node', id });
  }

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

    if (newVolume) {
      const node = makeVolume(newVolume);
      g.dispatcher.dispatch({
        type: 'core:new-node',
        nodeData: node,
        origin: g.event.origin,
        edges: [],
      });
    }
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

    const edge = makeMountEdge(g.event);

    g.dispatcher.dispatch({ type: 'core:new-edge', edge });
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
    const match = makeMountEdge(g.event);

    g.dispatcher.dispatch({ type: 'core:delete-edge', edge: match });
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

    g.dispatcher.dispatch({
      type: 'core:delete-node',
      id: projectVolumeNodeId(g.event.volume_id),
    });
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

// TODO_DEM: from DB images table, column type
const serverInitialInfo = (image_id: number) => {
  switch (image_id) {
    case 2:
    case 3:
      return {
        type: 'jupyter',
      };
    case 4:
      return {
        type: 'pgadmin',
      };
  }
  throw new UserException('server image unknown');
};

//

export const makeServer = (
  s: TG_Server,
  ec2_instance_state?: TEc2InstanceState
) => {
  const projectServer: TServer = {
    ...s,
    httpServices: [],
    last_watchdog_at: null,
    last_activity: null,
    ec2_instance_state: ec2_instance_state || null,
    ...serverInitialInfo(s.image_id),
  };

  const id = projectServerNodeId(s.project_server_id);

  // create a node representing this server
  const node: TGraphNode = {
    id,
    name: s.server_name,
    type: 'server',
    root: true,
    connectors: [],
    data: {
      project_server_id: s.project_server_id,
    },
  };

  return { projectServer, node };
};

/**
 *
 */
export const makeVolume = (v: TApi_Volume) => {
  const nd: TGraphNode = {
    id: projectVolumeNodeId(v.volume_id),
    name: v.volume_name,
    root: true,
    type: 'volume',
    connectors: [{ connectorName: 'outputs', pins: [] }],
    data: v,
  };
  return nd;
};

/**
 *
 */

export const makeMountEdge = (a: {
  mount_point: string;
  volume_id: number;
  project_server_id: number;
}) => {
  const edge: TEdge = {
    from: {
      node: projectVolumeNodeId(a.volume_id),
      connectorName: 'outputs',
    },
    to: {
      node: projectServerNodeId(a.project_server_id),
      connectorName: 'inputs',
      data: {
        mount_point: a.mount_point,
      },
    },
    type: 'wired_to',
    data: {
      demiurge_type: 'mount',
    },
  };
  return edge;
};

/**
 *
 */
export const projectServerNodeId = (project_server_id: number) =>
  `project-server:${project_server_id}`;

const projectVolumeNodeId = (volume_id: number) =>
  `project-volume:${volume_id}`;
