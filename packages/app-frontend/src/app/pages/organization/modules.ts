import { TModule } from '@holistix-forge/module';
import { ApiFetch } from '@holistix-forge/api-fetch';
import { moduleFrontend as collabFrontend } from '@holistix-forge/collab/frontend';
import { moduleFrontend as reducersFrontend } from '@holistix-forge/reducers/frontend';
import { moduleFrontend as coreFrontend } from '@holistix-forge/core-graph';
import { moduleFrontend as spaceFrontend } from '@holistix-forge/whiteboard/frontend';
import { moduleFrontend as tabsFrontend } from '@holistix-forge/tabs';
import { moduleFrontend as userContainersFrontend } from '@holistix-forge/user-containers/frontend';
import { moduleFrontend as notionFrontend } from '@holistix-forge/notion/frontend';
import { moduleFrontend as airtableFrontend } from '@holistix-forge/airtable/frontend';
//import { moduleFrontend as jupyterFrontend } from '@holistix-forge/jupyter/frontend';
import { moduleFrontend as excalidrawFrontend } from '@holistix-forge/excalidraw/frontend';
import { moduleFrontend as gatewayFrontend } from '@holistix-forge/gateway';
import { moduleFrontend as socialsFrontend } from '@holistix-forge/socials/frontend';
import { moduleFrontend as chatsFrontend } from '@holistix-forge/chats/frontend';

/**
 * Organization-specific module configuration
 */
export type OrganizationModuleConfig = {
  fetch?: ApiFetch; // Gateway fetch function for reducers module
  // Add other organization-specific config here as needed
};

/**
 * Get modules array with organization-specific configuration
 * @param orgConfig - Organization-specific configuration (e.g., fetch function for gateway)
 * @returns Array of modules with merged configuration
 */
export const getModulesFrontend = (
  orgConfig: OrganizationModuleConfig = {}
): { module: TModule<never, object>; config: object }[] => {
  return [
    {
      module: collabFrontend,
      config: {},
    },
    {
      module: reducersFrontend,
      config: {
        ...(orgConfig.fetch && { fetch: orgConfig.fetch }),
      },
    },
    { module: coreFrontend, config: {} },
    { module: spaceFrontend, config: {} },
    { module: tabsFrontend, config: {} },
    { module: userContainersFrontend, config: {} },
    { module: notionFrontend, config: {} },
    { module: airtableFrontend, config: {} },
    //{ module: jupyterFrontend, config: {} },
    { module: excalidrawFrontend, config: {} },
    { module: gatewayFrontend, config: {} },
    { module: socialsFrontend, config: {} },
    { module: chatsFrontend, config: {} },
    { module: tabsFrontend, config: {} },
  ];
};
