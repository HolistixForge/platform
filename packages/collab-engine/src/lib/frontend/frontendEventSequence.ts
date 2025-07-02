import * as _ from 'lodash';

import { makeUuid, TJsonObject } from '@monorepo/simple-types';
import { FrontendDispatcher } from './frontendDispatcher';
import { SequenceEvent } from '../backendEventSequence';
import { LocalOverrider } from './localOverrider';
import { TValidSharedData } from '../chunk';

//

export type LocalReduceFunction = (sdc: any, event: any) => void;

//

export class FrontendEventSequence<T extends TJsonObject> {
  public localReduce: LocalReduceFunction;
  public localReduceUpdateKeys: string[];
  public lastEvent:
    | (T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>)
    | undefined;
  public hasError = false;

  private counter = 0;
  private sequenceId: string;
  private dispatcher: FrontendDispatcher<T>;
  private localOverrider: LocalOverrider<TValidSharedData>;
  private debouncedDispatch: _.DebouncedFunc<
    (
      event: T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>
    ) => void
  >;

  constructor(
    dispatcher: FrontendDispatcher<T>,
    localReduce: LocalReduceFunction,
    localOverrider: LocalOverrider<TValidSharedData>,
    localReduceUpdateKeys: string[]
  ) {
    this.localReduce = localReduce;
    this.sequenceId = makeUuid();
    this.dispatcher = dispatcher;
    this.localOverrider = localOverrider;
    this.localReduceUpdateKeys = localReduceUpdateKeys;
    this.localOverrider.registerFrontendEventSequence(this);

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
    this.localOverrider.apply(this);
    this.debouncedDispatch(event);
  }

  cleanup() {
    // TODO: bof ! to avoid node jumpinf after sequence end due to shared state push from backend
    setTimeout(() => {
      this.localOverrider.unregisterFrontendEventSequence(this);
    }, 2000);
  }
}
