import { log } from '@monorepo/log';
import { Reducer } from './reducer';
import { SharedTypes } from './SharedTypes';
import { TValidSharedData } from './chunk';
import { ApiFetch } from '@monorepo/api-fetch';
import { TJson } from '@monorepo/simple-types';

//

type ValidReducer<Targs> = Reducer<TValidSharedData, any, any, Partial<Targs>>;

//

export class Dispatcher<TE, Targs> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  _sharedTypes: SharedTypes = null!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  _sharedData: TValidSharedData = null!;
  _reducers: Array<ValidReducer<Targs>> = [];
  _dispatcherExtraArgs: Partial<Targs>;

  constructor(args: Partial<Targs>) {
    this._dispatcherExtraArgs = args;
  }

  bindData(sharedTypes: SharedTypes, sharedData: TValidSharedData) {
    this._sharedData = sharedData;
    this._sharedTypes = sharedTypes;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async dispatch(event: TE, eventExtraArgs?: Partial<Targs>): Promise<void> {
    if (this._sharedTypes) {
      log(7, 'DISPATCH', '', event);
      return this._sharedTypes.transaction(async () => {
        for (let i = 0; i < this._reducers.length; i++) {
          await this._reducers[i].reduce({
            sd: this._sharedData,
            st: this._sharedTypes,
            event,
            dispatcher: this,
            extraArgs: {
              ...this._dispatcherExtraArgs,
              ...eventExtraArgs,
            },
          });
        }
      });
    }
  }

  //

  addReducer(r: ValidReducer<Targs>) {
    this._reducers.push(r);
  }

  //

  async batch(events: TE[]): Promise<void> {
    for (let i = 0; i < events.length; i++) await this.dispatch(events[i]);
  }
}

//
//
//

export class BrowserDispatcher<TE> extends Dispatcher<
  TE,
  Record<string, never>
> {
  _fetch: ApiFetch;

  constructor(fetch: ApiFetch) {
    super({});
    this._fetch = fetch;
  }

  override async dispatch(event: TE): Promise<void> {
    log(7, 'DISPATCH_BROWSER', '', event);

    await this._fetch.fetch({
      url: 'event',
      method: 'POST',
      jsonBody: { event: event as TJson },
    });
  }
}
