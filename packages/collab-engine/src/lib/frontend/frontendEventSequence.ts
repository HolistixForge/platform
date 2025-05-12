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
  public done: boolean = false;

  private counter: number = 0;
  private sequenceId: string;
  private dispatcher: FrontendDispatcher<T>;
  private hasError: boolean = false;
  private localOverrider: LocalOverrider<TValidSharedData>;

  constructor(
    dispatcher: FrontendDispatcher<T>,
    localReduce: LocalReduceFunction,
    localOverrider: LocalOverrider<TValidSharedData>
  ) {
    this.localReduce = localReduce;
    this.sequenceId = makeUuid();
    this.dispatcher = dispatcher;
    this.localOverrider = localOverrider;
  }

  async dispatch(
    event: T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>
  ) {
    if (this.hasError) return;

    this.localOverrider.apply(this.localReduce, event);

    this.counter++;

    try {
      await this.dispatcher.dispatch({
        ...event,
        sequenceId: this.sequenceId,
        sequenceCounter: this.counter,
      });
    } catch (error) {
      this.hasError = true;
      throw error;
    }
  }

  cleanup() {
    this.done = true;
  }
}
