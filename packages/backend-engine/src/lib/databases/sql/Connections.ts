import { DeepReadonly } from 'ts-essentials';
// import { Mysql, TMysqlConfig } from './mysql/Mysql';
import { Sql, TSqlConfig } from './Sql';
import { PostgreSQL } from './postgres/PostgreSQL';

//
//
//

type TExpectedResultSet = {
  expect: 'one-row' | 'multiple';
  transform?: Array<{
    key: string;
    operation: string;
  }>;
};

export type TSqlQueryDefinition = {
  query: string;
  types: string;
  return?: {
    resultsets: TExpectedResultSet[];
    failures?: Array<{
      constraint: string;
      message: string;
    }>;
  };
};

export type TSqlApi = {
  [k: string]: TSqlQueryDefinition;
};

export type TConnectionDefinition = {
  type: string;
  config: TSqlConfig; // | TMysqlConfig;
  api: TSqlApi;
};

export type TConnections = { [k: string]: TConnectionDefinition };

//
//
//

export class Connections {
  _sqlConnections: { [k: string]: Sql } = {};

  constructor(cds: TConnections) {
    for (const k in cds) {
      const cd = cds[k];
      switch (cd.type) {
        /*
        case 'mysql':
          this._sqlConnections[k] = new Mysql(cd.config, cd.api);
          break;
        */
        case 'postgresql':
          this._sqlConnections[k] = new PostgreSQL(cd.config, cd.api) as Sql;
          break;

        default:
          throw new Error(`no such sql driver [${cd.type}]`);
      }
    }
  }

  get(cid: string): DeepReadonly<Sql> | undefined {
    return this._sqlConnections[cid];
  }
}
