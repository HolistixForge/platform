import type { GanymedeApi } from '../api-ganymede';
import type { TAwarenessUser } from '@holistix-forge/collab-engine';

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
 * @returns Collab registry configuration
 */
/**
 * Get current user info for collaboration
 * 
 * This function uses the same logic as useCurrentUser hook (POST /me endpoint).
 * It attempts to get the user from API, but doesn't block - instead it starts
 * the fetch in the background and uses a temporary value until the fetch completes.
 * 
 * Strategy:
 * 1. Return immediately with localStorage data or guest user
 * 2. Fetch real user in background and update cache
 * 3. Next collab instance will use the cached real user
 * 
 * @param ganymedeApi - API client to fetch current user
 * @returns User info for collaboration awareness (synchronous)
 */
function getCollabUser(ganymedeApi: GanymedeApi): { 
  user_id: string; 
  username: string; 
  color: string;
} {
  // Start background fetch if not already started
  if (!userInfoPromise) {
    userInfoPromise = (async () => {
      try {
        const response = await ganymedeApi.fetch({
          method: 'POST',
          url: 'me',
        }) as { user: { user_id: string; username?: string; email?: string } | { user_id: null } };
        
        if (response.user && response.user.user_id) {
          cachedUserInfo = {
            user_id: response.user.user_id,
            username: response.user.username || response.user.email || 'User',
            color: '#4A90E2',
          };
          return cachedUserInfo;
        }
      } catch (e) {
        console.warn('Failed to fetch current user from API:', e);
      }
      return null;
    })();
  }
  
  // Return cached user if available
  if (cachedUserInfo) {
    return cachedUserInfo;
  }
  
  // Try localStorage
  try {
    const userDataStr = localStorage.getItem('lss:user');
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      if (userData?.value?.user_id) {
        return {
          user_id: userData.value.user_id,
          username: userData.value.username || userData.value.email || 'User',
          color: '#4A90E2',
        };
      }
    }
  } catch (e) {
    console.warn('Failed to get user from localStorage:', e);
  }
  
  // Fallback: guest user
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    username: 'Guest User',
    color: '#94A3B8',
  };
}

// Cache for user info
let cachedUserInfo: { user_id: string; username: string; color: string } | null = null;
let userInfoPromise: Promise<{ user_id: string; username: string; color: string } | null> | null = null;

export function createCollabModuleConfig({
  gateway_hostname,
  ganymedeApi,
}: {
  gateway_hostname: string;
  ganymedeApi: GanymedeApi;
}): CollabRegistryConfig {
  return {
    type: 'registry',
    createConfigForProject: (project_id: string): YjsClientCollabConfig => {
      // Use secure WebSocket (wss://) when page is loaded over HTTPS
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Note: y-websocket automatically appends room_id to ws_server URL
      // So ws_server should NOT include the project_id
      const wsUrl = `${wsProtocol}//${gateway_hostname}/project`;
      
      // Get user info (will use cache if available, otherwise fetch in background)
      const userInfo = getCollabUser(ganymedeApi);
      
      return {
        type: 'yjs-client',
        ws_server: wsUrl,
        room_id: project_id, // This gets appended by y-websocket: /project/{project_id}
        token: {
          get: () => ganymedeApi.getAccessToken(),
          refresh: () => ganymedeApi.refreshAccessToken(),
        },
        user: userInfo,
      };
    },
  };
}
