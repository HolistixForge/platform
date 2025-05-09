import { BackendEventProcessor } from './backendEventProcessor';
import { SharedTypes } from './SharedTypes';
import { TValidSharedData } from './chunk';
import { SharedEditor } from './SharedEditor';
import { BackendEventSequence, SequenceEvent } from './backendEventSequence';
import { TJsonObject } from '@monorepo/simple-types';

//

/**
 *
 */
export type ReduceArgs<
  TSd extends TValidSharedData,
  TRe,
  TDe extends TJsonObject,
  TArgs
> = {
  sd: TSd;
  st: SharedTypes;
  event: TRe;
  sequence?: BackendEventSequence<SequenceEvent>;
  bep: BackendEventProcessor<TDe, TArgs>;
  sharedEditor: SharedEditor;
  extraArgs: TArgs;
};

/**
 *
 */
export abstract class Reducer<
  TSd extends TValidSharedData,
  TRe,
  TDe extends TJsonObject,
  TArgs
> {
  abstract reduce(g: ReduceArgs<TSd, TRe, TDe, TArgs>): Promise<void>;
}
