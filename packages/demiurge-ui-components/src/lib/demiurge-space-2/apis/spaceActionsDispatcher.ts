import { TSpaceActions } from './types/spaceActions';

export abstract class SpaceActionsDispatcher {
  abstract dispatch(e: TSpaceActions): void;
}
