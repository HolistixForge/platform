import { TModule } from '@monorepo/module';
import { TBaseEvent } from '.';
import { FrontendDispatcher } from './lib/dispatchers';
import { ApiFetch } from '@monorepo/api-fetch';

export type TReducersFrontendExports<TE extends TBaseEvent = TBaseEvent> = {
  dispatcher: FrontendDispatcher<TE>;
};

export type TReducersFrontendConfig = {
  fetch?: ApiFetch; // Gateway fetch function from config
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
    const dispatcher = new FrontendDispatcher();

    // Set fetch from config if provided
    const config = args.config as TReducersFrontendConfig;
    if (config.fetch) {
      dispatcher.setFetch(config.fetch);
    }

    args.moduleExports({
      dispatcher,
    });
  },
};

//

export { useDispatcher, useEventSequence } from './lib/reducers-hooks';
export { FrontendEventSequence } from './lib/frontendEventSequence';
export { FrontendDispatcher } from './lib/dispatchers';

export { linkDispatchToProcessEvent } from './lib/story-utils';
