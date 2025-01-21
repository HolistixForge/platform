import { TSpaceActions } from '../apis/spaceActions';
import { SpaceActionsDispatcher } from '../apis/spaceActionsDispatcher';
import { SpaceActionsReducer } from '../apis/spaceActionsReducer';
import { SpaceState } from '../apis/spaceState';

//

export class LocalSpaceActionsDispatcher extends SpaceActionsDispatcher {
  private ss: SpaceState;
  private reducer: SpaceActionsReducer;

  constructor(ss: SpaceState) {
    super();
    this.reducer = new SpaceActionsReducer();
    this.ss = ss;
  }

  dispatch(action: TSpaceActions): void {
    console.log('Dispatching action:', action);

    const stateCopy = this.ss.getStateCopy();

    this.reducer.reduce(stateCopy, action);

    this.ss.setState(stateCopy);
  }
}
