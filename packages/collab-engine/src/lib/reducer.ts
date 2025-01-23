import { TEvent } from './events';
import { Dispatcher } from './dispatcher';
import { SharedTypes } from './SharedTypes';
import { TValidSharedData } from './chunk';

//

/**
 *
 */
export type ReduceArgs<
  TSd extends TValidSharedData,
  TRe extends TEvent,
  TDe extends TEvent,
  TArgs
> = {
  sd: TSd;
  st: SharedTypes;
  event: TRe;
  dispatcher: Dispatcher<TDe, TArgs>;
  extraArgs?: TArgs;
};

/**
 *
 */
export abstract class Reducer<TSd extends TValidSharedData, TRe, TDe, TArgs> {
  abstract reduce(g: ReduceArgs<TSd, TRe, TDe, TArgs>): Promise<void>;
}
