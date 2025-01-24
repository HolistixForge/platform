import { TSqlQueryArgs } from '../databases/sql/Sql';
import { SqlException, UserException } from '../Exceptions/Exception';
import { error } from '@monorepo/log';
import { Command, TCommandReturn } from './Command';
import { TJson } from '@monorepo/simple-types';
import { TSqlQueryDefinition } from '../databases/sql/Connections';
import { DeepReadonly } from 'ts-essentials';

//

type Targs = {
  connection: string;
  queryId: string;
  args: TSqlQueryArgs;
};

//

export class SqlQuery extends Command {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processError(constraintName: string, q: DeepReadonly<TSqlQueryDefinition>) {
    error('', `constraint failed: ${constraintName}`);
    const f =
      q.return?.failures &&
      q.return.failures.find((f) => f.constraint === constraintName);
    if (f) throw new SqlException(`${f.message}`);
    throw new SqlException(`unexpected result`);
  }

  //

  async run(args: Targs): Promise<TCommandReturn> {
    const connection = this._config.connections.get(args.connection);
    if (!connection)
      throw new SqlException(`no such connection [${args.connection}]`);

    const q = connection.getQuery(args.queryId);
    if (!q) throw new SqlException(`no such query [${args.queryId}]`);

    try {
      const resultSets = await connection.query(q.query, args.args);
      const results: { [key: string]: TJson | TJson[] } = {};
      let currentResultSet;
      let resultsSetsIndex = 0;
      while ((currentResultSet = resultSets.next())) {
        // for mysql (do not throw error on failed constraint, but return error message)
        const constraintName = currentResultSet.isError();
        if (constraintName) {
          this.processError(constraintName, q);
        } else {
          const expResult = q.return?.resultsets[resultsSetsIndex];
          if (expResult) {
            let d: TJson | null = null;
            if (expResult.expect === 'one-row') d = currentResultSet.oneRow();
            else if (expResult.expect === 'multiple')
              d = currentResultSet.allRows();
            results[`_${resultsSetsIndex}`] = d as TJson;
          }
        }
        resultsSetsIndex++;
      }
      return { data: results };
    } catch (err: any) {
      // for each defined error cause (sql constraints)
      if (q.return?.failures) {
        for (let i = 0; i < q.return.failures.length; i++) {
          const f = q.return.failures[i];
          // if this error contains the constraint name
          // return the user friendly message
          if (
            err.message.includes(f.constraint) ||
            (err instanceof SqlException &&
              err._errors.find((e) => e.message.includes(f.constraint)))
          )
            throw new UserException(`${f.message}`);
        }
      }
      throw err;
    }
  }
}
