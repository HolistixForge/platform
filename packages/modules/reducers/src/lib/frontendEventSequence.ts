import * as _ from 'lodash';

import { makeUuid } from '@monorepo/simple-types';
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
        this.counter++;
        this.dispatcher
          .dispatch({
            ...event,
            sequenceId: this.sequenceId,
            sequenceCounter: this.counter,
          })
          .catch((error) => {
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
    this.lastEvent = event;
    this.localReduce(event);
    this.debouncedDispatch(event);
  }

  cleanup() {
    setTimeout(() => {
      //
    }, 2000);
  }
}
