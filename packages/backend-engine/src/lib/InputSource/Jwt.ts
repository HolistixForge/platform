import * as jwt from 'jsonwebtoken';
import { TJson } from '@holistix-forge/simple-types';

/**
 * Generate a JWT token with the given payload
 */
export const generateJwtToken = (payload: TJson, expiresIn = '1h'): string => {
  const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
  if (!JWT_PRIVATE_KEY) {
    throw new Error('JWT_PRIVATE_KEY environment variable is not set');
  }

  const token = jwt.sign(
    payload as object,
    JWT_PRIVATE_KEY as jwt.PrivateKey,
    {
      algorithm: 'RS256',
      expiresIn,
    } as jwt.SignOptions
  );

  return token;
};

/**
 * Extract JWT payload from authorization header
 */
export const jwtPayload = (authorizationHeader: string): TJson => {
  const JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
  if (!JWT_PUBLIC_KEY) {
    throw new Error('JWT_PUBLIC_KEY environment variable is not set');
  }

  // Remove 'token ' or 'Bearer ' prefix if present
  let token = authorizationHeader;
  if (authorizationHeader.startsWith('token ')) {
    token = authorizationHeader.substring(6);
  } else if (authorizationHeader.startsWith('Bearer ')) {
    token = authorizationHeader.substring(7);
  }

  try {
    const payload = jwt.verify(token, JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
    });
    return payload as TJson;
  } catch (error) {
    throw new Error('Invalid JWT token');
  }
};
