import { SharedMap, SharedArray, SharedTypes } from '@monorepo/collab-engine';
import { TServer } from './servers-types';
import { TContainerImageInfo } from '@monorepo/module';

export type TServersSharedData = {
  projectServers: SharedMap<TServer>;
  containerImages: SharedArray<TContainerImageInfo>; // Simplified images for frontend
};

export const Servers_loadData = (st: SharedTypes): TServersSharedData => {
  return {
    projectServers: st.getSharedMap('plugin-servers'),
    containerImages: st.getSharedArray('plugin-container-images'),
  };
};
