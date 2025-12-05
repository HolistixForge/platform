import { PostgreSQL } from '@holistix-forge/backend-engine';

const PG = {
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
};

const undefinedValues = Object.entries(PG)
  .filter(([key, value]) => value === undefined)
  .map(([key, value]) => key);

if (undefinedValues.length > 0) {
  console.error(
    `The following environment variables are not defined: ${undefinedValues.join(
      ', '
    )}`
  );
  throw new Error('Undefined environment variables');
}

export const pg = new PostgreSQL(PG as any, {});
