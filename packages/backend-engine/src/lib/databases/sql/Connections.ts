import { TSqlConfig } from './Sql';

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
