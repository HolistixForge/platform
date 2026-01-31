/**
 * Jest Setup File
 * Sets up test environment variables required by the app
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Set minimal environment variables required for tests
process.env.ALLOWED_ORIGINS = '["http://localhost:3000"]'; // Must be JSON array!
process.env.BIND_ADDRESS = '0.0.0.0:8080';
process.env.GATEWAY_ID = 'test-gateway';
process.env.GATEWAY_TOKEN = 'test-token';
process.env.GANYMEDE_FQDN = 'localhost:3100';
