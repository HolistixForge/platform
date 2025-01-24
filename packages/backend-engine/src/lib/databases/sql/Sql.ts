import { DeepReadonly } from 'ts-essentials';
import { TSqlApi, TSqlQueryDefinition } from './Connections';
import { TJson } from '@monorepo/simple-types';

export type TSqlConfig = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

export type TSqlQueryArgs = Array<string | number>;

export abstract class SqlResult {
  abstract isError(): string | false;
  abstract oneRow(): TJson;
  abstract allRows(): TJson[];
}

export abstract class SqlResultsSet {
  abstract next(): SqlResult | undefined;
  abstract count(): number;
}

export abstract class Sql {
  _api: DeepReadonly<TSqlApi>;
  constructor(api: TSqlApi) {
    this._api = api;
  }

  getQuery(id: string): DeepReadonly<TSqlQueryDefinition> {
    return this._api[id];
  }

  abstract query(query: string, args: TSqlQueryArgs): Promise<SqlResultsSet>;
}
