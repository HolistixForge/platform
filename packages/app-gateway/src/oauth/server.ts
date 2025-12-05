import OAuth2Server from '@node-oauth/oauth2-server';
import { OAuth2Model } from './model';
import { OAuthManager } from './OAuthManager';
import { PermissionManager } from '../permissions/PermissionManager';

/**
 * Create OAuth2Server Instance
 *
 * This creates and configures the OAuth2 server with our custom model.
 */
export function createOAuth2Server(
  oauthManager: OAuthManager,
  permissionManager: PermissionManager
): OAuth2Server {
  const model = new OAuth2Model(oauthManager, permissionManager);

  return new OAuth2Server({
    model,
    accessTokenLifetime: 60 * 60, // 1 hour
    refreshTokenLifetime: 60 * 60 * 24 * 90, // 90 days
    allowBearerTokensInQueryString: true,
    allowEmptyState: false,
  });
}
