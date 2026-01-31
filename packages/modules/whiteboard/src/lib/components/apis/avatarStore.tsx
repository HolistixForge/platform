import { ReactElement } from 'react';

import { Listenable } from '@holistix-forge/simple-types';
import { Awareness } from '@holistix-forge/collab-engine';

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

  protected processUpdates() {
    // No-op: Override in subclass if needed
  }

  public getAvatarsElements(): (ReactElement | undefined)[] {
    return [];
  }

  public updateAllAvatars() {
    // No-op: Override in subclass if needed
  }
}
