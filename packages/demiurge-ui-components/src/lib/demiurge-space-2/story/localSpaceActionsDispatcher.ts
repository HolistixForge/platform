import {
  SpaceAction,
  SpaceActionsDispatcher,
} from '../apis/spaceActionsDispatcher';

export class LocalSpaceActionsDispatcher extends SpaceActionsDispatcher {
  dispatch(e: SpaceAction): void {
    console.log('Dispatching action:', e);
  }
}
