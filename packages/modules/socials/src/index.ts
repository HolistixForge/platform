import type { TModule } from '@holistix-forge/module';
import type { TReducersBackendExports } from '@holistix-forge/reducers';
import { TCoreSharedData } from '@holistix-forge/core-graph';
import { TGatewayExports } from '@holistix-forge/gateway';
import { TCollabBackendExports } from '@holistix-forge/collab';

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
