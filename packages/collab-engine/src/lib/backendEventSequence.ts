export type SequenceEvent = {
  sequenceId: string;
  sequenceCounter: number;
  sequenceRevertPoint?: boolean;
  sequenceEnd?: boolean;
};

//

export class BackendEventSequence<T extends SequenceEvent> {
  sequenceId: string;
  counter: number = 0;
  _hasError: boolean = false;
  _events: T[] = [];
  _revert: (() => void) | null = null;

  constructor(sequenceId: string) {
    this.sequenceId = sequenceId;
  }

  isFailed() {
    return this._hasError;
  }

  setFailed() {
    this._hasError = true;
  }

  addEvent(event: T): boolean {
    if (this.counter < event.sequenceCounter) {
      this.counter = event.sequenceCounter;
      this._events.push(event);
      return true;
    }
    return false;
  }

  setRevert(revert: () => void) {
    this._revert = revert;
  }
}
