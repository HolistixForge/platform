import { TModule } from '@monorepo/module';
import { TValidSharedData } from '@monorepo/collab-engine';
import {
  Collab,
  YjsServerCollab,
  YjsServerCollabConfig,
  NoneCollabConfig,
  NoneCollab,
} from './lib/collab';

//

export type TCollabBackendExports<
  TSd extends TValidSharedData = TValidSharedData
> = { collab: Collab<TSd> };

export const moduleBackend: TModule<undefined, TCollabBackendExports> = {
  name: 'collab',
  version: '0.0.1',
  description: 'Collaborative module',
  dependencies: [],
  load: (args) => {
    const config = args.config as YjsServerCollabConfig | NoneCollabConfig;
    const collab =
      config.type === 'yjs-server'
        ? new YjsServerCollab(config)
        : new NoneCollab(config);
    args.moduleExports({ collab });
  },
};

//

export type { TEventUserLeave } from './lib/collab-events';

export { LocalOverrider } from './lib/overrider';
