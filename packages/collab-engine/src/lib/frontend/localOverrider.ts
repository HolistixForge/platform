import { TValidSharedData } from '../chunk';
import { LocalReduceFunction } from './frontendEventSequence';

export class LocalOverrider {
  private sharedData: TValidSharedData;

  constructor(sharedData: TValidSharedData) {
    this.sharedData = sharedData;
  }

  apply(localReduce: LocalReduceFunction, event: any) {
    console.log('APPLY', { sharedData: this.sharedData, event });
  }
}
