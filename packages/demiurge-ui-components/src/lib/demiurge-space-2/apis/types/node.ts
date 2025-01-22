export type ENodeType = 'CODE';

export type TSelectingUsers = {
  user: { username: string; color: string };
  viewId: string;
}[];

export type TPosition = {
  x: number;
  y: number;
};

export type ENodeViewMode = 'REDUCED' | 'EXPANDED';

export type TNodeViewStatus = {
  mode: ENodeViewMode;
  forceOpened: boolean;
  forceClosed: boolean;
  isFiltered: boolean;
  rank: number;
  maxRank: number;
};

export type TNodeView = {
  id: string;
  position: TPosition;
  status: TNodeViewStatus;
  standalone?: boolean;
};

export type TUseNodeValue = {
  id: string;
  isOpened: boolean;
  zoom: number;
  viewId: string;
  viewStatus: TNodeViewStatus;
  open: () => void;
  close: () => void;
  reduce: () => void;
  expand: () => void;
  selectingUsers: TSelectingUsers;
  /** is this object selected on this view by current user ? */
  selected: boolean;
};

//

export const nodeViewDefaultStatus = (): TNodeViewStatus => ({
  mode: 'EXPANDED',
  forceOpened: false,
  forceClosed: false,
  isFiltered: false,
  rank: 0,
  maxRank: 1,
});

export const isNodeOpened = (status: TNodeViewStatus): boolean => {
  let opened = status.rank < status.maxRank;
  if (status.forceOpened) opened = true;
  else if (status.forceClosed) opened = false;
  return opened;
};
