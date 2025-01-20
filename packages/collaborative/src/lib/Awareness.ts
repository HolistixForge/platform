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

  getUser(): TAwarenessUser | null {
    return this._user;
  }

  abstract emitPositionAwareness(a: _PositionAwareness): void;

  addAwarenessListener(l: T_AwarenessListener) {
    this.awarenessListeners.push(l);
  }

  removeAwarenessListener(l1: T_AwarenessListener) {
    this.awarenessListeners = this.awarenessListeners.filter((l2) => l1 !== l2);
  }

  abstract getStates(): _AwarenessStates;

  abstract getMyId(): number;
}
