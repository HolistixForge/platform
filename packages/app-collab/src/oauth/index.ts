import { OAuthManager } from './OAuthManager';
import { gatewayState } from '../state';
import { permissionManager } from '../permissions';
import { createOAuth2Server } from './server';

// Create singleton instances
export const oauthManager = new OAuthManager(gatewayState);
export const oauth2Server = createOAuth2Server(oauthManager, permissionManager);

// Re-export for convenience
export { OAuthManager } from './OAuthManager';
export { OAuth2Model } from './model';
export { createOAuth2Server } from './server';

