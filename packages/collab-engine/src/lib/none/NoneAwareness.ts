/* eslint-disable @typescript-eslint/no-empty-function */
import { Awareness } from '../Awareness';

import {
  _AwarenessState,
  _AwarenessStates,
  _PositionAwareness,
} from '../awareness-types';

export class NoneAwareness extends Awareness {
  _fakeState = new Map<number, _AwarenessState>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  emitPositionAwareness(a: _PositionAwareness) {}

  getStates(): _AwarenessStates {
    return this._fakeState;
  }

  getMyId(): number {
    return 0;
  }
}

export default NoneAwareness;
