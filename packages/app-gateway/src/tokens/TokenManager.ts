import { TokenManager as AbstractTokenManager } from '@holistix/gateway';
import { generateJwtToken } from '@holistix/backend-engine';
import { TJson } from '@holistix/simple-types';

/**
 * TokenManager - Generic Token Generation
 *
 * Responsibilities:
 * - Generate JWT tokens for any payload
 *
 * Used by modules that need token generation (e.g., user-containers module)
 */
export class TokenManager extends AbstractTokenManager {
  constructor() {
    super();
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
