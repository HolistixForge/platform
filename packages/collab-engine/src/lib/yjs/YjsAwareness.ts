import { Doc } from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import { TJsonObject } from '@monorepo/simple-types';

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

  // Cache the last user list for change detection
  private _lastUserList: TAwarenessUser[] = [];

  constructor(
    ydoc: Doc,
    provider: WebsocketProvider,
    buildUserCss?: (key: number, color: string | undefined) => void
  ) {
    super();
    this._ydoc = ydoc;
    this._provider = provider;

    this._buildUserCss = buildUserCss;

    // Initialize the user list cache
    this._lastUserList = this._extractUserList(
      this._provider.awareness.getStates()
    );

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

          this.callListeners({ states, added, updated, removed });

          // --- User List Change Detection ---
          const newUserList = this._extractUserList(states);
          if (!this._userListEquals(this._lastUserList, newUserList)) {
            this._lastUserList = newUserList;
            this.callUserListListeners(this._lastUserList);
          }
        }
      }
    );
  }

  /**
   * Extracts the user list from awareness states.
   */
  private _extractUserList(states: _AwarenessStates): TAwarenessUser[] {
    // Only include users with a defined username (and color)
    const users: TAwarenessUser[] = [];
    states.forEach((v: _AwarenessState) => {
      if (v.user && v.user.username && v.user.color) {
        users.push({ ...v.user });
      }
    });
    // Optionally sort by username for stable order
    users.sort((a, b) => a.username.localeCompare(b.username));
    return users;
  }

  /**
   * Compares two user lists for equality (shallow compare on username/color).
   */
  private _userListEquals(a: TAwarenessUser[], b: TAwarenessUser[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].username !== b[i].username || a[i].color !== b[i].color) {
        return false;
      }
    }
    return true;
  }

  override getUserList(): TAwarenessUser[] {
    // Return the cached user list
    return this._lastUserList;
  }

  override setUser(user: TAwarenessUser) {
    super.setUser(user);
    this._buildUserCss?.(this._provider.awareness.clientID, user.color);
    this._provider.awareness.setLocalStateField('user', this._user);
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
