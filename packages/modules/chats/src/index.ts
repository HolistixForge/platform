import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';

import { ChatReducer } from './lib/chats-reducer';

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'chats',
  version: '0.0.1',
  description: 'Chats module',
  dependencies: ['core-graph', 'collab', 'reducers'],
  load: ({ depsExports }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData('map', 'chats', 'chats');
    depsExports.reducers.loadReducers(new ChatReducer(depsExports));
  },
};

export type { TChatSharedData } from './lib/chats-shared-model';

export type { TChatEvent } from './lib/chats-events';
