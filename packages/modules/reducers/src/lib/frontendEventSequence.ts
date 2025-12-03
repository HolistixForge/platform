import * as _ from 'lodash';

import { makeUuid } from '@holistix/simple-types';
import { FrontendDispatcher } from './dispatchers';
import { SequenceEvent } from './backendEventSequence';
import { TBaseEvent } from '..';

//

export type LocalReduceFunction<TE = TBaseEvent> = (event: TE) => void;

//

export class FrontendEventSequence<T extends TBaseEvent> {
  public localReduce: LocalReduceFunction<T>;
  public lastEvent:
    | (T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>)
    | undefined;
  public firstEvent:
    | (T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>)
    | undefined;
  public hasError = false;

  private counter = 0;
  private sequenceId: string;
  private dispatcher: FrontendDispatcher<T>;
  private debouncedDispatch: _.DebouncedFunc<
    (
      event: T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>
    ) => void
  >;

  constructor(
    dispatcher: FrontendDispatcher<T>,
    localReduce: LocalReduceFunction<T>
  ) {
    this.localReduce = localReduce;
    this.sequenceId = makeUuid();
    this.dispatcher = dispatcher;

    // Create debounced version of dispatch
    this.debouncedDispatch = _.debounce(
      (
        event: T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>
      ) => {
        this.dispatcher.dispatch(event).catch((error) => {
          this.hasError = true;
          throw error;
        });
      },
      150,
      { maxWait: 150 }
    );
  }

  dispatch(
    event: T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>
  ) {
    if (this.hasError) return;

    if (!this.firstEvent) {
      this.firstEvent = event;
      event.sequenceRevertPoint = true;
    }

    this.lastEvent = event;

    this.counter++;

    const fullEvent = {
      ...event,
      sequenceId: this.sequenceId,
      sequenceCounter: this.counter,
    };

    this.localReduce(fullEvent);

    this.debouncedDispatch(fullEvent);
  }

  reset() {
    this.firstEvent = undefined;
    this.lastEvent = undefined;
    this.hasError = false;
    this.counter = 0;
    this.sequenceId = makeUuid();
  }
}
