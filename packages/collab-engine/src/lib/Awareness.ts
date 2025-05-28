import { TJsonObject } from '@monorepo/simple-types';

import {
  _PositionAwareness,
  _AwarenessListenerArgs,
  _AwarenessStates,
  TAwarenessUser,
} from './awareness-types';

//
//

type T_AwarenessListener = (args: _AwarenessListenerArgs, a: Awareness) => void;

//
//

export abstract class Awareness {
  awarenessListeners: Array<T_AwarenessListener>;
  _user: TAwarenessUser | null = null;

  constructor() {
    this.awarenessListeners = [];
  }

  setUser(user: TAwarenessUser): void {
    this._user = user;
  }

  getUser(): TAwarenessUser {
    if (!this._user) {
      throw new Error('User not set');
    }
    return this._user;
  }

  abstract emitPositionAwareness(a: _PositionAwareness): void;

  abstract emitSelectionAwareness(a: TJsonObject): void;

  addAwarenessListener(l: T_AwarenessListener) {
    this.awarenessListeners.push(l);
  }

  removeAwarenessListener(l1: T_AwarenessListener) {
    this.awarenessListeners = this.awarenessListeners.filter((l2) => l1 !== l2);
  }

  callListeners(args: _AwarenessListenerArgs) {
    this.awarenessListeners.forEach((l) => l(args, this));
  }

  abstract getStates(): _AwarenessStates;

  abstract getMyId(): number;

  // --- User List Listener Support ---
  private userListListeners: Array<(users: TAwarenessUser[]) => void> = [];

  addUserListListener(listener: (users: TAwarenessUser[]) => void) {
    this.userListListeners.push(listener);
  }

  removeUserListListener(listener: (users: TAwarenessUser[]) => void) {
    this.userListListeners = this.userListListeners.filter(
      (l) => l !== listener
    );
  }

  protected callUserListListeners(users: TAwarenessUser[]) {
    this.userListListeners.forEach((l) => l(users));
  }

  /**
   * Returns the current list of users (with username/color),
   * sorted or deduped as appropriate for the app.
   */
  abstract getUserList(): TAwarenessUser[];
}
