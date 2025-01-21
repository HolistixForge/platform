import { SpaceState } from '../apis/spaceState';
import { graph1 } from './graphs-data/graph-1';

export class LocalSpaceState extends SpaceState {
  constructor() {
    super();
    this._state = graph1;
  }
}
