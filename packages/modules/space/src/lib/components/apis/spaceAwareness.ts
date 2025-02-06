import { Listenable } from './listenable';
import { TSelectingUsers } from '../../space-types';
import { TPosition } from '@monorepo/core';

export type TUserPosition = {
  key: number;
  user: {
    username: string;
    color: string;
  };
  position: TPosition;
  inactive: boolean;
};

export abstract class SpaceAwareness extends Listenable {
  abstract getPointersUpdates(): TUserPosition[];
  abstract getSelectedNodes(): { [k: string]: TSelectingUsers };
  abstract selectNode(nid: string): void;
  abstract setPointer(x: number, y: number): void;
}
