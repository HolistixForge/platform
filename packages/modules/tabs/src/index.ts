import { TabsReducer } from './lib/tabs-reducer';
import type { TModule } from '@monorepo/module';
import type { TCollabBackendExports } from '@monorepo/collab';
import type { TCollabFrontendExports } from '@monorepo/collab/frontend';
import type { TReducersBackendExports } from '@monorepo/reducers';
import type { TTabsSharedData } from './lib/tabs-shared-model';
import type { TCoreSharedData } from '@monorepo/core-graph';

type TBackendRequired = {
  collab: TCollabBackendExports<TTabsSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
};

export const moduleBackend: TModule<TBackendRequired> = {
  name: 'tabs',
  version: '0.0.1',
  description: 'Tabs module',
  dependencies: ['core-graph', 'collab', 'reducers'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'tabs', 'tabs');
    depsExports.reducers.loadReducers(new TabsReducer());
  },
};

type TFrontendRequired = {
  collab: TCollabFrontendExports;
};

export const moduleFrontend: TModule<TFrontendRequired> = {
  name: 'tabs',
  version: '0.0.1',
  description: 'Tabs module',
  dependencies: ['collab'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'tabs', 'tabs');
  },
};

export type { TTabEvents } from './lib/tabs-event';

export type { TTabsSharedData } from './lib/tabs-shared-model';
export { MAX_TAB_ROW } from './lib/tabs-types';
export type { TabPayload, TabPath } from './lib/tabs-types';

export { ReadOnlyTree } from './lib/tree';
export type { TreeElement } from './lib/tree';

export { TabsRadix } from './lib/components/tabs-radix';
export type { PanelProps } from './lib/components/tabs-radix';

export type { TTabsTree } from './lib/tabs-types';
