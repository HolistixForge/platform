import { Doc } from 'yjs';
import { WebsocketProvider } from 'y-websocket';

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

  _buildUserCss?: (key: number, color: string | undefined) => void;

  constructor(
    ydoc: Doc,
    provider: WebsocketProvider,
    buildUserCss?: (key: number, color: string | undefined) => void
  ) {
    super();
    this._ydoc = ydoc;
    this._provider = provider;

    this._buildUserCss = buildUserCss;

    // Initialize the caches
    this._updateCachesAndNotify(this._provider.awareness.getStates());

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

          // Update caches and notify listeners as needed
          this._updateCachesAndNotify(states);
        }
      }
    );
  }

  override setUser(user: TAwarenessUser) {
    super.setUser(user);
    this._buildUserCss?.(this._provider.awareness.clientID, user.color);
    this._provider.awareness.setLocalStateField('user', this._user);
  }

  override emitPositionAwareness(a: _PositionAwareness) {
    this._provider.awareness.setLocalStateField('position', a);
  }

  override emitSelectionAwareness(a: {
    nodes: string[];
    viewId: string;
  }): void {
    const o: {
      space?: {
        nodes: string[];
        viewId: string;
      };
    } = { space: a };
    this._provider.awareness.setLocalStateField('selections', o);
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
