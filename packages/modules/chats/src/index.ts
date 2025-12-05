import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';
import type { TReducersBackendExports } from '@holistix-forge/reducers';
import type { TCoreSharedData } from '@holistix-forge/core-graph';
import { TWhiteboardSharedData } from '@holistix-forge/whiteboard';

import { ChatReducer } from './lib/chats-reducer';
import type { TChatSharedData } from './lib/chats-shared-model';

type TRequired = {
  collab: TCollabBackendExports<
    TChatSharedData & TCoreSharedData & TWhiteboardSharedData
  >;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TRequired> = {
  name: 'chats',
  version: '0.0.1',
  description: 'Chats module',
  dependencies: ['core-graph', 'collab', 'reducers'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'chats', 'chats');
    depsExports.reducers.loadReducers(new ChatReducer(depsExports));
  },
};

export type { TChatSharedData } from './lib/chats-shared-model';

export type { TChatEvent } from './lib/chats-events';
