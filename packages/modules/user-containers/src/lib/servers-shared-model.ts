import { SharedMap, SharedArray } from '@monorepo/collab-engine';
import { TServer } from './servers-types';
import { TContainerImageInfo } from './container-image';

export type TServersSharedData = {
  'user-containers:containers': SharedMap<TServer>;
  'user-containers:images': SharedArray<TContainerImageInfo>; // Simplified images for frontend
};
