import { TJsonObject } from '@holistix/simple-types';

export type xyz = { x: number; y: number; z: number };

export type E_PositionReference = 'OBJECT' | 'LAYER' | 'WORLD';

export type _PositionAwareness = {
  position: xyz;
  rotation?: xyz;
  reference: E_PositionReference;
  referenceId?: string;
  inactive?: boolean;
};

export type TAwarenessUser = {
  username: string;
  color: string;
  user_id: string;
};

export type _AwarenessState = {
  user?: TAwarenessUser;
  position?: _PositionAwareness;
  selections?: TJsonObject;
};

export type AwarenessEventArgs = {
  added: Array<number>;
  updated: Array<number>;
  removed: Array<number>;
};

export type _AwarenessStates = Map<number, _AwarenessState>;

export type _AwarenessListenerArgs = {
  states: _AwarenessStates;
} & AwarenessEventArgs;
