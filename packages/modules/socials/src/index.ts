import type { TModule } from '@monorepo/module';
import type { TReducersBackendExports } from '@monorepo/reducers';
import { TCoreSharedData } from '@monorepo/core-graph';
import { TGatewayExports } from '@monorepo/gateway';
import { TCollabBackendExports } from '@monorepo/collab';

import { SocialsReducer } from './lib/socials-reducer';

type TRequired = {
  reducers: TReducersBackendExports;
  collab: TCollabBackendExports<TCoreSharedData>;
  gateway: TGatewayExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'socials',
  version: '0.0.1',
  description: 'Socials module',
  dependencies: ['reducers', 'collab', 'gateway'],
  load: ({ depsExports }) => {
    depsExports.reducers.loadReducers(new SocialsReducer(depsExports));
  },
};

export type { TEventSocials } from './lib/socials-events';
