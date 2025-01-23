import * as Y from 'yjs';
import * as YWS from 'y-websocket';
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
  _ydoc: Y.Doc;
  _provider: YWS.WebsocketProvider;
  // ytext, monaco editor collaborative bindings
  _editorBindings: Y.Map<Y.Text>;
  _userName: string | null = null;
  _buildUserCss?: (key: number, color: string | undefined) => void;

  constructor(
    ydoc: Y.Doc,
    provider: YWS.WebsocketProvider,
    buildUserCss?: (key: number, color: string | undefined) => void
  ) {
    super();
    this._ydoc = ydoc;
    this._provider = provider;
    this._editorBindings = this._ydoc.getMap('__cellules__');
    this._buildUserCss = buildUserCss;

    // TODO: lot of debouncing !!!! using delta
    this._provider.awareness.on(
      'change',
      ({ added, updated, removed }: AwarenessEventArgs, isLocal: string) => {
        // if not our own event
        if (isLocal !== 'local' && isLocal !== 'window unload') {
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

  getBindingObjects(celluleId: string, code: string) {
    let ytext = this._editorBindings.get(celluleId);
    if (!ytext) {
      ytext = new Y.Text(code);
      this._editorBindings.set(celluleId, ytext);
    }
    return { ytext, providerAwareness: this._provider.awareness };
  }

  emitPositionAwareness(a: _PositionAwareness) {
    this._provider.awareness.setLocalStateField('position', a);
  }

  getStates(): _AwarenessStates {
    const states = this._provider.awareness.getStates();
    return states;
  }

  getMyId(): number {
    return this._provider.awareness.clientID;
  }
}

export default YjsAwareness;
