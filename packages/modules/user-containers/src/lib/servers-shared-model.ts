import { SharedMap } from '@holistix-forge/collab-engine';
import { TUserContainer, TContainerRunnerInfo } from './servers-types';
import { TContainerImageInfo } from './container-image';

export type TUserContainersSharedData = {
  'user-containers:containers': SharedMap<TUserContainer>;
  'user-containers:images': SharedMap<TContainerImageInfo>; // Simplified images for frontend
  'user-containers:runners': SharedMap<TContainerRunnerInfo>; // Runners this gateway offers
};
