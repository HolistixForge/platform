import { TAwarenessUser } from '@monorepo/collaborative';

export type TUserViewSelection = {
  user: TAwarenessUser;
  userId: number;
  viewId: string;
  nodes: string[];
  edges: string[];
};

export type TUserSelections = TUserViewSelection[];
