import { TCoreSharedData, TEventDeleteNode, TEventNewNode } from '@monorepo/core';
import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { makeUuid } from '@monorepo/simple-types';
import { makeProjectScopeString } from '@monorepo/demiurge-types';
import { UserException } from '@monorepo/log';
import { TEventLockNode } from '@monorepo/space';

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

type TExtraArgs = {
  project_id: string;
  user_id: string;
  jwt: {
    scope: string[]
  }
};

type DispatchedEvents = TEventNewNode | TEventDeleteNode | TEventLockNode;

type Ra<T> = ReduceArgs<TCoreSharedData, T, DispatchedEvents, TExtraArgs, undefined>;

//

export class SocialsReducer extends Reducer<
  TCoreSharedData,
  TEventSocials,
  DispatchedEvents,
  TExtraArgs,
  undefined
> {
  //

  reduce(g: Ra<TEventSocials>): Promise<void> {
    switch (g.event.type) {
      case 'socials:new-youtube':
        return this._newYoutube(g as Ra<TEventNewYoutube>);

      case 'socials:delete-youtube':
        return this._deleteYoutube(g as Ra<TEventDeleteYoutube>);

      case 'socials:new-text-editor':
        return this._newTextEditor(g as Ra<TEventNewTextEditor>);

      case 'socials:delete-text-editor':
        return this._deleteTextEditor(g as Ra<TEventDeleteTextEditor>);

      case 'socials:new-iframe':
        return this._newIframe(g as Ra<TEventNewIframe>);

      case 'socials:delete-iframe':
        return this._deleteIframe(g as Ra<TEventDeleteIframe>);

      case 'socials:new-node-user':
        return this._newNodeUser(g as Ra<TEventNewNodeUser>);

      case 'socials:delete-node-user':
        return this._deleteNodeUser(g as Ra<TEventDeleteNodeUser>);

      case 'socials:new-reservation':
        return this._newReservation(g as Ra<TEventNewReservation>);

      case 'socials:delete-reservation':
        return this._deleteReservation(g as Ra<TEventDeleteReservation>);

      default:
        return Promise.resolve();
    }
  }

  //

  async _newTextEditor(g: Ra<TEventNewTextEditor>): Promise<void> {
    const id = makeUuid();

    await g.sharedEditor.createEditor(id, 'Start to write your text here...');

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id,
        name: 'text-editor',
        type: 'text-editor',
        root: true,
        connectors: [],
      },
      edges: [],
      origin: g.event.origin,
    });
  }

  //

  async _deleteTextEditor(g: Ra<TEventDeleteTextEditor>): Promise<void> {
    await g.sharedEditor.deleteEditor(g.event.nodeId);

    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
  }

  //

  _newYoutube(g: Ra<TEventNewYoutube>): Promise<void> {
    const id = makeUuid();

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id,
        name: 'youtube',
        type: 'youtube',
        root: true,
        data: { videoId: g.event.videoId },
        connectors: [],
      },
      edges: [],
      origin: g.event.origin,
    });
    return Promise.resolve();
  }

  //

  _deleteYoutube(g: Ra<TEventDeleteYoutube>): Promise<void> {
    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
    return Promise.resolve();
  }

  //

  _newIframe(g: Ra<TEventNewIframe>): Promise<void> {
    const id = makeUuid();

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id,
        name: 'iframe',
        type: 'iframe',
        root: true,
        data: { src: g.event.src },
        connectors: [],
      },
      edges: [],
      origin: g.event.origin,
    });
    return Promise.resolve();
  }

  //

  _deleteIframe(g: Ra<TEventDeleteIframe>): Promise<void> {
    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
    return Promise.resolve();
  }

  _newNodeUser(g: Ra<TEventNewNodeUser>): Promise<void> {
    const id = makeUuid();

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id,
        name: 'ID Card',
        type: 'node-user',
        root: true,
        data: { userId: g.event.userId },
        connectors: [],
      },
      edges: [],
      origin: g.event.origin,
    });
    return Promise.resolve();
  }

  _deleteNodeUser(g: Ra<TEventDeleteNodeUser>): Promise<void> {
    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
    return Promise.resolve();
  }

  //

  _newReservation(g: Ra<TEventNewReservation>): Promise<void> {

    const userId = g.event.userId || g.extraArgs.user_id;

    g.sd.nodes.forEach((node) => {
      if (node.data?.userId === userId) {
        throw new UserException('User already has a reservation');
      }
    });

    const id = makeUuid();

    g.bep.process({
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
      origin: g.event.origin,
    });

    if (g.event.origin) {
      g.bep.process({
        type: 'space:lock-node',
        viewId: g.event.origin?.viewId,
        nid: id,
      }, g.extraArgs);
    }

    return Promise.resolve();
  }

  _deleteReservation(g: Ra<TEventDeleteReservation>): Promise<void> {
    const nodeData = g.sd.nodes.get(g.event.nodeId);

    const admin = g.extraArgs.jwt.scope.includes(makeProjectScopeString(g.extraArgs.project_id, 'project:admin'));

    if (admin || nodeData?.data?.userId === g.extraArgs.user_id) {
      g.bep.process({
        type: 'core:delete-node',
        id: g.event.nodeId,
      });
    }
    return Promise.resolve();
  }
}