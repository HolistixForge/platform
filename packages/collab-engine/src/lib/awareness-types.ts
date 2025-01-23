export type xyz = { x: number; y: number; z: number };

export enum E_PositionReference {
  OBJECT = 'OBJECT',
  LAYER = 'LAYER',
  WORLD = 'WORLD',
}

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
};

export type _AwarenessState = {
  user?: TAwarenessUser;
  objectSelected?: string;
  position?: _PositionAwareness;
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
