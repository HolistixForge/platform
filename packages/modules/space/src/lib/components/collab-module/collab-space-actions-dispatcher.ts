import { TSpaceActions } from '../../space-events';
import { SpaceActionsDispatcher } from '../apis/spaceActionsDispatcher';

//

export class CollabSpaceActionsDispatcher extends SpaceActionsDispatcher {
  constructor() {
    super();
  }

  dispatch(action: TSpaceActions): void {
    console.log('Dispatching action:', action);
  }
}
