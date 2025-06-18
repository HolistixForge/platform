import { Tabs_loadData } from './lib/tabs-shared-model';
import { TabsReducer } from './lib/tabs-reducer';
import type { ModuleBackend } from '@monorepo/module';
import { ModuleFrontend } from '@monorepo/module/frontend';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'tabs',
    loadSharedData: Tabs_loadData,
    loadReducers: (sd) => [new TabsReducer()],
  },
};

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'tabs',
    loadSharedData: Tabs_loadData,
    deps: [],
  },
  spaceMenuEntries: () => [],
  nodes: {},
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
