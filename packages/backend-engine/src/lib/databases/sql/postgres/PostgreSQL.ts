import { QueryResult, Pool, PoolClient } from 'pg';
import { TSqlApi } from '../Connections';
import { Row, Sql, SqlResult, SqlResultsSet, TSqlConfig } from '../Sql';
import { TJsonWithDate } from '@monorepo/simple-types';
import { EPriority, log } from '@monorepo/log';

//

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
    args: Array<TJsonWithDate>
  ): Promise<PostgresResultsSet> {
    let reconnect = false;

    const startTime = Date.now();

    // Enhanced query logging with sanitized args (trace_id/span_id automatically included by Logger)
    log(EPriority.Debug, 'POSTGRE', 'query', {
      query: query.substring(0, 500), // Limit query length
      args: args,
      query_length: query.length,
    });

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
        const duration = Date.now() - startTime;

        // Log successful query with duration (trace_id/span_id automatically included)
        if (duration > 1000) {
          // Log slow queries at warning level
          log(EPriority.Warning, 'POSTGRE', `Slow query (${duration}ms)`, {
            query: query.substring(0, 200),
            duration_ms: duration,
          });
        }

        return resultSets;
      } catch (err: any) {
        const duration = Date.now() - startTime;

        // Log query error with duration (trace_id/span_id automatically included)
        log(EPriority.Error, 'POSTGRE', `Query error: ${err.message}`, {
          query: query.substring(0, 200),
          duration_ms: duration,
          error_message: err.message,
        });

        if (err.message.includes('terminating connection')) {
          this._connection = null;
          reconnect = true;
        } else {
          throw new Error(`SQL error: ${err.message}`);
        }
      }
    } while (reconnect);
    throw new Error(`SQL error`);
  }
}
