import { ReactElement } from 'react';

import { Listenable } from '@monorepo/simple-types';
import { Awareness } from '@monorepo/collab-engine';

import { PointerTracker } from '../PointerTracker';

export class AvatarStore extends Listenable {
  protected pointerTracker: PointerTracker;
  protected awareness: Awareness;
  protected viewId: string;

  constructor(viewId: string, pt: PointerTracker, awareness: Awareness) {
    super();
    this.viewId = viewId;
    this.pointerTracker = pt;
    this.awareness = awareness;
    this.awareness.addPointerListener(() => {
      this.processUpdates();
    });
  }

  protected processUpdates() {}

  public getAvatarsElements(): (ReactElement | undefined)[] {
    return [];
  }

  public updateAllAvatars() {}
}
