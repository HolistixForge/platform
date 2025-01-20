export type SpaceAction = {};

export abstract class SpaceActionsDispatcher {
  abstract dispatch(e: SpaceAction): void;
}

export class DummySpaceActionsDispatcher extends SpaceActionsDispatcher {
  dispatch(e: SpaceAction): void {
    console.log('Dispatching action:', e);
  }
}
