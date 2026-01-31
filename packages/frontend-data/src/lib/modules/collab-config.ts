import type { GanymedeApi } from '../api-ganymede';
import type { TAwarenessUser } from '@holistix-forge/collab-engine';
import { paletteRandomColor } from '@holistix-forge/ui-base';

/**
 * Configuration for YJS client collab
 * This type matches the collab module's expected config
 */
export type YjsClientCollabConfig = {
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
 * Configuration for collab registry (multi-project support)
 */
export type CollabRegistryConfig = {
  type: 'registry';
  createConfigForProject: (project_id: string) => YjsClientCollabConfig;
};

/**
 * Create collab module configuration for multi-project support
 * 
 * Returns a registry config that creates YJS WebSocket connections
 * on-demand for each project. This allows one gateway to serve
 * multiple projects with lazy-loaded connections.
 * 
 * @param gateway_hostname - Gateway hostname (without protocol)
 * @param ganymedeApi - API client for token management
 * @param userInfo - User information from useCurrentUser hook
 * @returns Collab registry configuration
 */
export function createCollabModuleConfig({
  gateway_hostname,
  ganymedeApi,
  userInfo,
}: {
  gateway_hostname: string;
  ganymedeApi: GanymedeApi;
  userInfo: { user_id: string; username: string };
}): CollabRegistryConfig {
  return {
    type: 'registry',
    createConfigForProject: (project_id: string): YjsClientCollabConfig => {
      // Use secure WebSocket (wss://) when page is loaded over HTTPS
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Note: y-websocket automatically appends room_id to ws_server URL
      // So ws_server should NOT include the project_id
      const wsUrl = `${wsProtocol}//${gateway_hostname}/project`;
      
      // Generate consistent color from username hash using palette
      const userColor = paletteRandomColor(userInfo.username);
      
      return {
        type: 'yjs-client',
        ws_server: wsUrl,
        room_id: project_id, // This gets appended by y-websocket: /project/{project_id}
        token: {
          get: () => ganymedeApi.getAccessToken(),
          refresh: () => ganymedeApi.refreshAccessToken(),
        },
        user: {
          user_id: userInfo.user_id,
          username: userInfo.username,
          color: userColor,
        },
      };
    },
  };
}
