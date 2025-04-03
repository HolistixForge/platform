import {
  Awareness,
  _AwarenessStates,
  _AwarenessState,
} from '@monorepo/collab-engine';

import { TSelectingUsers } from '../../space-types';
import { SpaceAwareness, TUserPosition } from '../apis/spaceAwareness';

//

type SpaceSelection = {
  space?: {
    nodes: string[];
    viewId: string;
  };
};

//

export class CollabSpaceAwareness extends SpaceAwareness {
  viewId: string;
  awareness: Awareness;
  states: _AwarenessStates = new Map();
  selectedNodes: string[] = [];

  constructor(viewId: string, awareness: Awareness) {
    super();
    this.viewId = viewId;
    this.awareness = awareness;
    this.awareness.addAwarenessListener((args) => {
      this.states = args.states;
      this.notifyListeners();
    });
  }

  //

  getCurrentUserId(): number {
    return this.awareness.getMyId();
  }

  //

  getPointersUpdates(): TUserPosition[] {
    return Array.from(this.states.keys())
      .map((k) => {
        const s = this.states.get(k) as _AwarenessState;
        return {
          key: k,
          user: s.user!,
          position: s.position?.position!,
          inactive: s.position?.inactive ?? false,
        };
      })
      .filter((o) => o.user && o.position);
  }

  //

  getSelectedNodes(): { [k: string]: TSelectingUsers } {
    const r: { [k: string]: TSelectingUsers } = {};
    Array.from(this.states.values()).forEach((s) => {
      if (s.selections) {
        const nodes = (s.selections as SpaceSelection).space?.nodes;
        if (nodes && s.user) {
          nodes.forEach((node) => {
            if (!r[node]) r[node] = [];
            r[node].push({
              user: s.user!,
              viewId: (s.selections as SpaceSelection).space!.viewId,
            });
          });
        }
      }
    });
    return r;
  }

  //

  clearNodeSelection(): void {
    this.selectedNodes = [];
    this.awareness.emitSelectionAwareness({});
  }

  //

  selectNode(nid: string, selected: boolean): void {
    this.selectedNodes = this.selectedNodes.filter((n) => n !== nid);
    if (selected) this.selectedNodes.push(nid);

    const o: SpaceSelection = {
      space: { nodes: this.selectedNodes, viewId: this.viewId },
    };

    this.awareness.emitSelectionAwareness(o);
  }

  //

  setPointer(x: number, y: number, inactive?: true): void {
    this.awareness.emitPositionAwareness({
      position: { x, y, z: 0 },
      reference: 'LAYER',
      inactive,
    });
  }
}
