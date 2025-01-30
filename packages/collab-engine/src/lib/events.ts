import { _AwarenessState } from './awareness-types';

export type TEventUserLeave = {
  type: 'user-leave';
  userId: number;
  awarenessState?: _AwarenessState;
};

export type TEventPeriodic = {
  type: 'periodic';
  date: Date;
  interval: number;
};

export type TCollabNativeEvent = TEventUserLeave | TEventPeriodic;
