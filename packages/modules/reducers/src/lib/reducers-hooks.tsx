import { useCallback, useMemo } from 'react';

import { useModuleExports } from '@holistix/module/frontend';

import { TReducersFrontendExports } from '../frontend';
import { TBaseEvent } from '..';
import { FrontendDispatcher } from './dispatchers';
import {
  FrontendEventSequence,
  LocalReduceFunction,
} from './frontendEventSequence';

//

export const useDispatcher = <TE extends TBaseEvent>() => {
  const o = useModuleExports<{
    reducers: TReducersFrontendExports<TE>;
  }>('useDispatcher');
  return o.reducers.dispatcher as FrontendDispatcher<TE>;
};

//

export const useEventSequence = <TEvents extends TBaseEvent>(
  callback: LocalReduceFunction
) => {
  const dispatcher = useDispatcher<TEvents>();

  const localReduce = useCallback(callback, [callback]);

  const es = useMemo(() => {
    return new FrontendEventSequence<TEvents>(
      dispatcher,
      localReduce as LocalReduceFunction
    );
  }, [dispatcher, localReduce]);

  return es;
};
