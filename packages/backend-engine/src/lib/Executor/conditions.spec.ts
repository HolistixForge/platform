import { Inputs } from '../InputSource/Inputs';
import { Logger } from '@monorepo/log';
import { evalConditions } from './conditions';

const env = {
  TEST_ENV: 'smurfs',
  TEST_PART_ENV: 'hello {env.TEST_ENV}',
  TEST_FULL_ENV: '{env.TEST_ENV}',
  TEST_MULT_ENV:
    '{env.TEST_ENV} hello {env.TEST_ENV} hello {env.TEST_PART_ENV}',
};

const inputs = new Inputs(env);

Logger.setPriority(7);

//
//

describe('Testing the conditions evaluation', () => {
  // public key from auth0 JWKS (JSON Web Key Set) endpoint

  it('tests no conditions: true', async () => {
    const v = await evalConditions({}, inputs);
    expect(v).toBe(true);
  });

  //
  //

  it('tests is-not-undefined condition: true', async () => {
    const v = await evalConditions(
      {
        '{env.TEST_ENV}': { 'is-not-undefined': true },
      },
      inputs
    );
    expect(v).toBe(true);
  });

  //
  //

  it('tests is-not-undefined condition: false', async () => {
    const v = await evalConditions(
      {
        '{env.TEST_ENV_THAT_DONOT_EXIST}': { 'is-not-undefined': true },
      },
      inputs
    );
    expect(v).toBe(false);
  });

  //
  //

  it('tests is: true', async () => {
    const v = await evalConditions(
      {
        '{env.TEST_ENV}': { is: 'smurfs' },
      },
      inputs
    );
    expect(v).toBe(true);
  });

  //
  //

  it('tests is: false', async () => {
    const v = await evalConditions(
      {
        '{env.TEST_ENV}': { is: 'smurfss' },
      },
      inputs
    );
    expect(v).toBe(false);
  });

  //
  //

  it('tests is-not: true', async () => {
    const v = await evalConditions(
      {
        '{env.TEST_ENV}': { 'is-not': 'smurfss' },
      },
      inputs
    );
    expect(v).toBe(true);
  });

  //
  //

  it('tests is-not: false', async () => {
    const v = await evalConditions(
      {
        '{env.TEST_ENV}': { 'is-not': 'smurfs' },
      },
      inputs
    );
    expect(v).toBe(false);
  });

  //
  //

  it('tests in: true', async () => {
    const v = await evalConditions(
      {
        '{env.TEST_ENV}': { in: [0, 'smurfs', 42] },
      },
      inputs
    );
    expect(v).toBe(true);
  });

  //
  //

  it('tests in: false', async () => {
    const v = await evalConditions(
      {
        '{env.TEST_ENV}': { in: [0, 'smurfss', 42] },
      },
      inputs
    );
    expect(v).toBe(false);
  });

  //
  //
});
