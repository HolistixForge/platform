import { log } from '@monorepo/log';
import { Reducer } from './reducer';
import { SharedTypes } from './SharedTypes';
import { TValidSharedData } from './chunk';
import { ApiFetch } from '@monorepo/api-fetch';
import { TJson } from '@monorepo/simple-types';
import { SharedEditor } from './SharedEditor';
import { v4 as uuidv4 } from 'uuid';

// Sequence related types
interface SequenceEvent {
  sequenceId: string;
  sequenceCounter: number;
}

interface SequenceContext {
  sequenceId: string;
  lastProcessedCounter: number;
  hasError: boolean;
}

interface Sequence<TE> {
  sequenceId: string;
  dispatch: (event: TE) => Promise<void>;
}

type ValidReducer<Targs> = Reducer<TValidSharedData, any, any, Partial<Targs>>;

//

export class Dispatcher<TE, Targs> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  _sharedTypes: SharedTypes = null!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  _sharedData: TValidSharedData = null!;
  _reducers: Array<ValidReducer<Targs>> = [];
  _dispatcherExtraArgs: Partial<Targs> = {};
  _yjsSharedEditor: SharedEditor | undefined;
  // TODO: remove old sequence context from map
  _sequenceContexts: Map<string, SequenceContext> = new Map();

  constructor() {}

  bindData(
    sharedTypes: SharedTypes,
    yse: SharedEditor,
    sharedData: TValidSharedData,
    extraArgs: Partial<Targs>
  ) {
    this._sharedData = sharedData;
    this._yjsSharedEditor = yse;
    this._sharedTypes = sharedTypes;
    this._dispatcherExtraArgs = extraArgs;
  }

  async dispatch(
    event: TE & Partial<SequenceEvent>,
    eventExtraArgs?: Partial<Targs>
  ): Promise<void> {
    if (this._sharedTypes) {
      let context: SequenceContext | undefined;

      // retreive or create sequence context if necessary
      if (event.sequenceId) {
        context = this._sequenceContexts.get(event.sequenceId);
        if (!context) {
          context = {
            sequenceId: event.sequenceId,
            lastProcessedCounter: 0,
            hasError: false,
          };
        }
        this._sequenceContexts.set(event.sequenceId, context);
      }

      // Handle sequence logic
      if (context) {
        // Skip if sequence has error or counter is too low
        if (
          context.hasError ||
          (event as any).sequenceCounter <= context.lastProcessedCounter
        ) {
          log(
            7,
            'SKIP_SEQUENCE_EVENT',
            `[${event.sequenceId}, ${event.sequenceCounter}]`
          );
          return;
        }
      }

      log(7, 'DISPATCH', '', event);
      try {
        await this._sharedTypes.transaction(async () => {
          for (let i = 0; i < this._reducers.length; i++) {
            await this._reducers[i].reduce({
              sd: this._sharedData,
              st: this._sharedTypes,
              event,
              dispatcher: this,
              sharedEditor: this._yjsSharedEditor!,
              extraArgs: {
                ...this._dispatcherExtraArgs,
                ...eventExtraArgs,
              },
            });
          }

          // Update sequence context after successful processing
          if (context) {
            this._sequenceContexts.set((event as any).sequenceId, {
              sequenceId: (event as any).sequenceId,
              lastProcessedCounter: (event as any).sequenceCounter,
              hasError: false,
            });
          }
        });
      } catch (error) {
        // Mark sequence as failed if there's an error
        if (context) {
          this._sequenceContexts.set((event as any).sequenceId, {
            ...context,
            hasError: true,
          });
        }

        throw error; // Re-throw to let caller handle the error
      }
    }
  }

  // Create a new event sequence
  createSequence(): Sequence<TE> {
    const sequenceId = uuidv4();
    let counter = 0;
    let hasError = false;
    return {
      sequenceId,
      dispatch: async (event: TE) => {
        // Don't dispatch if sequence has error
        if (hasError) return Promise.resolve();
        counter++;
        try {
          const r = await this.dispatch({
            ...event,
            sequenceId,
            sequenceCounter: counter,
          } as TE & SequenceEvent);
          return r;
        } catch (error) {
          hasError = true;
          throw error;
        }
      },
    };
  }

  //

  addReducer(r: ValidReducer<Targs>) {
    this._reducers.push(r);
  }

  //

  async batch(events: TE[]): Promise<void> {
    for (let i = 0; i < events.length; i++)
      await this.dispatch(events[i] as TE & Partial<SequenceEvent>);
  }
}

//
//
//

/**
 * A dispatcher that adds a jitter to the dispatch time
 * to simulate a real network propagation
 */
export class JitterDispatcher<TE> extends Dispatcher<
  TE,
  Record<string, never>
> {
  constructor() {
    super();
  }

  override async dispatch(event: TE & Partial<SequenceEvent>): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 200 + 25)
    );
    await super.dispatch(event);
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
    super();
    this._fetch = fetch;
  }

  override async dispatch(event: TE & Partial<SequenceEvent>): Promise<void> {
    log(7, 'DISPATCH_BROWSER', '', event);
    await this._fetch.fetch({
      url: 'event',
      method: 'POST',
      jsonBody: { event: event as TJson },
    });
  }
}

// Export types
export type { Sequence, SequenceEvent, SequenceContext };
