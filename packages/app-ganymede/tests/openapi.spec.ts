import { execSync } from 'child_process';

describe('Bash script', () => {
  test('should run successfully', () => {
    const scriptPath = `${process.env.NX_WORKSPACE_ROOT}/apps/ganymede/tests/openapi.sh`;
    const result = execSync(`bash ${scriptPath}`).toString().trim();

    // Assert the expected outcome of the script
    expect(result).toEqual('OK');
  });
});
