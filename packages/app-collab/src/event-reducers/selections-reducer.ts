import {
  ReduceArgs,
  Reducer,
  TCollabNativeEvent,
  TEventUserLeave,
} from '@monorepo/collaborative';
import {
  TDemiurgeSpaceEvent,
  TDemiurgeSpaceSharedData,
  TEventSelectionChange,
} from '@monorepo/demiurge-types';

/**
 *
 */

type ReducedEvents = TDemiurgeSpaceEvent | TCollabNativeEvent;

type Ra<T> = ReduceArgs<
  TDemiurgeSpaceSharedData,
  T,
  undefined,
  Record<string, never>
>;

export class SelectionReducer extends Reducer<
  TDemiurgeSpaceSharedData,
  TDemiurgeSpaceEvent,
  undefined,
  Record<string, never>
> {
  //

  reduce(g: Ra<ReducedEvents>): Promise<void> {
    switch (g.event.type) {
      case 'selection-change':
        return this._selectionChange(g as Ra<TEventSelectionChange>);

      case 'user-leave':
        return this._userLeave(g as Ra<TEventUserLeave>);

      default:
        return Promise.resolve();
    }
  }

  //

  _selectionChange(g: Ra<TEventSelectionChange>): Promise<void> {
    const a = [...(g.sd.selections.get(g.event.user.username) || [])];
    const i = a.findIndex(
      (s) => s.userId === g.event.userId && s.viewId === g.event.viewId
    );
    if (i !== -1) a.splice(i, 1);
    a.push(g.event);
    g.sd.selections.set(g.event.user.username, a);
    return Promise.resolve();
  }

  //

  _userLeave(g: Ra<TEventUserLeave>): Promise<void> {
    if (g.event.type === 'user-leave') {
      g.sd.selections.forEach((userSelections, userName) => {
        if (userSelections.length > 0) {
          if (!g.event.awarenessState) g.sd.selections.delete(userName);
        }
      });
    }
    return Promise.resolve();
  }
}
