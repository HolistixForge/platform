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
  private _simulationEnabled = false;
  private _simulationUsers: TAwarenessUser[] = [];
  private _simulationInterval: NodeJS.Timeout | null = null;

  constructor(enableSimulation = false) {
    super();
    this._simulationEnabled = enableSimulation;

    if (this._simulationEnabled) {
      this._setupSimulation();

      this._lastPointerTracking = this._extractPointerTracking(this._fakeState);
      this._lastSelectionTracking = this._extractSelectionTracking(
        this._fakeState
      );
      this._lastUserList = this._extractUserList(this._fakeState);

      this.callUserListListeners();
      this.callPointerListeners();
      this.callSelectionListeners(this._lastSelectionTracking);
    }
  }

  private _setupSimulation() {
    // Create 7 simulated users
    this._simulationUsers = Array.from({ length: 7 }, (_, index) => ({
      user_id: `user-${index}`,
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
    const doit = () => {
      this._randomlyUpdateUserPositions();
      this._randomlySelectNodes();

      // Update and notify pointer and selection listeners if changed
      const newPointers = this._extractPointerTracking(this._fakeState);
      this._lastPointerTracking = newPointers;
      this.callPointerListeners();

      const newSelections = this._extractSelectionTracking(this._fakeState);
      this._lastSelectionTracking = newSelections;
      this.callSelectionListeners(this._lastSelectionTracking);
    };

    doit();

    const updateInterval = () => {
      const interval = Math.random() * (6000 - 2000) + 2000;
      this._simulationInterval = setTimeout(() => {
        doit();
        updateInterval();
      }, interval);
    };
    updateInterval();
  }

  private _randomlyUpdateUserPositions() {
    this._fakeState.forEach((state, key) => {
      // always have a user at 0,0 to test toLocalPane()
      if (key === 1) {
        state.position = {
          position: { x: 0, y: 0, z: 0 },
          reference: 'LAYER',
          inactive: false,
        };
      } else if (key !== 0 && Math.random() > 0.5) {
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

  override emitPositionAwareness(a: _PositionAwareness) {
    //
  }

  override emitSelectionAwareness(a: {
    nodes: string[];
    viewId: string;
  }): void {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const state = this._fakeState.get(0)!;
    state.selections = {
      space: {
        nodes: a.nodes,
        viewId: a.viewId,
      },
    };
    this._fakeState.set(0, state);

    // Update and notify pointer and selection listeners if changed
    const newSelections = this._extractSelectionTracking(this._fakeState);
    this._lastSelectionTracking = newSelections;
    this.callSelectionListeners(this._lastSelectionTracking);
  }

  override getStates(): _AwarenessStates {
    return this._fakeState;
  }

  override getMyId(): number {
    return 0;
  }

  override getUserList(): TAwarenessUser[] {
    const users = [
      this._fakeState.get(0)?.user,
      ...this._simulationUsers.slice(1),
    ].filter(Boolean) as TAwarenessUser[];
    return users;
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
