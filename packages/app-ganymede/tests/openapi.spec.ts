import { execSync } from 'child_process';
import * as OpenApiValidator from 'express-openapi-validator';
import oas from '../src/oas30.json';

describe('OpenAPI Specification', () => {
  test('should validate using openapi-spec-validator', () => {
    // This test uses Python's openapi-spec-validator
    // The script will install Python if needed
    const scriptPath = `${process.env.NX_WORKSPACE_ROOT}/packages/app-ganymede/tests/openapi.spec.install.sh`;
    execSync(`bash ${scriptPath}`, { encoding: 'utf8' });
    // If no error is thrown, the test passes
  });

  test('should not have "default" property at root level', () => {
    // Ensure the OAS object doesn't have a "default" property
    // which would cause express-openapi-validator to fail
    expect(oas).not.toHaveProperty('default');
    expect(oas).toHaveProperty('openapi');
    expect(oas).toHaveProperty('info');
    expect(oas).toHaveProperty('paths');
    expect(oas).toHaveProperty('components');
  });

  test('should be valid for express-openapi-validator', () => {
    // This should not throw an error
    expect(() => {
      OpenApiValidator.middleware({
        apiSpec: oas as any,
        validateRequests: true,
      });
    }).not.toThrow();
  });
});
