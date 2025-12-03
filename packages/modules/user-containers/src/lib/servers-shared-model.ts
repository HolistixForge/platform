import { SharedMap } from '@holistix/collab-engine';
import { TUserContainer } from './servers-types';
import { TContainerImageInfo } from './container-image';

export type TUserContainersSharedData = {
  'user-containers:containers': SharedMap<TUserContainer>;
  'user-containers:images': SharedMap<TContainerImageInfo>; // Simplified images for frontend
};
