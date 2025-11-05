import {
  Strategy as OAuth2Strategy,
  StrategyOptions,
  VerifyFunction,
} from 'passport-oauth2';
import { Request } from 'express';

export = LinkedInStrategy;

declare class LinkedInStrategy extends OAuth2Strategy {
  constructor(options: StrategyOptions, verify: VerifyFunction);
  name: string;
  profileUrl: string;
}
