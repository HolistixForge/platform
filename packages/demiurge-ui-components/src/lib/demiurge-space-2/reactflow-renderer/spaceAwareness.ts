import { TPosition, TSelectingUsers } from '@monorepo/demiurge-types';
import { Listenable } from './listenable';

export type TUserPosition = {
  key: number;
  user: {
    username: string;
    color: string;
  };
  position: TPosition;
  inactive: boolean;
};

//

export abstract class SpaceAwareness extends Listenable {
  abstract getPointersUpdates(): TUserPosition[];
  abstract getSelectedNodes(): {[k:string]: TSelectingUsers};
  abstract selectNode(nid: string): void;
  abstract setPointer(x: number, y: number): void;
}

//

export class DummySpaceAwareness extends SpaceAwareness {
  getPointersUpdates(): TUserPosition[] {
    return [];
  }

  getSelectedNodes(): any {
    return {};
  }

  selectNode(nid: string): void {
    // Do nothing
  }

  setPointer(x: number, y: number): void {
    // Do nothing
  }
}

//

export class FakeSpaceAwareness extends SpaceAwareness {
  private userPositions: TUserPosition[];
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    super();
    const generateRandomPosition = (): TPosition => ({
      x: Math.floor(Math.random() * 6001) - 3000,
      y: Math.floor(Math.random() * 6001) - 3000,
    });

    const generateRandomUserPosition = (key: number): TUserPosition => ({
      key,
      user: {
        username: `User${key}`,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      },
      position: generateRandomPosition(),
      inactive: Math.random() > 0.5,
    });

    this.userPositions = Array.from({ length: 7 }, (_, index) =>
      generateRandomUserPosition(index),
    );

    this.startRandomUpdates();
  }

  private startRandomUpdates() {
    const updateInterval = () => {
      const interval = Math.random() * (20000 - 2000) + 2000;
      this.intervalId = setTimeout(() => {
        this.randomlyUpdateUserPositions();
        this.notifyListeners();
        updateInterval();
      }, interval);
    };
    updateInterval();
  }

  private randomlyUpdateUserPositions() {
    this.userPositions.forEach((userPosition) => {
      if (Math.random() > 0.5) {
        userPosition.position = {
          x: Math.floor(Math.random() * 6001) - 3000,
          y: Math.floor(Math.random() * 6001) - 3000,
        };
        userPosition.inactive = Math.random() > 0.5;
      }
    });
  }

  getPointersUpdates(): TUserPosition[] {
    return this.userPositions;
  }

  getSelectedNodes(): any {
    return {};
  }

  selectNode(nid: string): void {
    // Do nothing
  }

  setPointer(x: number, y: number): void {
    // Do nothing
  }
}
