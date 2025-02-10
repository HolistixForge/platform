import { TSelectingUsers } from '../../space-types';
import { SpaceAwareness, TUserPosition } from '../apis/spaceAwareness';

//

export class CollabSpaceAwareness extends SpaceAwareness {
  getPointersUpdates(): TUserPosition[] {
    return [];
  }

  getSelectedNodes(): { [k: string]: TSelectingUsers } {
    return {};
  }

  selectNode(nid: string): void {
    // Do nothing
  }

  setPointer(x: number, y: number): void {
    // Do nothing
  }
}
