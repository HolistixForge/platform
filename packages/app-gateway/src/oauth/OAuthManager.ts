import { log } from '@monorepo/log';
import { GatewayState } from '../state/GatewayState';
import { TOAuthClient, TOAuthCode, TOAuthToken } from '../state/types';

/**
 * OAuthManager - OAuth Data Management
 *
 * Responsibilities:
 * - Manage OAuth clients (add/get/delete)
 * - Manage authorization codes (save/get/delete)
 * - Manage tokens (save/get/delete)
 * - Cleanup expired codes/tokens
 *
 * Uses GatewayState for persistence.
 * Used by OAuth2Server model.
 */
export class OAuthManager {
  constructor(private gatewayState: GatewayState) {}

  //
  // OAuth Clients
  //

  addClient(client: TOAuthClient): void {
    this.gatewayState.updateData((data) => {
      data.oauth_clients[client.client_id] = client;
    });
    log(
      7,
      'OAUTH',
      `Added client: ${client.client_id} for container: ${client.container_id}`
    );
  }

  getClient(client_id: string): TOAuthClient | null {
    return this.gatewayState.getData().oauth_clients[client_id] || null;
  }

  deleteClient(client_id: string): void {
    this.gatewayState.updateData((data) => {
      delete data.oauth_clients[client_id];
    });
    log(7, 'OAUTH', `Deleted client: ${client_id}`);
  }

  getAllClients(): TOAuthClient[] {
    return Object.values(this.gatewayState.getData().oauth_clients);
  }

  getClientsByContainer(container_id: string): TOAuthClient[] {
    return this.getAllClients().filter((c) => c.container_id === container_id);
  }

  //
  // Authorization Codes
  //

  saveCode(code: TOAuthCode): void {
    this.gatewayState.updateData((data) => {
      data.oauth_authorization_codes[code.code] = code;
    });
    log(7, 'OAUTH', `Saved authorization code for user: ${code.user_id}`);
  }

  getCode(code_string: string): TOAuthCode | null {
    return (
      this.gatewayState.getData().oauth_authorization_codes[code_string] || null
    );
  }

  deleteCode(code_string: string): void {
    this.gatewayState.updateData((data) => {
      delete data.oauth_authorization_codes[code_string];
    });
    log(7, 'OAUTH', `Deleted authorization code: ${code_string}`);
  }

  //
  // Tokens
  //

  saveToken(token: TOAuthToken): void {
    this.gatewayState.updateData((data) => {
      data.oauth_tokens[token.token_id] = token;
    });
    log(
      7,
      'OAUTH',
      `Saved token: ${token.token_id} for user: ${token.user_id}`
    );
  }

  getToken(access_token: string): TOAuthToken | null {
    // Find token by access_token value
    const tokens = Object.values(this.gatewayState.getData().oauth_tokens);
    return tokens.find((t) => t.access_token === access_token) || null;
  }

  getTokenByRefresh(refresh_token: string): TOAuthToken | null {
    // Find token by refresh_token value
    const tokens = Object.values(this.gatewayState.getData().oauth_tokens);
    return tokens.find((t) => t.refresh_token === refresh_token) || null;
  }

  getTokenById(token_id: string): TOAuthToken | null {
    return this.gatewayState.getData().oauth_tokens[token_id] || null;
  }

  deleteToken(token_id: string): void {
    this.gatewayState.updateData((data) => {
      delete data.oauth_tokens[token_id];
    });
    log(7, 'OAUTH', `Deleted token: ${token_id}`);
  }

  //
  // Cleanup
  //

  cleanupExpired(): void {
    const now = new Date().toISOString();
    let cleaned = 0;

    this.gatewayState.updateData((data) => {
      // Cleanup expired authorization codes
      for (const [code, codeData] of Object.entries(
        data.oauth_authorization_codes
      )) {
        if (codeData.expires_at < now) {
          delete data.oauth_authorization_codes[code];
          cleaned++;
        }
      }

      // Cleanup expired tokens
      for (const [token_id, tokenData] of Object.entries(data.oauth_tokens)) {
        if (tokenData.refresh_token_expires_at < now) {
          delete data.oauth_tokens[token_id];
          cleaned++;
        }
      }
    });

    if (cleaned > 0) {
      log(6, 'OAUTH', `Cleaned up ${cleaned} expired codes/tokens`);
    }
  }

  //
  // Statistics
  //

  getStats() {
    const data = this.gatewayState.getData();
    return {
      clients: Object.keys(data.oauth_clients).length,
      codes: Object.keys(data.oauth_authorization_codes).length,
      tokens: Object.keys(data.oauth_tokens).length,
    };
  }
}
