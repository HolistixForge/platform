import { TModule } from '@holistix-forge/module';
import { ApiFetch } from '@holistix-forge/api-fetch';
import { moduleFrontend as collabFrontend } from '@holistix-forge/collab/frontend';
import { moduleFrontend as reducersFrontend } from '@holistix-forge/reducers/frontend';
import { moduleFrontend as coreFrontend } from '@holistix-forge/core-graph';
import { moduleFrontend as spaceFrontend } from '@holistix-forge/whiteboard/frontend';
import { moduleFrontend as tabsFrontend } from '@holistix-forge/tabs/frontend';
import { moduleFrontend as userContainersFrontend } from '@holistix-forge/user-containers/frontend';
import { moduleFrontend as notionFrontend } from '@holistix-forge/notion/frontend';
import { moduleFrontend as airtableFrontend } from '@holistix-forge/airtable/frontend';
//import { moduleFrontend as jupyterFrontend } from '@holistix-forge/jupyter/frontend';
import { moduleFrontend as excalidrawFrontend } from '@holistix-forge/excalidraw/frontend';
import { moduleFrontend as gatewayFrontend } from '@holistix-forge/gateway';
import { moduleFrontend as socialsFrontend } from '@holistix-forge/socials/frontend';
import { moduleFrontend as chatsFrontend } from '@holistix-forge/chats/frontend';
import type { GanymedeApi } from '@holistix-forge/frontend-data';
import type { TAwarenessUser } from '@holistix-forge/collab-engine';

type YjsClientCollabConfig = {
  type: 'yjs-client';
  room_id: string;
  ws_server: string;
  token: {
    get: () => string;
    refresh: () => void;
  };
  user: TAwarenessUser;
};

/**
 * Organization-specific module configuration
 */
export type OrganizationModuleConfig = {
  fetch?: ApiFetch; // Gateway fetch function for reducers module
  gateway_hostname?: string; // Gateway hostname for WebSocket
  project_id?: string; // Project ID for WebSocket connection
  ganymedeApi?: GanymedeApi; // API client for token management
};

/**
 * Get modules array with organization-specific configuration
 * @param orgConfig - Organization-specific configuration (e.g., fetch function for gateway)
 * @returns Array of modules with merged configuration
 */
export const getModulesFrontend = (
  orgConfig: OrganizationModuleConfig = {}
): { module: TModule<never, object>; config: object }[] => {
  // Prepare collab config if we have all required data
  let collabConfig: YjsClientCollabConfig | Record<string, never> = {};

  if (
    orgConfig.gateway_hostname &&
    orgConfig.project_id &&
    orgConfig.ganymedeApi
  ) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${orgConfig.gateway_hostname}/project/${orgConfig.project_id}`;

    collabConfig = {
      type: 'yjs-client',
      ws_server: wsUrl,
      room_id: orgConfig.project_id, // Use project_id as room identifier for now
      token: {
        get: () => {
          // Get the access token from GanymedeApi
          return orgConfig.ganymedeApi!.getAccessToken();
        },
        refresh: () => {
          // Trigger token refresh
          orgConfig.ganymedeApi!.refreshAccessToken();
        },
      },
      user: {
        color: '#4A90E2',
        username: 'User',
        user_id: 'user_id',
      },
    };
  }

  return [
    {
      module: collabFrontend,
      config: collabConfig,
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
  ];
};
