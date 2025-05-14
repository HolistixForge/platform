import { TEventDeleteNode, TEventNewNode } from '@monorepo/core';
import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { makeUuid } from '@monorepo/simple-types';

import {
  TEventSocials,
  TEventNewYoutube,
  TEventDeleteYoutube,
  TEventNewTextEditor,
  TEventDeleteTextEditor,
  TEventNewIframe,
  TEventDeleteIframe,
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

      case 'socials:new-text-editor':
        return this._newTextEditor(g as Ra<TEventNewTextEditor>);

      case 'socials:delete-text-editor':
        return this._deleteTextEditor(g as Ra<TEventDeleteTextEditor>);

      case 'socials:new-iframe':
        return this._newIframe(g as Ra<TEventNewIframe>);

      case 'socials:delete-iframe':
        return this._deleteIframe(g as Ra<TEventDeleteIframe>);

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
}
