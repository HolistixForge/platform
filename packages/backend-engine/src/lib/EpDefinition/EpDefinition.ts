import { DeepReadonly } from 'ts-essentials';
import { EpDefinitionException } from '../Exceptions/Exception';
import { TConditions } from '../Executor/conditions';
import { TCookie } from '../Response/Response';
import { TJson } from '@monorepo/simple-types';

export type TStep = DeepReadonly<{
  disabled?: boolean;
  description?: string;
  if?: TConditions;
  type: string;
  args: TJson;
  graft?: string;
  cookies?: TCookie[];
}>;

export type TPipeline = DeepReadonly<{
  steps: Array<TStep>;
}>;

type TExecutionPipelineDefinition = {
  $schema: string;
  pipelines: { [id: string]: TPipeline };
};

//
//
//
//

export class EpDefinition {
  _definition: DeepReadonly<TExecutionPipelineDefinition>;

  constructor(oas: DeepReadonly<TExecutionPipelineDefinition>) {
    this._definition = oas;
  }

  getPipeline(id: string): TPipeline {
    const p = this._definition.pipelines[id];
    if (!p)
      throw new EpDefinitionException(`no such execution pipeline [${id}]`);
    return p;
  }
}
