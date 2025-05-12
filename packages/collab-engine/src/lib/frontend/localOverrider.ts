import { TJson } from '@monorepo/simple-types';
import { TValidSharedData } from '../chunk';
import { LocalReduceFunction } from './frontendEventSequence';
import { SharedMap, SharedArray } from '../SharedTypes';

//

export type TSharedDataCopy = {
  [key: string]: Array<TJson> | Map<string, TJson>;
};

export type TValidSharedDataToCopy<TSharedData extends TValidSharedData> = {
  [K in keyof TSharedData]: TSharedData[K] extends SharedMap<infer T>
    ? Readonly<Map<string, Readonly<T>>>
    : TSharedData[K] extends SharedArray<infer T>
    ? Readonly<Array<Readonly<T>>>
    : never;
};

//

export abstract class SharedDataManager<TSharedData extends TValidSharedData> {
  abstract getData(): TValidSharedDataToCopy<TSharedData>;
  abstract observe(keys: Array<keyof TSharedData>, observer: () => void): void;
  abstract unobserve(
    keys: Array<keyof TSharedData>,
    observer: () => void
  ): void;
}

//

export class LocalOverrider<
  TSharedData extends TValidSharedData
> extends SharedDataManager<TSharedData> {
  //
  private sharedData: TValidSharedData;

  private observers: Record<keyof TSharedData, (() => void)[]> = {} as any;

  private sharedDataCopy: TSharedDataCopy = {};

  constructor(sharedData: TValidSharedData) {
    super();
    this.sharedData = sharedData;
    for (const key in this.sharedData) {
      this.sharedData[key].observe(() => this.update(key as string));
      // set initial value
      this.update(key as string);
    }
  }

  apply(localReduce: LocalReduceFunction, event: any) {
    console.log('APPLY', { sharedData: this.sharedData, event });
  }

  observe(keys: Array<keyof TSharedData>, observer: () => void) {
    keys.forEach((key) => {
      if (!this.observers[key]) this.observers[key] = [];
      this.observers[key].push(observer);
    });
  }

  unobserve(keys: Array<keyof TSharedData>, observer: () => void) {
    keys.forEach((key) => {
      this.observers[key] = this.observers[key].filter((o) => o !== observer);
    });
  }

  private update(key: string) {
    this.sharedDataCopy[key] = this.sharedData[key].copy();
    this.observers[key]?.forEach((observer) => observer());
  }

  getData(): TValidSharedDataToCopy<TSharedData> {
    return this.sharedDataCopy as any;
  }
}
