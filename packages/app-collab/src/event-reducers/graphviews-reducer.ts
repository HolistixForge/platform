import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TSpaceSharedData } from '@monorepo/shared-data-model';
import { TSpaceActions } from '@monorepo/demiurge-ui-components';

/**
 *
 */

export type TDemiurgeSpaceEvent = {
  type: 'space-action';
  viewId: string;
  action: TSpaceActions;
};

type Ra<T> = ReduceArgs<TSpaceSharedData, T, undefined, Record<string, never>>;

/**
 *
 */

export class GraphViewsReducer extends Reducer<
  TSpaceSharedData,
  TDemiurgeSpaceEvent,
  undefined,
  Record<string, never>
> {
  //

  reduce(g: Ra<TDemiurgeSpaceEvent>) {
    switch (g.event.type) {
      default:
        return Promise.resolve();
    }
  }

  //
}
