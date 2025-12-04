import { PostgreSQL } from '@holistix-forge/backend-engine';
import { CONFIG } from '../config';

export const pg = new PostgreSQL(
  {
    host: CONFIG.PG_HOST,
    port: CONFIG.PG_PORT,
    database: CONFIG.PG_DATABASE,
    user: CONFIG.PG_USER,
    password: CONFIG.PG_PASSWORD,
  },
  {}
);
