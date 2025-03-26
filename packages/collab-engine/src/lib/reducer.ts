import { Dispatcher } from './dispatcher';
import { SharedTypes } from './SharedTypes';
import { TValidSharedData } from './chunk';
import { TJsonObject } from '@monorepo/simple-types';
import { SharedEditor } from './SharedEditor';

//

/**
 *
 */
export type ReduceArgs<TSd extends TValidSharedData, TRe, TDe, TArgs> = {
  sd: TSd;
  st: SharedTypes;
  event: TRe;
  dispatcher: Dispatcher<TDe, TArgs>;
  sharedEditor: SharedEditor;
  extraArgs: TArgs;
};

/**
 *
 */
export abstract class Reducer<TSd extends TValidSharedData, TRe, TDe, TArgs> {
  abstract reduce(g: ReduceArgs<TSd, TRe, TDe, TArgs>): Promise<void>;

  load(sd: TSd, _json: TJsonObject): void {
    // Default implementation does nothing
  }

  save(sd: TSd, _json: TJsonObject): void {
    // Default implementation does nothing
  }
}
