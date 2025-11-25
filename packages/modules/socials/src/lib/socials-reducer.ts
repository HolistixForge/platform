import { TCoreSharedData } from '@monorepo/core-graph';
import { Reducer, RequestData } from '@monorepo/reducers';
import { makeUuid } from '@monorepo/simple-types';
import { UserException } from '@monorepo/log';
import type { TReducersBackendExports } from '@monorepo/reducers';
import { TCollabBackendExports } from '@monorepo/collab';
import { TGatewayExports } from '@monorepo/gateway';

import {
  TEventSocials,
  TEventNewYoutube,
  TEventDeleteYoutube,
  TEventNewTextEditor,
  TEventDeleteTextEditor,
  TEventNewIframe,
  TEventDeleteIframe,
  TEventNewNodeUser,
  TEventDeleteNodeUser,
  TEventNewReservation,
  TEventDeleteReservation,
} from './socials-events';

//

type TRequired = {
  collab: TCollabBackendExports<TCoreSharedData>;
  reducers: TReducersBackendExports;
  gateway: TGatewayExports;
};

export class SocialsReducer extends Reducer<TEventSocials> {
  //

  constructor(private readonly depsExports: TRequired) {
    super();
    this.depsExports = depsExports;
  }

  reduce(event: TEventSocials, requestData: RequestData): Promise<void> {
    switch (event.type) {
      case 'socials:new-youtube':
        return this._newYoutube(event, requestData);

      case 'socials:delete-youtube':
        return this._deleteYoutube(event, requestData);

      case 'socials:new-text-editor':
        return this._newTextEditor(event, requestData);

      case 'socials:delete-text-editor':
        return this._deleteTextEditor(event, requestData);

      case 'socials:new-iframe':
        return this._newIframe(event, requestData);

      case 'socials:delete-iframe':
        return this._deleteIframe(event, requestData);

      case 'socials:new-node-user':
        return this._newNodeUser(event, requestData);

      case 'socials:delete-node-user':
        return this._deleteNodeUser(event, requestData);

      case 'socials:new-reservation':
        return this._newReservation(event, requestData);

      case 'socials:delete-reservation':
        return this._deleteReservation(event, requestData);

      default:
        return Promise.resolve();
    }
  }

  //

  async _newTextEditor(
    event: TEventNewTextEditor,
    requestData: RequestData
  ): Promise<void> {
    const id = makeUuid();

    await this.depsExports.collab.collab.sharedEditor.createEditor(
      id,
      'Start to write your text here...'
    );

    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          id,
          name: 'text-editor',
          type: 'text-editor',
          root: true,
          connectors: [],
        },
        edges: [],
        origin: event.origin,
      },
      requestData
    );
  }

  //

  async _deleteTextEditor(
    event: TEventDeleteTextEditor,
    requestData: RequestData
  ): Promise<void> {
    await this.depsExports.collab.collab.sharedEditor.deleteEditor(
      event.nodeId
    );

    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
  }

  //

  _newYoutube(
    event: TEventNewYoutube,
    requestData: RequestData
  ): Promise<void> {
    const id = makeUuid();

    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          id,
          name: 'youtube',
          type: 'youtube',
          root: true,
          data: { videoId: event.videoId },
          connectors: [],
        },
        edges: [],
        origin: event.origin,
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _deleteYoutube(
    event: TEventDeleteYoutube,
    requestData: RequestData
  ): Promise<void> {
    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _newIframe(event: TEventNewIframe, requestData: RequestData): Promise<void> {
    const id = makeUuid();

    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          id,
          name: 'iframe',
          type: 'iframe',
          root: true,
          data: { src: event.src },
          connectors: [],
        },
        edges: [],
        origin: event.origin,
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _deleteIframe(
    event: TEventDeleteIframe,
    requestData: RequestData
  ): Promise<void> {
    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
    return Promise.resolve();
  }

  _newNodeUser(
    event: TEventNewNodeUser,
    requestData: RequestData
  ): Promise<void> {
    const id = makeUuid();

    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          id,
          name: 'ID Card',
          type: 'node-user',
          root: true,
          data: { userId: event.userId },
          connectors: [],
        },
        edges: [],
        origin: event.origin,
      },
      requestData
    );
    return Promise.resolve();
  }

  _deleteNodeUser(
    event: TEventDeleteNodeUser,
    requestData: RequestData
  ): Promise<void> {
    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
    return Promise.resolve();
  }

  //

  _newReservation(
    event: TEventNewReservation,
    requestData: RequestData
  ): Promise<void> {
    const userId = event.userId || requestData.user_id;

    this.depsExports.collab.collab.sharedData['core-graph:nodes'].forEach(
      (node) => {
        if (node.data?.userId === userId) {
          throw new UserException('User already has a reservation');
        }
      }
    );

    const id = makeUuid();

    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          id,
          name: 'Reservation',
          type: 'reservation',
          root: true,
          data: { userId },
          connectors: [],
        },
        edges: [],
        origin: event.origin,
      },
      requestData
    );

    if (event.origin) {
      this.depsExports.reducers.processEvent(
        {
          type: 'space:lock-node',
          viewId: event.origin?.viewId,
          nid: id,
        },
        requestData
      );
    }

    return Promise.resolve();
  }

  _deleteReservation(
    event: TEventDeleteReservation,
    requestData: RequestData
  ): Promise<void> {
    const nodeData = this.depsExports.collab.collab.sharedData[
      'core-graph:nodes'
    ].get(event.nodeId);

    const jwt = requestData.jwt as { project_id?: string };
    const project_id = jwt?.project_id;
    if (!project_id) {
      throw new UserException('Project ID required');
    }
    const permissionManager = this.depsExports.gateway.permissionManager;
    const admin =
      permissionManager.hasPermission(
        requestData.user_id,
        `project:${project_id}:admin`
      ) ||
      permissionManager.hasPermission(requestData.user_id, 'org:admin') ||
      permissionManager.hasPermission(requestData.user_id, 'org:owner');

    if (admin || nodeData?.data?.userId === requestData.user_id) {
      this.depsExports.reducers.processEvent(
        {
          type: 'core:delete-node',
          id: event.nodeId,
        },
        requestData
      );
    }
    return Promise.resolve();
  }
}
