import './lib/index.scss';
import { NodeServer } from './lib/components/node-server/node-server';
import type { TModule } from '@holistix-forge/module';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';
import type { TWhiteboardFrontendExports } from '@holistix-forge/whiteboard/frontend';
import { serversMenuEntries } from './lib/servers-menu';
import { localRunnerFrontend } from './lib/local-runner-frontend';
import { platformRunnerFrontend } from './lib/platform-runner-frontend';
import { TUserContainer } from './lib/servers-types';

//

export type TContainerRunnerFrontend = {
  icon: React.FC;
  label: string;
  UI: React.FC;
};

export type TUserContainersFrontendExports = {
  getToken: (
    userContainer: TUserContainer,
    serviceName: string
  ) => Promise<string>;
  registerContainerRunner: (
    id: string,
    containerRunner: TContainerRunnerFrontend
  ) => void;
  getRunners: () => Map<string, TContainerRunnerFrontend>;
};

type TRequired = {
  collab: TCollabFrontendExports;
  whiteboard: TWhiteboardFrontendExports;
};

/**
 * What this module is given by the application.
 *
 * `getAccessToken` is the signed-in user's own token. It is what the browser
 * presents to a container's auth guard when it has no session for that
 * container yet — a terminal node on the whiteboard has never opened one.
 */
type TConfig = {
  getAccessToken?: () => string;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'user-containers',
  version: '0.0.1',
  description: 'User containers module',
  dependencies: ['core-graph', 'collab', 'whiteboard', 'tabs'],
  load: ({ depsExports, moduleExports, config }) => {
    // Register shared data schema with registry
    depsExports.collab.registry.registerSharedData(
      'map',
      'user-containers',
      'containers'
    );
    depsExports.collab.registry.registerSharedData(
      'map',
      'user-containers',
      'images'
    );
    depsExports.collab.registry.registerSharedData(
      'map',
      'user-containers',
      'runners'
    );
    depsExports.collab.registry.registerSharedData(
      'map',
      'user-containers',
      'machines'
    );

    depsExports.whiteboard.registerMenuEntries(serversMenuEntries);
    depsExports.whiteboard.registerNodes({
      'user-container': NodeServer,
    });

    const containerRunners: Map<string, TContainerRunnerFrontend> = new Map();

    const registerContainerRunner: (
      id: string,
      containerRunner: TContainerRunnerFrontend
    ) => void = (id, containerRunner) => {
      containerRunners.set(id, containerRunner);
    };

    registerContainerRunner('local', localRunnerFrontend);
    // Registered unconditionally; `useRunnerFrontend` intersects this with the
    // set the gateway publishes, so it only surfaces where a broker exists.
    registerContainerRunner('platform', platformRunnerFrontend);

    const exports: TUserContainersFrontendExports = {
      /**
       * What the browser presents to a service. Nothing, deliberately.
       *
       * A container sits behind its auth guard, which authenticates the browser
       * by session cookie and asks the gateway whether this user may reach this
       * container — per user, on every request. The token that actually opens
       * the service is added by the guard on the way through and never leaves
       * the container's side.
       *
       * Returning a real token here would hand the notebook's whole API to
       * whoever holds the page, undoing that check one layer up. So the caller
       * gets an empty string and relies on its request carrying credentials —
       * `serverSettings.init.credentials = 'include'`, because the platform's
       * page and the container are different origins.
       *
       * The service is still looked up, so asking for one that does not exist
       * fails here rather than as a puzzling 404 later.
       */
      getToken: async (userContainer, serviceName) => {
        const service = userContainer.httpServices.find(
          (s) => s.name === serviceName
        );
        if (!service) {
          throw new Error(`Service ${serviceName} not found`);
        }
        return (config as TConfig)?.getAccessToken?.() ?? '';
      },
      registerContainerRunner,
      getRunners: () => containerRunners,
    };

    moduleExports(exports);
  },
};

export { StatusLed } from './lib/components/status-led';
export { UserContainerCardInternal } from './lib/components/server-card';
export { ServerCard } from './lib/components/node-server/node-server';
export { NewContainerForm } from './lib/form/new-server';
