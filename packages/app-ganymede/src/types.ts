import { Request } from 'express';

export type UserSerializedInfo = { id: string; username: string };

type LoginLogoutCallback = (err: Error) => void;

export type Req = Request & {
  login: (user: UserSerializedInfo, cb: LoginLogoutCallback) => void;
  logout: (cb?: LoginLogoutCallback) => void;
  session: {
    passport?: { user?: UserSerializedInfo };
    secondFactor?: 'totp';
  };
  sessionID: string;
};

