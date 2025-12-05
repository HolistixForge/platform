import { TNodeViewStatus, TSelectingUsers } from '../../../whiteboard-types';

export type TNodeContext = {
  id: string;
  isOpened: boolean;
  zoom: number;
  viewId: string;
  viewStatus: TNodeViewStatus;
  open: () => void;
  close: () => void;
  reduce: () => void;
  expand: () => void;
  filterOut: () => void;
  selectingUsers: TSelectingUsers;
  /** is this object selected on this view by current user ? */
  selected: boolean;
};
