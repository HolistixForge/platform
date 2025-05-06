import { TJsonObject } from '@monorepo/simple-types';

import { Awareness } from '../Awareness';

import {
  _AwarenessState,
  _AwarenessStates,
  _PositionAwareness,
  TAwarenessUser,
} from '../awareness-types';

const generateRandomPosition = () => {
  const RANGE = 1500;
  return {
    x: Math.floor(Math.random() * RANGE * 2 + 1) - RANGE,
    y: Math.floor(Math.random() * RANGE * 2 + 1) - RANGE,
    z: 0,
  };
};

export class NoneAwareness extends Awareness {
  _fakeState: _AwarenessStates = new Map<number, _AwarenessState>();
  private _simulationEnabled: boolean = false;
  private _simulationUsers: TAwarenessUser[] = [];
  private _simulationInterval: NodeJS.Timeout | null = null;

  constructor(enableSimulation: boolean = false) {
    super();
    this._simulationEnabled = enableSimulation;

    if (this._simulationEnabled) {
      this._setupSimulation();
    }
  }

  private _setupSimulation() {
    // Create 7 simulated users
    this._simulationUsers = Array.from({ length: 7 }, (_, index) => ({
      username: `User-${index}`,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    }));

    // Initialize states for all users
    this._simulationUsers.forEach((user, index) => {
      this._fakeState.set(index, {
        user,
        position: {
          position: generateRandomPosition(),
          reference: 'LAYER',
          inactive: Math.random() > 0.5,
        },
        selections: {
          space: {
            nodes: [],
            viewId: 'fake-view',
          },
        },
      });
    });

    // Start random updates
    this._startRandomUpdates();
  }

  private _startRandomUpdates() {
    const updateInterval = () => {
      const interval = Math.random() * (20000 - 2000) + 2000;
      this._simulationInterval = setTimeout(() => {
        this._randomlyUpdateUserPositions();
        this._randomlySelectNodes();
        this.callListeners({
          states: this._fakeState,
          added: [],
          updated: Array.from(this._fakeState.keys()),
          removed: [],
        });
        updateInterval();
      }, interval);
    };
    updateInterval();
  }

  private _randomlyUpdateUserPositions() {
    this._fakeState.forEach((state, key) => {
      if (key !== 0 && Math.random() > 0.5) {
        state.position = {
          position: generateRandomPosition(),
          reference: 'LAYER',
          inactive: Math.random() > 0.5,
        };
      }
    });
  }

  private _randomlySelectNodes() {
    this._simulationUsers.forEach((user, index) => {
      if (index !== 0 && Math.random() > 0.5) {
        const nodeId = `node-${Math.floor(Math.random() * 10) + 1}`;
        const state = this._fakeState.get(index);
        if (state) {
          const spaceSelection = state.selections as {
            space?: { nodes: string[]; viewId: string };
          };
          if (!spaceSelection.space) {
            spaceSelection.space = { nodes: [], viewId: 'fake-view' };
          }
          spaceSelection.space.nodes = [nodeId];
        }
      }
    });
  }

  override setUser(user: TAwarenessUser) {
    super.setUser(user);
    this._fakeState.set(0, {
      user,
    });
  }

  override emitPositionAwareness(a: _PositionAwareness) {}

  override emitSelectionAwareness(a: TJsonObject): void {
    const state = this._fakeState.get(0)!;
    state.selections = a;
    this._fakeState.set(0, state);
    this.callListeners({
      states: this._fakeState,
      added: [],
      updated: [0],
      removed: [],
    });
  }

  override getStates(): _AwarenessStates {
    return this._fakeState;
  }

  override getMyId(): number {
    return 0;
  }

  // Cleanup method to stop simulation
  cleanup() {
    if (this._simulationInterval) {
      clearTimeout(this._simulationInterval);
      this._simulationInterval = null;
    }
  }
}

export default NoneAwareness;
