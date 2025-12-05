import { Request, Response, NextFunction, RequestHandler } from 'express';

export interface AuthRequest extends Request {
  user: {
    id: string;
    username: string;
  };
}

export type AsyncHandler = (
  req: any,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

