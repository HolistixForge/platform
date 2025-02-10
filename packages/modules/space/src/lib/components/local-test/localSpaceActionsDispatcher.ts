import { TSpaceActions } from '../../space-events';
import { SpaceActionsDispatcher } from '../apis/spaceActionsDispatcher';
import { SpaceActionsReducer } from '../apis/spaceActionsReducer';
import { SpaceState } from '../apis/spaceState';
import { graph1 } from './graphs-data/graph-1';

//

export class LocalSpaceActionsDispatcher extends SpaceActionsDispatcher {
  private ss: SpaceState;
  private reducer: SpaceActionsReducer;

  constructor(ss: SpaceState) {
    super();
    this.reducer = new SpaceActionsReducer(graph1);
    this.ss = ss;
    this.ss.setState(this.reducer.currentView);
  }

  dispatch(action: TSpaceActions): void {
    console.log('Dispatching action:', action);
    this.reducer.reduce(action);
    this.ss.setState(this.reducer.currentView);
  }
}
