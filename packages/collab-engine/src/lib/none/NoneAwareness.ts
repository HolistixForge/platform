import { TJsonObject } from '@monorepo/simple-types';

import { Awareness } from '../Awareness';

import {
  _AwarenessState,
  _AwarenessStates,
  _PositionAwareness,
} from '../awareness-types';

export class NoneAwareness extends Awareness {
  _fakeState = new Map<number, _AwarenessState>();

  override emitPositionAwareness(a: _PositionAwareness) {}

  override emitSelectionAwareness(a: TJsonObject): void {}

  override getStates(): _AwarenessStates {
    return this._fakeState;
  }

  override getMyId(): number {
    return 0;
  }
}

export default NoneAwareness;
