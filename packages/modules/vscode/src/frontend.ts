import './lib/index.scss';
import type { TModule } from '@holistix-forge/module';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';

//

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type TVscodeFrontendExports = {
  // Module exports - currently empty, will add as needed
};

type TRequired = {
  collab: TCollabFrontendExports;
};

export const moduleFrontend: TModule<TRequired, TVscodeFrontendExports> = {
  name: 'vscode',
  version: '0.0.1',
  description:
    'VS Code container module - provides web-based VS Code environments',
  dependencies: ['core-graph', 'collab', 'user-containers'],
  load: ({ moduleExports }) => {
    // Export module API (empty for now)
    moduleExports({});
  },
};
