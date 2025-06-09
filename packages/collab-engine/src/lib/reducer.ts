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
  TArgs,
  TEc
> = {
  sd: TSd;
  st: SharedTypes;
  event: TRe;
  sequence?: BackendEventSequence<SequenceEvent>;
  bep: BackendEventProcessor<TDe, TArgs>;
  sharedEditor: SharedEditor;
  extraArgs: TArgs;
  extraContext: TEc;
};

/**
 *
 */
export abstract class Reducer<
  TSd extends TValidSharedData,
  TRe,
  TDe extends TJsonObject,
  TArgs,
  TEc
> {
  abstract reduce(g: ReduceArgs<TSd, TRe, TDe, TArgs, TEc>): Promise<void>;
}
