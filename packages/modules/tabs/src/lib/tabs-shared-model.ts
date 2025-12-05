import { SharedMap } from '@holistix-forge/collab-engine';
import { TTabsTree } from './tabs-types';

export type TTabsSharedData = {
  'tabs:tabs': SharedMap<TTabsTree>;
};
