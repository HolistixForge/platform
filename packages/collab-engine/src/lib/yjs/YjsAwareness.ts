import { Doc, Map, Text } from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import { TJsonObject, sleep } from '@monorepo/simple-types';

import { Awareness } from '../Awareness';
import {
  AwarenessEventArgs,
  TAwarenessUser,
  _AwarenessState,
  _AwarenessStates,
  _PositionAwareness,
} from '../awareness-types';

//

export class YjsAwareness extends Awareness {
  _ydoc: Doc;
  _provider: WebsocketProvider;
  // ytext, monaco editor collaborative bindings
  _editorBindings: Map<Text>;
  _userName: string | null = null;
  _buildUserCss?: (key: number, color: string | undefined) => void;

  constructor(
    ydoc: Doc,
    provider: WebsocketProvider,
    buildUserCss?: (key: number, color: string | undefined) => void
  ) {
    super();
    this._ydoc = ydoc;
    this._provider = provider;
    this._editorBindings = this._ydoc.getMap('editors');
    this._buildUserCss = buildUserCss;

    // TODO: lot of debouncing !!!! using delta
    this._provider.awareness.on(
      'change',
      ({ added, updated, removed }: AwarenessEventArgs, isLocal: string) => {
        // if not our own event
        if (isLocal !== 'window unload') {
          const states = this._provider.awareness.getStates();

          // if new collaborator
          if (added.length) {
            // build user Css Class for editor custom color cursor
            // console.log(`Add css styles for user [${added.join(', ')}]`);
            states.forEach((v: _AwarenessState, k: number) =>
              this._buildUserCss?.(k, v.user && v.user.color)
            );
          }

          this.awarenessListeners.forEach((l) =>
            l({ states, added, updated, removed }, this)
          );
        }
      }
    );
  }

  override setUser(user: TAwarenessUser) {
    super.setUser(user);
    this._buildUserCss?.(this._provider.awareness.clientID, user.color);
    this._provider.awareness.setLocalStateField('user', this._user);
  }

  async getBindingObjects(editorId: string, code: string) {
    let ytext = this._editorBindings.get(editorId);

    if (!ytext) {
      const myClientId = this._provider.awareness.clientID;
      const states = this._provider.awareness.getStates();
      const clientIds = Array.from(states.keys()).sort((a, b) => a - b);
      const myPosition = clientIds.indexOf(myClientId);

      const BASE_DELAY = 0.5;
      const MAX_DELAY = 3;
      const waitTime = Math.min(myPosition * BASE_DELAY, MAX_DELAY);

      console.log(
        `Client ${myClientId} is position ${myPosition} of ${clientIds.length}, waiting ${waitTime}s`
      );

      await sleep(waitTime);

      ytext = this._editorBindings.get(editorId);
      if (!ytext) {
        console.log(`Creating new text for ${editorId}`);
        ytext = new Text(code);
        this._editorBindings.set(editorId, ytext);
      }
    }

    return { ytext, providerAwareness: this._provider.awareness };
  }

  override emitPositionAwareness(a: _PositionAwareness) {
    this._provider.awareness.setLocalStateField('position', a);
  }

  override emitSelectionAwareness(a: TJsonObject): void {
    this._provider.awareness.setLocalStateField('selections', a);
  }

  override getStates(): _AwarenessStates {
    const states = this._provider.awareness.getStates();
    return states;
  }

  override getMyId(): number {
    return this._provider.awareness.clientID;
  }
}

export default YjsAwareness;
