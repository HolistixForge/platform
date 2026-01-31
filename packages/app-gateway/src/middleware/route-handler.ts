import { Request, Response, NextFunction, RequestHandler } from 'express';

export interface AuthRequest extends Request {
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export const asyncHandler = (
  fn: (req: any, res: Response, next: NextFunction) => Promise<any>
): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
