import { TJsonObject } from '@monorepo/simple-types';

import { Awareness } from '../Awareness';

import {
  _AwarenessState,
  _AwarenessStates,
  _PositionAwareness,
} from '../awareness-types';

export class NoneAwareness extends Awareness {
  _fakeState: _AwarenessStates = new Map<number, _AwarenessState>();

  override emitPositionAwareness(a: _PositionAwareness) {}

  override emitSelectionAwareness(a: TJsonObject): void {
    // console.log('emitSelectionAwareness', a);
    this._fakeState.set(0, {
      user: {
        username: 'John Doe',
        color: '#ffa500',
      },
      selections: a,
    });
    this.callListeners({
      states: this._fakeState,
      added: [],
      updated: [0],
      removed: [],
    });
  }

  override getStates(): _AwarenessStates {
    return this._fakeState;
  }

  override getMyId(): number {
    return 0;
  }
}

export default NoneAwareness;
