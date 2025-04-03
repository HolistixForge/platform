import { TPosition } from '@monorepo/core';
import { TSelectingUsers } from '../../space-types';
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

//

const generateRandomPosition = (): TPosition => {
  const RANGE = 1500;
  return {
    x: Math.floor(Math.random() * RANGE * 2 + 1) - RANGE,
    y: Math.floor(Math.random() * RANGE * 2 + 1) - RANGE,
  };
};

//

export class FakeSpaceAwareness extends SpaceAwareness {
  private userPositions: TUserPosition[];
  private selections: { [k: string]: TSelectingUsers } = {};
  private count = 7;
  private users = Array.from({ length: this.count }, (_, index) => ({
    username: `User-${index}`,
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
  }));

  constructor() {
    super();

    const generateRandomUserPosition = (key: number): TUserPosition => ({
      key,
      user: this.users[key],
      position: generateRandomPosition(),
      inactive: Math.random() > 0.5,
    });

    this.userPositions = Array.from({ length: this.count }, (_, index) =>
      generateRandomUserPosition(index)
    );
    this.startRandomUpdates();
  }

  private startRandomUpdates() {
    const updateInterval = () => {
      const interval = Math.random() * (20000 - 2000) + 2000;
      setTimeout(() => {
        this.randomlyUpdateUserPositions();
        this.randomlySelectNodes();
        this.notifyListeners();
        updateInterval();
      }, interval);
    };
    updateInterval();
  }

  private randomlyUpdateUserPositions() {
    this.userPositions.forEach((userPosition) => {
      if (userPosition.key !== 0 && Math.random() > 0.5) {
        userPosition.position = generateRandomPosition();
        userPosition.inactive = Math.random() > 0.5;
      }
    });
  }

  private randomlySelectNodes() {
    this.users.forEach((u, n) => {
      if (n !== 0 && Math.random() > 0.5) {
        const nodeId = `node-${Math.floor(Math.random() * 10) + 1}`;
        this.addNodeSelection(nodeId, n);
      }
    });
  }

  getPointersUpdates(): TUserPosition[] {
    return this.userPositions;
  }

  getSelectedNodes(): { [k: string]: TSelectingUsers } {
    return this.selections;
  }

  private addNodeSelection(nid: string, n: number) {
    const user = this.users[n];
    console.log('addNodeSelection', { nid, user });
    // Remove any entry in this.selections where user is user
    Object.keys(this.selections).forEach((key) => {
      this.selections[key] = this.selections[key].filter(
        (selection) => selection.user.username !== user.username
      );
      if (this.selections[key].length === 0) {
        delete this.selections[key];
      }
    });
    if (!this.selections[nid]) {
      this.selections[nid] = [];
    }
    this.selections[nid].push({
      user: this.users[n],
      viewId: `view-story`,
    });
  }

  selectNode(nid: string, selected: boolean): void {
    if (selected) {
      this.selections[nid].push({
        user: this.users[0],
        viewId: `view-story`,
      });
    } else {
      this.selections[nid] = this.selections[nid].filter(
        (selection) => selection.user.username !== this.users[0].username
      );
    }
  }

  clearNodeSelection(): void {
    Object.keys(this.selections).forEach((key) => {
      this.selections[key] = this.selections[key].filter(
        (selection) => selection.user.username !== this.users[0].username
      );
    });
  }

  setPointer(x: number, y: number): void {
    // Do nothing
  }

  getCurrentUserId(): number {
    return 0;
  }
}
