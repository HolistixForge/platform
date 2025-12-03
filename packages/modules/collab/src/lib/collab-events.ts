import { _AwarenessState } from '@holistix/collab-engine';

export type TEventUserLeave = {
  type: 'user-leave';
  userId: number;
  awarenessState?: _AwarenessState;
};
