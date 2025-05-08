import { makeUuid, TJsonObject } from '@monorepo/simple-types';
import { FrontendDispatcher } from './frontendDispatcher';
import { SequenceEvent } from './backendEventSequence';

//

export class FrontendEventSequence<T extends TJsonObject> {
  counter: number = 0;
  sequenceId: string;
  localReduce: (event: any) => TJsonObject;
  dispatcher: FrontendDispatcher<T>;
  _hasError: boolean = false;
  _localOverrides: Map<string, TJsonObject>;

  constructor(
    dispatcher: FrontendDispatcher<T>,
    localReduce: (event: any) => TJsonObject,
    localOverrides: Map<string, TJsonObject>
  ) {
    this.localReduce = localReduce;
    this.sequenceId = makeUuid();
    this.dispatcher = dispatcher;
    this._localOverrides = localOverrides;
  }

  async dispatch(
    event: T & Pick<SequenceEvent, 'sequenceRevertPoint' | 'sequenceEnd'>
  ) {
    if (this._hasError) return;

    const localOverride = this.localReduce(event);
    this._localOverrides.set(this.sequenceId, localOverride);
    this.counter++;

    try {
      await this.dispatcher.dispatch({
        ...event,
        sequenceId: this.sequenceId,
        sequenceCounter: this.counter,
      });
    } catch (error) {
      this._hasError = true;
      throw error;
    }
  }

  cleanup() {
    this._localOverrides.delete(this.sequenceId);
  }
}
