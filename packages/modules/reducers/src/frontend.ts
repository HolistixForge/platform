import { TModule } from '@monorepo/module';
import { TBaseEvent } from '.';
import { FrontendDispatcher } from './lib/dispatchers';

export type TReducersFrontendExports<TE extends TBaseEvent = TBaseEvent> = {
  dispatcher: FrontendDispatcher<TE>;
};

export const moduleFrontend: TModule<
  undefined,
  TReducersFrontendExports<never>
> = {
  name: 'reducers',
  version: '0.0.1',
  description: 'Reducers module',
  dependencies: [],
  load: (args) => {
    args.moduleExports({
      dispatcher: new FrontendDispatcher(),
    });
  },
};

//

export { useDispatcher, useEventSequence } from './lib/reducers-hooks';
export { FrontendEventSequence } from './lib/frontendEventSequence';
export { FrontendDispatcher } from './lib/dispatchers';

export { linkDispatchToProcessEvent } from './lib/story-utils';
