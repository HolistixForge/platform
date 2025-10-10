import { TJson } from '@monorepo/simple-types';
import {
  TValidSharedData,
  SharedMap,
  SharedArray,
} from '@monorepo/collab-engine';

//

export type TLocalSharedData = {
  [key: string]: Array<TJson> | Map<string, TJson>;
};

export type TValidSharedDataToCopy<TSharedData extends TValidSharedData> = {
  [K in keyof TSharedData]: TSharedData[K] extends SharedMap<infer T>
    ? Readonly<Map<string, Readonly<T>>>
    : TSharedData[K] extends SharedArray<infer T>
    ? Readonly<Array<Readonly<T>>>
    : never;
};

export type TOverrideFunction<T = TLocalSharedData> = {
  keys: Array<keyof T>;
  apply: (localSharedData: T) => void;
};

//

export class LocalOverrider<
  TSharedData extends TValidSharedData = TValidSharedData
> {
  //
  private sharedData: TSharedData;

  private observers: Partial<Record<keyof TSharedData, (() => void)[]>> = {};

  private localSharedData: TLocalSharedData = {};

  private ofs: Map<
    string,
    TOverrideFunction<TValidSharedDataToCopy<TSharedData>>[]
  > = new Map();

  private sdObservers: Map<string, () => void> = new Map();

  constructor(sharedData: TSharedData) {
    this.sharedData = sharedData;
  }

  //

  public registerOverrideFunction(
    of: TOverrideFunction<TValidSharedDataToCopy<TSharedData>>
  ) {
    of.keys.forEach((key) => {
      const sequences = this.ofs.get(key as string) || [];
      sequences.push(of);
      this.ofs.set(key as string, sequences);
    });
  }

  public unregisterOverrideFunction(
    of: TOverrideFunction<TValidSharedDataToCopy<TSharedData>>
  ) {
    of.keys.forEach((key) => {
      const sequences = this.ofs.get(key as string) || [];
      this.ofs.set(
        key as string,
        sequences.filter((s) => s !== of)
      );
    });
  }

  public apply(of: TOverrideFunction<TValidSharedDataToCopy<TSharedData>>) {
    of.apply(this.localSharedData as TValidSharedDataToCopy<TSharedData>);
    of.keys.forEach((key) => this.callKeyObservers(key as string));
  }

  //

  public observe(keys: Array<keyof TSharedData>, observer: () => void) {
    keys.forEach((key) => {
      if (!this.sdObservers.has(key as string)) {
        const sdObserver = () => this.update(key as string);
        this.sdObservers.set(key as string, sdObserver);
        this.sharedData[key].observe(sdObserver);
        sdObserver();
      }
      if (!this.observers[key]) this.observers[key] = [];
      this.observers[key].push(observer);
    });
  }

  public unobserve(keys: Array<keyof TSharedData>, observer: () => void) {
    keys.forEach((key) => {
      this.observers[key] = this.observers[key]?.filter((o) => o !== observer);
      if (this.observers[key]?.length === 0) {
        this.sharedData[key].unobserve(this.sdObservers.get(key as string));
        this.sdObservers.delete(key as string);
      }
    });
  }

  private callKeyObservers(key: string) {
    this.observers[key]?.forEach((observer) => observer());
  }

  //

  private update(key: string) {
    this.localSharedData[key] = this.sharedData[key].copy();
    this.ofs.get(key)?.forEach((of) => {
      of.apply(this.localSharedData as TValidSharedDataToCopy<TSharedData>);
    });
    this.callKeyObservers(key);
  }

  public getData(): TValidSharedDataToCopy<TSharedData> {
    return this.localSharedData as TValidSharedDataToCopy<TSharedData>;
  }
}
