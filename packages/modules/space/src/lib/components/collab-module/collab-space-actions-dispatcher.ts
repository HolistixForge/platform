import { Dispatcher } from '@monorepo/collab-engine';
import { TSpaceActions, TSpaceEvent } from '../../space-events';
import { SpaceActionsDispatcher } from '../apis/spaceActionsDispatcher';

//

export class CollabSpaceActionsDispatcher extends SpaceActionsDispatcher {
  collabDispatcher: Dispatcher<TSpaceEvent, {}>;
  viewId: string;

  constructor(viewId: string, d: Dispatcher<TSpaceEvent, {}>) {
    super();
    this.viewId = viewId;
    this.collabDispatcher = d;
  }

  dispatch(action: TSpaceActions): void {
    this.collabDispatcher.dispatch({
      type: 'space:action',
      action,
      viewId: this.viewId,
    });
  }
}
