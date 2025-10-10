import { log } from '@monorepo/log';
import { BackendEventSequence, SequenceEvent } from './backendEventSequence';
import { Reducer, RequestData, TBaseEvent } from '..';

//

export type TEventPeriodic = {
  type: 'periodic';
  date: Date;
  interval: number;
};

//

const internalRequestData: RequestData = {
  ip: 'gateway',
  user_id: 'gateway',
  jwt: {},
  headers: {},
};

//

export class BackendEventProcessor<TE extends TBaseEvent> {
  _reducers: Array<Reducer<TE>> = [];
  // TODO: remove old sequence context from map
  _eventSequences: Map<string, BackendEventSequence<SequenceEvent>> = new Map();

  //

  constructor() {
    const interval = 5000;
    setInterval(() => {
      try {
        const e: TEventPeriodic = {
          type: 'periodic',
          interval,
          date: new Date(),
        };
        this.processEvent(e as unknown as TE, internalRequestData);
      } catch (err) {
        console.log(err);
      }
    }, interval);
  }

  //

  addReducer(r: Reducer<TE>) {
    this._reducers.push(r);
  }

  //

  async processEvent(
    event: TE & Partial<SequenceEvent>,
    requestData: RequestData
  ): Promise<void> {
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
      for (let i = 0; i < this._reducers.length; i++) {
        await this._reducers[i].reduce(event, requestData);
      }
    } catch (error) {
      // Mark sequence as failed if there's an error
      if (sequence) sequence.setFailed();
      throw error; // Re-throw to let caller handle the error
    }
  }

  //

  async batch(events: TE[]): Promise<void> {
    for (let i = 0; i < events.length; i++)
      await this.processEvent(
        events[i] as TE & Partial<SequenceEvent>,
        internalRequestData
      );
  }
}
