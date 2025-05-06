import { SpaceAwareness, TUserPosition } from '../apis/spaceAwareness';

//

export class DummySpaceAwareness extends SpaceAwareness {
  getPointersUpdates(): TUserPosition[] {
    return [];
  }

  getSelectedNodes(): any {
    return {};
  }

  selectNode(nid: string, selected: boolean): void {
    // Do nothing
  }

  setPointer(x: number, y: number): void {
    // Do nothing
  }

  getCurrentUserId(): number {
    return 0;
  }

  clearNodeSelection(): void {
    // Do nothing
  }
}
