import { TSpaceActions } from '../../space-events';

export abstract class SpaceActionsDispatcher {
  abstract dispatch(e: TSpaceActions): void;
}
