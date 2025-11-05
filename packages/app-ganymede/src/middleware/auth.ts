import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config';
import { ForbiddenException } from '@monorepo/log';

export interface AuthRequest extends Request {
  user: {
    id: string;
    username: string;
  };
}

export const authenticateJwt: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthRequest;
  const authHeader = authReq.headers.authorization;

  if (!authHeader) {
    return next(new ForbiddenException([{ message: 'No authorization header' }]));
  }

  let token = authHeader;
  if (authHeader.startsWith('token ')) {
    token = authHeader.replace('token ', '');
  }

  try {
    const payload = jwt.verify(token, CONFIG.JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
    }) as any;

    authReq.user = {
      id: payload.user.id,
      username: payload.user.username,
    };

    next();
  } catch (error: any) {
    return next(new ForbiddenException([{ message: 'Invalid token' }], error));
  }
};

