import { TUserContainer } from './servers-types';

export type ContainerRunner = {
  start: (container: TUserContainer) => Promise<void>;
};
