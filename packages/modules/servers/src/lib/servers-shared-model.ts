import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TServer } from './servers-types';

export type TServersSharedData = {
  projectServers: SharedMap<TServer>;
};

export const Servers_loadData = (st: SharedTypes): TServersSharedData => {
  return {
    projectServers: st.getSharedMap('plugin-servers'),
  };
};
