import { SocialsReducer } from './lib/socials-reducer';
import type { TModule } from '@monorepo/module';
import type { TReducersBackendExports } from '@monorepo/reducers';

type TRequired = {
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'socials',
  version: '0.0.1',
  description: 'Socials module',
  dependencies: ['reducers'],
  load: ({ depsExports }) => {
    depsExports.reducers.loadReducers(new SocialsReducer());
  },
};

export type { TEventSocials } from './lib/socials-events';
