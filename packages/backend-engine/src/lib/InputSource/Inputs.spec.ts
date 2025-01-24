import { Logger } from '@monorepo/log';
import { Inputs } from './Inputs';

const env = {
  TEST_ENV: 'smurfs',
  TEST_PART_ENV: 'hello {env.TEST_ENV}',
  TEST_FULL_ENV: '{env.TEST_ENV}',
  TEST_MULT_ENV:
    '{env.TEST_ENV} hello {env.TEST_ENV} hello {env.TEST_PART_ENV}',
};

describe('Testing the input variable relacement', () => {
  Logger.setPriority(7);

  const inputs = new Inputs(env);

  it('tests none env', async () => {
    const v = await inputs.cloneEvalArgs('smurfs');
    console.log(v);
    expect(v).toBe('smurfs');
  });

  it('tests number', async () => {
    const v = await inputs.cloneEvalArgs(42);
    console.log(v);
    expect(v).toBe(42);
  });

  it('tests number', async () => {
    const v = await inputs.cloneEvalArgs({
      age: 42,
      name: 'John',
    });
    console.log(JSON.stringify(v));
    expect(JSON.stringify(v)).toBe('{"age":42,"name":"John"}');
  });

  it('tests simple env', async () => {
    const v = await inputs.cloneEvalArgs('{env.TEST_ENV}');
    console.log(v);
    expect(v).toBe('smurfs');
  });

  it('tests simple env', async () => {
    const v = await inputs.cloneEvalArgs('{env.TEST_PART_ENV}');
    console.log(v);
    expect(v).toBe('hello smurfs');
  });

  it('tests simple env', async () => {
    const v = await inputs.cloneEvalArgs('{env.TEST_FULL_ENV}');
    console.log(v);
    expect(v).toBe('smurfs');
  });

  it('tests simple env', async () => {
    const v = await inputs.cloneEvalArgs('{env.TEST_MULT_ENV}');
    console.log(v);
    expect(v).toBe('smurfs hello smurfs hello hello smurfs');
  });
});
