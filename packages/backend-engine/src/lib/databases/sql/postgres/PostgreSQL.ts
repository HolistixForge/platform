import { QueryResult, Pool, PoolClient } from 'pg';
import { SqlException } from '../../../Exceptions/Exception';
import { TSqlApi } from '../Connections';
import { Sql, SqlResult, SqlResultsSet, TSqlConfig } from '../Sql';
import { TJson } from '@monorepo/simple-types';
import { log } from '@monorepo/log';

//

type Row = Array<TJson>;

export class PostgresResult extends SqlResult {
  _data: QueryResult;

  constructor(data: QueryResult) {
    super();
    this._data = data;
  }

  isError(): string | false {
    // postgresql driver throw all errors
    return false;
  }

  oneRow(): Row {
    return this._data.rows[0];
  }

  allRows(): Row[] {
    return this._data.rows;
  }
}

//
//

export class PostgresResultsSet extends SqlResultsSet {
  _cursor = -1;
  _data: QueryResult | null = null;
  _count = 0;

  constructor(data: QueryResult) {
    super();
    this._data = data;
    if (!this._data) this._count = 0;
    else this._count = 1;
  }

  next(): PostgresResult | undefined {
    this._cursor++;
    if (this._cursor < this._count && this._data) {
      return new PostgresResult(this._data);
    } else {
      return undefined;
    }
  }

  count(): number {
    return this._count;
  }
}

//
//

let pool: Pool;

export class PostgreSQL extends Sql {
  _config: TSqlConfig | null = null;
  _connection: PoolClient | null = null;

  constructor(config: TSqlConfig, api: TSqlApi) {
    super(api);
    this._config = config;
    if (!pool)
      pool = new Pool({
        ...this._config,
        port: parseInt(this._config.port),
      });
  }

  async query(
    query: string,
    args: Array<string | number | TJson>
  ): Promise<PostgresResultsSet> {
    let reconnect = false;

    log(7, 'POSTGRE', 'query', { query, args });

    do {
      reconnect = false;

      try {
        if (!this._connection) {
          this._connection = await pool.connect();
          // await this._connection.connect();
        }

        const c = await this._connection.query(
          /*new Cursor(*/ query,
          args /*)*/
        );
        const data = c;

        const resultSets = new PostgresResultsSet(data);
        return resultSets;
      } catch (err: any) {
        if (err.message.includes('terminating connection')) {
          this._connection = null;
          reconnect = true;
        } else {
          throw new SqlException(`sql error: ${err.message}`);
        }
      }
    } while (reconnect);
    throw new SqlException(`sql error`);
  }
}
