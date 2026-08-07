import { TModule } from '@holistix-forge/module';

// Import all frontend modules
import { moduleFrontend as collabFrontend } from '@holistix-forge/collab/frontend';
import { moduleFrontend as reducersFrontend } from '@holistix-forge/reducers/frontend';
import { moduleFrontend as coreFrontend } from '@holistix-forge/core-graph';
import { moduleFrontend as spaceFrontend } from '@holistix-forge/whiteboard/frontend';
import { moduleFrontend as tabsFrontend } from '@holistix-forge/tabs/frontend';
import { moduleFrontend as userContainersFrontend } from '@holistix-forge/user-containers/frontend';
import { moduleFrontend as notionFrontend } from '@holistix-forge/notion/frontend';
import { moduleFrontend as airtableFrontend } from '@holistix-forge/airtable/frontend';
import { moduleFrontend as excalidrawFrontend } from '@holistix-forge/excalidraw/frontend';
import { moduleFrontend as gatewayFrontend } from '@holistix-forge/gateway';
import { moduleFrontend as socialsFrontend } from '@holistix-forge/socials/frontend';
import { moduleFrontend as chatsFrontend } from '@holistix-forge/chats/frontend';
import { moduleFrontend as vscodeFrontend } from '@holistix-forge/vscode/frontend';
import { moduleFrontend as jupyterFrontend } from '@holistix-forge/jupyter/frontend';

/**
 * Get all frontend modules
 *
 * This is a simple list of all modules used by the application.
 * The actual configuration is done by frontend-data's createModuleConfigs().
 *
 * Modules are listed with configKey to indicate which config to apply:
 * - 'collab': Multi-project registry config
 * - 'reducers': Gateway fetch config
 * - undefined: Empty config
 *
 * @returns Array of modules with config keys
 */
const ALL_MODULES: {
  module: TModule<never, object>;
  configKey?: 'collab' | 'reducers' | 'user-containers';
}[] = [
  // Collab module - needs multi-project registry config
  { module: collabFrontend, configKey: 'collab' },

  // Reducers module - needs gateway fetch config
  { module: reducersFrontend, configKey: 'reducers' },

  // Core modules - no special config
  { module: coreFrontend },
  { module: spaceFrontend },
  { module: tabsFrontend },

  // Feature modules - no special config
  { module: userContainersFrontend, configKey: 'user-containers' },
  { module: notionFrontend },
  { module: airtableFrontend },
  { module: excalidrawFrontend },
  { module: gatewayFrontend },
  { module: socialsFrontend },
  { module: chatsFrontend },
  { module: vscodeFrontend },
  // Loaded by the gateway since it existed, and never here — only its
  // stylesheet was imported, in main.tsx. So `registerNodes` never ran and the
  // whiteboard had no component for `jupyter-terminal`: a terminal pulled out
  // of a notebook's card appeared as a node rendering its own payload,
  // `{ "user_container_id": …, "terminal_id": "2" }`, with no error anywhere.
  // `registerMenuEntries` never ran either, so the menu that offers "New
  // Terminal" had no jupyter entry to show in the first place.
  { module: jupyterFrontend },
];

export function getAllModules(): {
  module: TModule<never, object>;
  configKey?: 'collab' | 'reducers' | 'user-containers';
}[] {
  // The same array every time, on purpose: callers pass this straight into a
  // render and a fresh array would invalidate the memo that loads the modules.
  return ALL_MODULES;
}
