import { TSpaceActions } from './spaceActions';

export abstract class SpaceActionsDispatcher {
  abstract dispatch(e: TSpaceActions): void;
}
