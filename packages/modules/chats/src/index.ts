import { ChatReducer } from './lib/chats-reducer';
import type { TModule } from '@monorepo/module';
import type { TCollabBackendExports } from '@monorepo/collab';
import type { TReducersBackendExports } from '@monorepo/reducers';
import type { TChatSharedData } from './lib/chats-shared-model';
import type { TCoreSharedData } from '@monorepo/core-graph';

type TRequired = {
  collab: TCollabBackendExports<TChatSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'chats',
  version: '0.0.1',
  description: 'Chats module',
  dependencies: ['core-graph', 'collab', 'reducers'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'chats', 'chats');
    depsExports.reducers.loadReducers(new ChatReducer());
  },
};

export type { TChatSharedData } from './lib/chats-shared-model';

export type { TChatEvent } from './lib/chats-events';
