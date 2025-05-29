import {
  _PositionAwareness,
  _AwarenessListenerArgs,
  _AwarenessStates,
  TAwarenessUser,
  _AwarenessState,
} from './awareness-types';

//
//

export type TUserPosition = {
  key: number;
  user: {
    username: string;
    color: string;
  };
  position: { x: number; y: number };
  inactive: boolean;
};

//
//

export abstract class Awareness {
  _user: TAwarenessUser | null = null;

  // --- Caches for user list, pointer tracking, selection tracking ---
  protected _lastUserList: TAwarenessUser[] = [];
  protected _lastPointerTracking: Map<string, Map<number, TUserPosition>> =
    new Map();
  protected _lastSelectionTracking: { [nodeId: string]: any[] } = {};

  setUser(user: TAwarenessUser): void {
    this._user = user;
  }

  getUser(): TAwarenessUser {
    if (!this._user) {
      throw new Error('User not set');
    }
    return this._user;
  }

  abstract emitPositionAwareness(a: _PositionAwareness): void;

  abstract emitSelectionAwareness(a: { nodes: string[]; viewId: string }): void;

  //

  abstract getStates(): _AwarenessStates;

  abstract getMyId(): number;

  // --- User List Listener Support ---
  private userListListeners: Array<() => void> = [];

  addUserListListener(listener: () => void) {
    this.userListListeners.push(listener);
  }

  removeUserListListener(listener: () => void) {
    this.userListListeners = this.userListListeners.filter(
      (l) => l !== listener
    );
  }

  protected callUserListListeners() {
    // console.log('callUserListListeners', this.userListListeners.length);
    this.userListListeners.forEach((l) => l());
  }

  getUserList(): TAwarenessUser[] {
    return this._lastUserList;
  }

  // --- Pointer Tracking Listener Support ---
  private pointerListeners: Array<() => void> = [];

  addPointerListener(listener: () => void) {
    this.pointerListeners.push(listener);
  }

  removePointerListener(listener: () => void) {
    this.pointerListeners = this.pointerListeners.filter((l) => l !== listener);
  }

  protected callPointerListeners() {
    // console.log('callPointerListeners', this.pointerListeners.length);
    this.pointerListeners.forEach((l) => l());
  }

  getPointerTracking(viewId: string): Map<number, TUserPosition> {
    return this._lastPointerTracking.get(viewId) || new Map();
  }

  // --- Selection Tracking Listener Support ---
  private selectionListeners: Array<() => void> = [];

  addSelectionListener(listener: () => void) {
    this.selectionListeners.push(listener);
  }

  removeSelectionListener(listener: () => void) {
    this.selectionListeners = this.selectionListeners.filter(
      (l) => l !== listener
    );
  }

  protected callSelectionListeners(selections: { [nodeId: string]: any[] }) {
    // console.log('callSelectionListeners', this.selectionListeners.length);
    this.selectionListeners.forEach((l) => l());
  }

  getSelectionTracking(): { [nodeId: string]: any[] } {
    return this._lastSelectionTracking;
  }

  // --- Extraction and Comparison Logic (shared) ---
  protected _extractUserList(states: _AwarenessStates): TAwarenessUser[] {
    const users: TAwarenessUser[] = [];
    states.forEach((v: _AwarenessState) => {
      if (v.user && v.user.username && v.user.color) {
        users.push({ ...v.user });
      }
    });
    users.sort((a, b) => a.username.localeCompare(b.username));
    return users;
  }

  protected _userListEquals(a: TAwarenessUser[], b: TAwarenessUser[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].username !== b[i].username || a[i].color !== b[i].color) {
        return false;
      }
    }
    return true;
  }

  protected _extractPointerTracking(
    states: _AwarenessStates
  ): Map<string, Map<number, TUserPosition>> {
    const pointers = new Map<string, Map<number, TUserPosition>>();
    states.forEach((v: _AwarenessState, k: number) => {
      if (v.position && v.user) {
        const viewId = v.position.referenceId;
        if (!viewId) return;
        if (!pointers.has(viewId)) {
          pointers.set(viewId, new Map());
        }
        pointers.get(viewId)!.set(k, {
          key: k,
          user: v.user,
          position: v.position.position,
          inactive: v.position.inactive ?? false,
        });
      }
    });
    return pointers;
  }

  protected _pointerTrackingEquals(
    a: Map<string, Map<number, TUserPosition>>,
    b: Map<string, Map<number, TUserPosition>>
  ): boolean {
    if (a.size !== b.size) return false;
    for (const [k] of a) {
      const aView = a.get(k);
      const bView = b.get(k);
      if (!aView || !bView || aView.size !== bView.size) return false;
      for (const [k, v] of aView) {
        const bv = bView.get(k);
        if (!bv) return false;
        if (
          v.user?.username !== bv.user?.username ||
          v.user?.color !== bv.user?.color ||
          v.position?.x !== bv.position?.x ||
          v.position?.y !== bv.position?.y ||
          v.inactive !== bv.inactive
        ) {
          return false;
        }
      }
    }

    return true;
  }

  protected _extractSelectionTracking(states: _AwarenessStates): {
    [nodeId: string]: any[];
  } {
    const r: { [nodeId: string]: any[] } = {};
    states.forEach((s: _AwarenessState) => {
      if (s.selections && s.user) {
        const space = (s.selections as any).space;
        if (space && Array.isArray(space.nodes)) {
          space.nodes.forEach((nodeId: string) => {
            if (!r[nodeId]) r[nodeId] = [];
            r[nodeId].push({
              user: s.user,
              viewId: space.viewId,
            });
          });
        }
      }
    });
    return r;
  }

  protected _selectionTrackingEquals(
    a: { [nodeId: string]: any[] },
    b: { [nodeId: string]: any[] }
  ): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!b[key] || a[key].length !== b[key].length) return false;
      for (let i = 0; i < a[key].length; i++) {
        const au = a[key][i];
        const bu = b[key][i];
        if (
          au.user?.username !== bu.user?.username ||
          au.user?.color !== bu.user?.color ||
          au.viewId !== bu.viewId
        ) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Call this in subclasses when states change. Updates caches and notifies listeners as needed.
   */
  protected _updateCachesAndNotify(states: _AwarenessStates) {
    // User list
    const newUserList = this._extractUserList(states);
    if (!this._userListEquals(this._lastUserList, newUserList)) {
      this._lastUserList = newUserList;
      this.callUserListListeners();
    }
    // Pointer tracking
    const newPointerTracking = this._extractPointerTracking(states);
    if (
      !this._pointerTrackingEquals(
        this._lastPointerTracking,
        newPointerTracking
      )
    ) {
      this._lastPointerTracking = newPointerTracking;
      this.callPointerListeners();
    }
    // Selection tracking
    const newSelectionTracking = this._extractSelectionTracking(states);
    // console.log('newSelectionTracking', this.uuid, newSelectionTracking);
    if (
      !this._selectionTrackingEquals(
        this._lastSelectionTracking,
        newSelectionTracking
      )
    ) {
      this._lastSelectionTracking = newSelectionTracking;
      this.callSelectionListeners(this._lastSelectionTracking);
    }
  }
}
