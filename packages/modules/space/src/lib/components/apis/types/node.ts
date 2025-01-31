import { TNodeViewStatus, TSelectingUsers } from '../../../space-types';

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
