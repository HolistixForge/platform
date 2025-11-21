import { log } from '@monorepo/log';
import { IPersistenceProvider } from '../state/IPersistenceProvider';
import type { TOAuthClient, TOAuthCode, TOAuthToken } from '@monorepo/gateway';
import { OAuthManager as AbstractOAuthManager } from '@monorepo/gateway';

/**
 * OAuthManager - OAuth Data Management
 *
 * Responsibilities:
 * - Manage OAuth clients (add/get/delete)
 * - Manage authorization codes (save/get/delete)
 * - Manage tokens (save/get/delete)
 * - Cleanup expired codes/tokens
 * - Provide persistence via IPersistenceProvider interface
 *
 * Used by OAuth2Server model.
 */

/**
 * OAuth slice of gateway state
 */
interface TOAuthData {
  oauth_clients: {
    [client_id: string]: TOAuthClient;
  };
  oauth_authorization_codes: {
    [code: string]: TOAuthCode;
  };
  oauth_tokens: {
    [token_id: string]: TOAuthToken;
  };
}

export class OAuthManager
  extends AbstractOAuthManager
  implements IPersistenceProvider
{
  private data: TOAuthData;

  constructor() {
    super();
    this.data = {
      oauth_clients: {},
      oauth_authorization_codes: {},
      oauth_tokens: {},
    };
  }

  // IPersistenceProvider implementation

  loadFromSerialized(data: Record<string, unknown> | null | undefined): void {
    if (!data) {
      log(6, 'OAUTH', 'No OAuth data to load');
      return;
    }

    if (data.oauth_clients && typeof data.oauth_clients === 'object') {
      this.data.oauth_clients =
        data.oauth_clients as TOAuthData['oauth_clients'];
    }
    if (
      data.oauth_authorization_codes &&
      typeof data.oauth_authorization_codes === 'object'
    ) {
      this.data.oauth_authorization_codes =
        data.oauth_authorization_codes as TOAuthData['oauth_authorization_codes'];
    }
    if (data.oauth_tokens && typeof data.oauth_tokens === 'object') {
      this.data.oauth_tokens = data.oauth_tokens as TOAuthData['oauth_tokens'];
    }

    log(6, 'OAUTH', 'Loaded OAuth data');
  }

  saveToSerializable(): Record<string, unknown> {
    return {
      oauth_clients: { ...this.data.oauth_clients },
      oauth_authorization_codes: { ...this.data.oauth_authorization_codes },
      oauth_tokens: { ...this.data.oauth_tokens },
    };
  }

  //
  // OAuth Clients
  //

  override addClient(client: TOAuthClient): void {
    this.data.oauth_clients[client.client_id] = client;
    log(7, 'OAUTH', `Added client: ${client.client_id}`);
  }

  override getClient(client_id: string): TOAuthClient | null {
    return this.data.oauth_clients[client_id] || null;
  }

  override deleteClient(client_id: string): void {
    delete this.data.oauth_clients[client_id];
    log(7, 'OAUTH', `Deleted client: ${client_id}`);
  }

  getAllClients(): TOAuthClient[] {
    return Object.values(this.data.oauth_clients);
  }

  //
  // Authorization Codes
  //

  override saveCode(code: TOAuthCode): void {
    this.data.oauth_authorization_codes[code.code] = code;
    log(7, 'OAUTH', `Saved authorization code for user: ${code.user_id}`);
  }

  override getCode(code_string: string): TOAuthCode | null {
    return this.data.oauth_authorization_codes[code_string] || null;
  }

  override deleteCode(code_string: string): void {
    delete this.data.oauth_authorization_codes[code_string];
    log(7, 'OAUTH', `Deleted authorization code: ${code_string}`);
  }

  //
  // Tokens
  //

  override saveToken(token: TOAuthToken): void {
    this.data.oauth_tokens[token.token_id] = token;
    log(
      7,
      'OAUTH',
      `Saved token: ${token.token_id} for user: ${token.user_id}`
    );
  }

  override getToken(access_token: string): TOAuthToken | null {
    // Find token by access_token value
    const tokens = Object.values(this.data.oauth_tokens);
    return tokens.find((t) => t.access_token === access_token) || null;
  }

  getTokenByRefresh(refresh_token: string): TOAuthToken | null {
    // Find token by refresh_token value
    const tokens = Object.values(this.data.oauth_tokens);
    return tokens.find((t) => t.refresh_token === refresh_token) || null;
  }

  override getTokenById(token_id: string): TOAuthToken | null {
    return this.data.oauth_tokens[token_id] || null;
  }

  override deleteToken(token_id: string): void {
    delete this.data.oauth_tokens[token_id];
    log(7, 'OAUTH', `Deleted token: ${token_id}`);
  }

  //
  // Cleanup
  //

  cleanupExpired(): void {
    const now = new Date().toISOString();
    let cleaned = 0;

    // Cleanup expired authorization codes
    for (const [code, codeData] of Object.entries(
      this.data.oauth_authorization_codes
    )) {
      if (codeData.expires_at < now) {
        delete this.data.oauth_authorization_codes[code];
        cleaned++;
      }
    }

    // Cleanup expired tokens
    for (const [token_id, tokenData] of Object.entries(
      this.data.oauth_tokens
    )) {
      if (tokenData.refresh_token_expires_at < now) {
        delete this.data.oauth_tokens[token_id];
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log(6, 'OAUTH', `Cleaned up ${cleaned} expired codes/tokens`);
    }
  }

  //
  // Statistics
  //

  getStats() {
    return {
      clients: Object.keys(this.data.oauth_clients).length,
      codes: Object.keys(this.data.oauth_authorization_codes).length,
      tokens: Object.keys(this.data.oauth_tokens).length,
    };
  }
}
