import crypto from 'crypto';
import OAuth2Server from '@node-oauth/oauth2-server';
import { OAuthManager } from './OAuthManager';
import { PermissionManager } from '../permissions/PermissionManager';
import { EPriority, log } from '@holistix-forge/log';
import { makeUuid } from '@holistix-forge/simple-types';

/**
 * OAuth2Server Model Implementation
 *
 * Implements the required OAuth2 model interface for @node-oauth/oauth2-server.
 * Uses OAuthManager for data storage and PermissionManager for permission validation.
 */
export class OAuth2Model implements OAuth2Server.AuthorizationCodeModel {
  constructor(
    private oauthManager: OAuthManager,
    private permissionManager: PermissionManager
  ) {}

  /**
   * Get client by client_id (and optional client_secret for authentication)
   */
  async getClient(
    clientId: string,
    clientSecret?: string
  ): Promise<OAuth2Server.Client | OAuth2Server.Falsey> {
    const client = this.oauthManager.getClient(clientId);

    if (!client) {
      log(EPriority.Notice, 'OAUTH_MODEL', `Client not found: ${clientId}`);
      return null;
    }

    // If client_secret is provided, validate it
    if (clientSecret && client.client_secret !== clientSecret) {
      log(
        EPriority.Notice,
        'OAUTH_MODEL',
        `Invalid client_secret for: ${clientId}`
      );
      return null;
    }

    return {
      id: client.client_id,
      clientId: client.client_id,
      clientSecret: client.client_secret,
      grants: client.grants as string[],
      redirectUris: client.redirect_uris,
    };
  }

  /**
   * Save authorization code
   */
  async saveAuthorizationCode(
    code: OAuth2Server.AuthorizationCode,
    client: OAuth2Server.Client,
    user: OAuth2Server.User
  ): Promise<OAuth2Server.AuthorizationCode> {
    const codeString = code.authorizationCode;

    let scopeArray: string[] = [];
    if (code.scope) {
      if (Array.isArray(code.scope)) {
        scopeArray = code.scope;
      } else {
        scopeArray = (code.scope as unknown as string).split(' ');
      }
    }

    this.oauthManager.saveCode({
      code: codeString,
      client_id: client.clientId,
      user_id: String(user.id),
      scope: scopeArray,
      redirect_uri: code.redirectUri || '',
      expires_at: code.expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });

    log(
      EPriority.Debug,
      'OAUTH_MODEL',
      `Saved authorization code for user: ${user.id}`
    );
    return code;
  }

  /**
   * Get authorization code
   */
  async getAuthorizationCode(
    authorizationCode: string
  ): Promise<OAuth2Server.AuthorizationCode | OAuth2Server.Falsey> {
    const code = this.oauthManager.getCode(authorizationCode);

    if (!code) {
      log(EPriority.Notice, 'OAUTH_MODEL', `Authorization code not found`);
      return null;
    }

    // Check expiration
    if (new Date(code.expires_at) < new Date()) {
      log(EPriority.Notice, 'OAUTH_MODEL', `Authorization code expired`);
      this.oauthManager.deleteCode(authorizationCode);
      return null;
    }

    const client = this.oauthManager.getClient(code.client_id);
    if (!client) {
      log(
        EPriority.Error,
        'OAUTH_MODEL',
        `Client not found for code: ${code.client_id}`
      );
      return null;
    }

    return {
      authorizationCode: code.code,
      expiresAt: new Date(code.expires_at),
      redirectUri: code.redirect_uri,
      scope: code.scope,
      client: {
        id: client.client_id,
        clientId: client.client_id,
        clientSecret: client.client_secret,
        grants: client.grants as string[],
        redirectUris: client.redirect_uris,
      },
      user: {
        id: code.user_id,
      },
    };
  }

  /**
   * Revoke authorization code (called after token exchange)
   */
  async revokeAuthorizationCode(
    code: OAuth2Server.AuthorizationCode
  ): Promise<boolean> {
    this.oauthManager.deleteCode(code.authorizationCode);
    log(EPriority.Debug, 'OAUTH_MODEL', `Revoked authorization code`);
    return true;
  }

  /**
   * Save access token
   */
  async saveToken(
    token: OAuth2Server.Token,
    client: OAuth2Server.Client,
    user: OAuth2Server.User
  ): Promise<OAuth2Server.Token> {
    const token_id = makeUuid();

    let scopeArray: string[] = [];
    if (token.scope) {
      if (Array.isArray(token.scope)) {
        scopeArray = token.scope;
      } else {
        scopeArray = (token.scope as unknown as string).split(' ');
      }
    }

    this.oauthManager.saveToken({
      token_id,
      client_id: client.clientId,
      user_id: String(user.id),
      scope: scopeArray,
      access_token: token.accessToken,
      access_token_expires_at: token.accessTokenExpiresAt!.toISOString(),
      refresh_token: token.refreshToken || '',
      refresh_token_expires_at: token.refreshTokenExpiresAt
        ? token.refreshTokenExpiresAt.toISOString()
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days default
      created_at: new Date().toISOString(),
    });

    log(EPriority.Debug, 'OAUTH_MODEL', `Saved token for user: ${user.id}`);
    return token;
  }

