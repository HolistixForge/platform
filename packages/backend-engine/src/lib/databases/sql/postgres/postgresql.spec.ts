import { Logger } from '@monorepo/log';
import { PostgreSQL } from './PostgreSQL';
import { TSqlApi } from '../Connections';

//

/*
docker pull postgres
docker run --name postgres-test -e POSTGRES_PASSWORD=test -p 5432:5432 -d postgres
sudo apt-get install postgresql-client-14
psql -h localhost -p 5432 -U postgres -d postgres -f ./test.sql
docker stop postgres-test
docker rm postgres-test
*/

const api: TSqlApi = {
  doError: {
    query: 'SELECT * from does_not_exist_table',
    types: '',
  },
  oneRow: {
    query:
      "SELECT CURRENT_TIMESTAMP AS current_datetime, 'Hello, World!' AS fixed_string",
    types: '',
  },
  multipleRow: {
    query: 'select * from users',
    types: '',
  },
  fqFail: {
    query:
      "INSERT INTO orders (order_number, user_id, order_date) VALUES ('ORD001', 5, '2023-01-01 10:00:00')",
    types: '',
  },
  callRaiseAnError: {
    query: 'CALL raise_an_error($1, $2, $3)',
    types: 'i,s',
  },
  returnValues: {
    query: 'CALL return_values($1, $2, $3, $4, $5, $6)',
    types: 'i,s',
  },
  get_orders_by_user_id: {
    query: 'SELECT * from get_orders_by_user_id($1)',
    types: 'i',
  },
};
//
//

describe('Testing PostgreSQL driver', () => {
  Logger.setPriority(7);

  const pg = new PostgreSQL(
    {
      host: '127.0.0.1',
      port: '5432',
      database: 'test_db',
      user: 'postgres',
      password: 'test',
    },
    api
  );

  //

  it('select from not existing table', async () => {
    let error = '';
    try {
      await pg.query(api['doError'].query, []);
    } catch (e) {
      error = e.message;
    }
    expect(error).toContain('relation "does_not_exist_table" does not exist');
  });

  //

  it('returns one row', async () => {
    const r = await pg.query(api['oneRow'].query, []);
    let set = r.next();

    // const isError = set.isError();
    const oneRow = set.oneRow();
    const allRows = set.allRows();

    while (set) {
      console.log({
        // isError,
        oneRow,
        allRows,
      });
      set = r.next();
    }

    expect(oneRow['fixed_string']).toBe('Hello, World!');
  });

  //

  it('returns multiple rows', async () => {
    const r = await pg.query(api['multipleRow'].query, []);
    let set = r.next();

    // const isError = set.isError();
    const oneRow = set.oneRow();
    const allRows = set.allRows();

    while (set) {
      console.log({
        // isError,
        oneRow,
        allRows,
      });
      set = r.next();
    }

    expect(allRows.length).toBe(3);
  });

  //

  it('trig a foreign key constraint', async () => {
    let error = '';
    try {
      await pg.query(api['fqFail'].query, []);
    } catch (e) {
      error = e.message;
    }
    expect(error).toContain('"orders_user_id_fkey"');
  });

  //

  it('must raise an error', async () => {
    let error = '';
    try {
      await pg.query(api['callRaiseAnError'].query, [42, 'abemus papam', null]);
    } catch (e) {
      error = e.message;
    }
    expect(error).toContain('artificial_exception');
  });

  //

  it('must return values from procedure', async () => {
    const r = await pg.query(api['returnValues'].query, [
      42,
      'abemus papam',
      null,
      null,
      null,
      null,
    ]);
    let set = r.next();

    // const isError = set.isError();
    const oneRow = set.oneRow();
    const allRows = set.allRows();

    while (set) {
      console.log({
        // isError,
        oneRow,
        allRows,
      });
      set = r.next();
    }

    expect(allRows.length).toBe(1);
    expect(oneRow['new_project_id']).toBe(42);
    expect((oneRow['what_time_is_it'] as Date).toISOString()).toMatch(
      /^([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))T([0-2][0-9]):([0-5][0-9]):([0-5][0-9]).([0-5][0-9][0-9])Z$/
    );
    expect((oneRow['what_time_is_it'] as Date).toISOString()).toBe(
      '2042-12-24T11:42:59.000Z'
    );
    expect(oneRow['some_text']).toBe(
      'Hello, this is some dummy text for testing.'
    );
    expect(JSON.stringify(oneRow['json_data'])).toBe(
      '{"key":"value","array":[1,2,3]}'
    );
  });

  //

  it('must return rows from function', async () => {
    const r = await pg.query(api['get_orders_by_user_id'].query, [2]);
    let set = r.next();

    // const isError = set.isError();
    const oneRow = set.oneRow();
    const allRows = set.allRows();

    while (set) {
      console.log({
        // isError,
        oneRow,
        allRows,
      });
      set = r.next();
    }

    expect(allRows.length).toBe(2);
    expect(allRows[1]['order_id']).toBe(3);
    expect(allRows[1]['order_number']).toBe('ORD004');
  });
});
