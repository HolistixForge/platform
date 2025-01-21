export type SpaceAction = {};

export abstract class SpaceActionsDispatcher {
  abstract dispatch(e: SpaceAction): void;
}
