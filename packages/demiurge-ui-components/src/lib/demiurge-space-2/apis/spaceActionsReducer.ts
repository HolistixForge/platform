import { TSpaceActions } from './spaceActions';
import { TSpaceState } from './spaceState';

export class SpaceActionsReducer {
  public reduce(state: TSpaceState, action: TSpaceActions) {
    console.log({ state, action });

    let cs;
    switch (action.type) {
      case 'close-connector':
        cs = state.connectors.get(action.nid);
        if (cs) {
          const c = cs.find((c) => c.connectorName === action.connectorName);
          if (c) {
            c.isOpened = false;
          }
        }
        break;

      case 'open-connector':
        cs = state.connectors.get(action.nid);
        if (cs) {
          const c = cs.find((c) => c.connectorName === action.connectorName);
          if (c) {
            c.isOpened = true;
          }
        }
        break;
    }

    return StaticRange;
  }
}
