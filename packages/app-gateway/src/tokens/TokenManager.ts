import { log } from '@monorepo/log';
import { TokenManager as AbstractTokenManager } from '@monorepo/gateway';
import { makeHmacToken, generateJwtToken } from '@monorepo/backend-engine';
import { TJson } from '@monorepo/simple-types';

/**
 * TokenManager - Generic Token Generation
 *
 * Responsibilities:
 * - Generate HMAC tokens for any payload
 * - Generate JWT tokens for any payload
 *
 * Used by modules that need token generation (e.g., user-containers module)
 */
export class TokenManager extends AbstractTokenManager {
  private defaultSecret: string;

  constructor(defaultSecret?: string) {
    super();
    this.defaultSecret =
      defaultSecret ||
      process.env.GATEWAY_HMAC_SECRET ||
      'default-secret-change-me';
    if (this.defaultSecret === 'default-secret-change-me') {
      log(
        3,
        'TOKEN_MANAGER',
        'WARNING: Using default HMAC secret! Set GATEWAY_HMAC_SECRET env var!'
      );
    }
  }

  /**
   * Generate HMAC token for any payload
   * @param payload - Payload string to hash
   * @param secret - Optional secret (uses default if not provided)
   * @returns HMAC token string
   */
  generateHMACToken(payload: string, secret?: string): string {
    const secretToUse = secret || this.defaultSecret;
    // makeHmacToken expects (secret, data) where data is TJson
    // So we need to wrap the payload string in an object
    return makeHmacToken(secretToUse, { payload });
  }

  /**
   * Generate JWT token for any payload
   * @param payload - Payload object to encode
   * @param expiresIn - Optional expiration (default: '1h')
   * @returns JWT token string
   */
  generateJWTToken(payload: TJson, expiresIn = '1h'): string {
    return generateJwtToken(payload, expiresIn);
  }
}
