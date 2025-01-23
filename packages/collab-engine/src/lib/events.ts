import { _AwarenessState } from './awareness-types';

export type TEvent = {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & any;

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
