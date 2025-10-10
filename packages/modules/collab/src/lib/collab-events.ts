import { _AwarenessState } from '@monorepo/collab-engine';

export type TEventUserLeave = {
  type: 'user-leave';
  userId: number;
  awarenessState?: _AwarenessState;
};
