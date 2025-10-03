import { TModule } from '@monorepo/module';
import { TValidSharedData } from '@monorepo/collab-engine';

export type TCollabExports<TSd = TValidSharedData> = {
  sharedData: TSd;
  loadSharedData: (type: 'map' | 'array', name: string) => void;
};

export const moduleBackend: TModule<undefined, TCollabExports> = {
  name: 'collab',
  version: '0.0.1',
  description: 'Collaborative module',
  dependencies: [],
  load: (args) => {
    args.moduleExports({
      sharedData: {},
      loadSharedData: (type: 'map' | 'array', name: string) => {
        throw new Error('Not implemented');
      },
    });
  },
};

export const moduleFrontend = moduleBackend;
