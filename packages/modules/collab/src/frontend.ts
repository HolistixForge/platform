import { TModule } from '@holistix-forge/module';
import { LocalOverrider } from './lib/overrider';
import { TValidSharedData } from '@holistix-forge/collab-engine';
import { Collab } from './lib/collab';
import { YjsClientCollabConfig } from './lib/collab';
import { NoneCollabConfig } from './lib/collab';
import { YjsClientCollab } from './lib/collab';
import { NoneCollab } from './lib/collab';

//

export type TCollabFrontendExports<
  TSd extends TValidSharedData = TValidSharedData
> = {
  collab: Collab<TSd>;
  localOverrider: LocalOverrider<TValidSharedData>;
};

export const moduleFrontend: TModule<undefined, TCollabFrontendExports> = {
  name: 'collab',
  version: '0.0.1',
  description: 'Collaborative module',
  dependencies: [],
  load: (args) => {
    const config = args.config as YjsClientCollabConfig | NoneCollabConfig;
    const collab =
      config.type === 'yjs-client'
        ? new YjsClientCollab(config)
        : new NoneCollab(config);
    args.moduleExports({
      collab,
      localOverrider: new LocalOverrider(collab.sharedData),
    });
  },
};

//

export {
  useLocalSharedData,
  useLocalSharedDataManager,
  useAwareness,
  useAwarenessUserList,
  useAwarenessSelections,
  useBindEditor,
  useSharedDataDirect,
} from './lib/collab-hooks';

export type {
  TOverrideFunction,
  TValidSharedDataToCopy,
} from './lib/overrider';
