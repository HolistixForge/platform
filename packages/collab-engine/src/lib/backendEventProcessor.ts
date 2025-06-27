import { log } from '@monorepo/log';
import { Reducer } from './reducer';
import { SharedTypes } from './SharedTypes';
import { TValidSharedData } from './chunk';
import { TJsonWithDate } from '@monorepo/simple-types';
import { SharedEditor } from './SharedEditor';
import { BackendEventSequence, SequenceEvent } from './backendEventSequence';
import { TEventPeriodic } from './events';

type ValidReducer<Targs> = Reducer<
  TValidSharedData,
  any,
  any,
  Partial<Targs>,
  any
>;

//

export class BackendEventProcessor<TE extends TJsonWithDate, Targs> {
  _sharedTypes: SharedTypes = null!;
  _sharedData: TValidSharedData = null!;
  _reducers: Array<ValidReducer<Targs>> = [];
  _dispatcherExtraArgs: Partial<Targs> = null!;
  _yjsSharedEditor: SharedEditor | undefined;
  _extraContext: any = null!;
  // TODO: remove old sequence context from map
  _eventSequences: Map<string, BackendEventSequence<SequenceEvent>> = new Map();

  //

  bindData(
    sharedTypes: SharedTypes,
    yse: SharedEditor,
    sharedData: TValidSharedData,
    extraArgs: Partial<Targs>,
    extraContext: any
  ) {
    this._sharedData = sharedData;
    this._yjsSharedEditor = yse;
    this._sharedTypes = sharedTypes;
    this._dispatcherExtraArgs = extraArgs;
    this._extraContext = extraContext;

    const interval = 5000;
    setInterval(() => {
      try {
        const e: TEventPeriodic = { type: 'periodic', interval, date: new Date() }
        this.process(e as any);
      } catch (err) {
        console.log(err);
      }
    }, interval);
  }

  //

  sanity() {
    if (!this._sharedTypes || !this._sharedData || !this._yjsSharedEditor) {
      throw new Error('BackendEventProcessor not bound');
    }
  }

  //

  addReducer(r: ValidReducer<Targs>) {
    this._reducers.push(r);
  }

  //

  async process(
    event: TE & Partial<SequenceEvent>,
    eventExtraArgs?: Partial<Targs>
  ): Promise<void> {
    this.sanity();

    let sequence: BackendEventSequence<SequenceEvent> | undefined;

    // retreive or create sequence object if necessary
    if (event.sequenceId) {
      sequence = this._eventSequences.get(event.sequenceId);
      if (!sequence) {
        sequence = new BackendEventSequence(event.sequenceId);
        this._eventSequences.set(event.sequenceId, sequence);
      }
    }

    // Handle sequence logic
    if (sequence) {
      // Skip if sequence had error or counter is lower than a previous event
      // except if it is the first event (sequenceRevertPoint), reducersneed to set the revert point
      // no need to check for sequence ended, because counter logic covers it (last event in sequence has the higher counter)
      const b = sequence.addEvent(event as SequenceEvent);
      if (!event.sequenceRevertPoint && (sequence.isFailed() || !b)) {
        log(
          6,
          'SKIP_SEQUENCE_EVENT',
          `[${event.sequenceId}, ${event.sequenceCounter}]`
        );
        return;
      }
    }

    log(7, 'PROCESS_EVENT', '', event);
    try {
      await this._sharedTypes.transaction(async () => {
        for (let i = 0; i < this._reducers.length; i++) {
          await this._reducers[i].reduce({
            sd: this._sharedData,
            st: this._sharedTypes,
            event,
            sequence,
            bep: this,
            sharedEditor: this._yjsSharedEditor!,
            extraArgs: {
              ...this._dispatcherExtraArgs,
              ...eventExtraArgs,
            },
            extraContext: this._extraContext,
          });
        }
      });
    } catch (error) {
      // Mark sequence as failed if there's an error
      if (sequence) sequence.setFailed();
      throw error; // Re-throw to let caller handle the error
    }
  }

  //

  async batch(events: TE[]): Promise<void> {
    this.sanity();
    for (let i = 0; i < events.length; i++)
      await this.process(events[i] as TE & Partial<SequenceEvent>);
  }
}
