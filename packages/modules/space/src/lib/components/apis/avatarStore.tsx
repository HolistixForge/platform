import { ReactElement } from 'react';

import { Listenable } from '@monorepo/simple-types';

import { SpaceAwareness } from './spaceAwareness';
import { PointerTracker } from './pointerTracker';

export class AvatarStore extends Listenable {
  protected pointerTracker: PointerTracker;
  protected ga: SpaceAwareness;

  constructor(pt: PointerTracker, ga: SpaceAwareness) {
    super();
    this.pointerTracker = pt;
    this.ga = ga;
    this.ga.addListener(() => {
      this.processUpdates();
    });
  }

  protected processUpdates() {}

  public getAvatarsElements(): (ReactElement | undefined)[] {
    return [];
  }

  public updateAllAvatars() {}
}