  /**
   * Get access token
   */
  async getAccessToken(
    accessToken: string
  ): Promise<OAuth2Server.Token | OAuth2Server.Falsey> {
    const token = this.oauthManager.getToken(accessToken);

    if (!token) {
      log(EPriority.Notice, 'OAUTH_MODEL', `Access token not found`);
      return null;
    }

    // Check expiration
    if (new Date(token.access_token_expires_at) < new Date()) {
      log(EPriority.Notice, 'OAUTH_MODEL', `Access token expired`);
      return null;
    }

    const client = this.oauthManager.getClient(token.client_id);
    if (!client) {
      log(
        EPriority.Error,
        'OAUTH_MODEL',
        `Client not found for token: ${token.client_id}`
      );
      return null;
    }

    return {
      accessToken: token.access_token,
      accessTokenExpiresAt: new Date(token.access_token_expires_at),
      refreshToken: token.refresh_token,
      refreshTokenExpiresAt: token.refresh_token
        ? new Date(token.refresh_token_expires_at)
        : undefined,
      scope: token.scope,
      client: {
        id: client.client_id,
        clientId: client.client_id,
        clientSecret: client.client_secret,
        grants: client.grants as string[],
        redirectUris: client.redirect_uris,
      },
      user: {
        id: token.user_id,
      },
    };
  }

  /**
   * Get refresh token
   */
  async getRefreshToken(
    refreshToken: string
  ): Promise<OAuth2Server.RefreshToken | OAuth2Server.Falsey> {
    const token = this.oauthManager.getTokenByRefresh(refreshToken);

    if (!token) {
      log(EPriority.Notice, 'OAUTH_MODEL', `Refresh token not found`);
      return null;
    }

    // Check expiration
    if (new Date(token.refresh_token_expires_at) < new Date()) {
      log(EPriority.Notice, 'OAUTH_MODEL', `Refresh token expired`);
      return null;
    }

    const client = this.oauthManager.getClient(token.client_id);
    if (!client) {
      log(
        EPriority.Error,
        'OAUTH_MODEL',
        `Client not found for refresh token: ${token.client_id}`
      );
      return null;
    }

    return {
      refreshToken: token.refresh_token,
      refreshTokenExpiresAt: new Date(token.refresh_token_expires_at),
      scope: token.scope,
      client: {
        id: client.client_id,
        clientId: client.client_id,
        clientSecret: client.client_secret,
        grants: client.grants as string[],
        redirectUris: client.redirect_uris,
      },
      user: {
        id: token.user_id,
      },
    };
  }

  /**
   * Revoke refresh token
   */
  async revokeToken(
    token: OAuth2Server.Token | OAuth2Server.RefreshToken
  ): Promise<boolean> {
    const refreshToken = 'refreshToken' in token ? token.refreshToken : null;
    if (!refreshToken) {
      log(EPriority.Notice, 'OAUTH_MODEL', `No refresh token to revoke`);
      return false;
    }

    const storedToken = this.oauthManager.getTokenByRefresh(refreshToken);
    if (storedToken) {
      this.oauthManager.deleteToken(storedToken.token_id);
      log(EPriority.Debug, 'OAUTH_MODEL', `Revoked refresh token`);
      return true;
    }

    return false;
  }

  /**
   * Verify scope (optional, validates requested scope against user permissions)
   */
  async verifyScope(
    token: OAuth2Server.Token,
    scope: string | string[]
  ): Promise<boolean> {
    const requestedScopes = Array.isArray(scope) ? scope : scope.split(' ');

    let tokenScopes: string[] = [];
    if (token.scope) {
      if (Array.isArray(token.scope)) {
        tokenScopes = token.scope;
      } else {
        tokenScopes = (token.scope as unknown as string).split(' ');
      }
    }

    // Check if all requested scopes are in the token
    const hasAllScopes = requestedScopes.every((s) => tokenScopes.includes(s));

    if (!hasAllScopes) {
      log(EPriority.Notice, 'OAUTH_MODEL', `Scope verification failed`);
      return false;
    }

    // Additional permission check via PermissionManager
    const userId = String(token.user?.id || '');
    if (!userId) {
      log(
        EPriority.Notice,
        'OAUTH_MODEL',
        `No user ID in token for scope verification`
      );
      return false;
    }

    // Check if user has permissions matching the scopes
    for (const requestedScope of requestedScopes) {
      if (!this.permissionManager.hasPermission(userId, requestedScope)) {
        log(
          EPriority.Debug,
          'OAUTH_MODEL',
          `User ${userId} lacks permission: ${requestedScope}`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Generate access token (optional, defaults to random token)
   */
  async generateAccessToken(
    client: OAuth2Server.Client,
    user: OAuth2Server.User,
    scope: string | string[]
  ): Promise<string> {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate refresh token (optional, defaults to random token)
   */
  async generateRefreshToken(
    client: OAuth2Server.Client,
    user: OAuth2Server.User,
    scope: string | string[]
  ): Promise<string> {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate authorization code (optional, defaults to random code)
   */
  async generateAuthorizationCode(
    client: OAuth2Server.Client,
    user: OAuth2Server.User,
    scope: string | string[]
  ): Promise<string> {
    return crypto.randomBytes(16).toString('hex');
  }
}
