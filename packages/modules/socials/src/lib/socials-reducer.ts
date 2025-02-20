import { TEventDeleteNode, TEventNewNode } from '@monorepo/core';
import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { makeUuid } from '@monorepo/simple-types';

import {
  TEventSocials,
  TEventNewYoutube,
  TEventDeleteYoutube,
} from './socials-events';

//

type DispatchedEvents = TEventNewNode | TEventDeleteNode;

type Ra<T> = ReduceArgs<{}, T, DispatchedEvents, undefined>;

//

export class SocialsReducer extends Reducer<
  {},
  TEventSocials,
  DispatchedEvents,
  undefined
> {
  //

  reduce(g: Ra<TEventSocials>): Promise<void> {
    switch (g.event.type) {
      case 'socials:new-youtube':
        return this._newYoutube(g as Ra<TEventNewYoutube>);

      case 'socials:delete-youtube':
        return this._deleteYoutube(g as Ra<TEventDeleteYoutube>);

      default:
        return Promise.resolve();
    }
  }

  //

  _newYoutube(g: Ra<TEventNewYoutube>): Promise<void> {
    const id = makeUuid();

    g.dispatcher.dispatch({
      type: 'core:new-node',
      nodeData: {
        id,
        name: `video`,
        type: 'video',
        root: true,
        data: { videoId: g.event.videoId },
        connectors: [],
      },
      edges: [],
    });
    return Promise.resolve();
  }

  //

  _deleteYoutube(g: Ra<TEventDeleteYoutube>): Promise<void> {
    g.dispatcher.dispatch({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
    return Promise.resolve();
  }
}
