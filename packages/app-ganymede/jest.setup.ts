/**
 * Jest Setup File
 * Sets up test environment variables required by the app
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Set minimal environment variables required for tests
process.env.FRONTEND_FQDN = 'localhost:3000';
process.env.GANYMEDE_FQDN = 'localhost:3100';
process.env.GANYMEDE_SERVER_BIND = '0.0.0.0:3100';
process.env.ALLOWED_ORIGINS = '["http://localhost:3000"]'; // Must be JSON array!
process.env.PG_HOST = 'localhost';
process.env.PG_PORT = '5432';
process.env.PG_DATABASE = 'test_db';
process.env.PG_USER = 'test_user';
process.env.PG_PASSWORD = 'test_password';
process.env.JWT_PUBLIC_KEY = 'test_public_key';
process.env.JWT_PRIVATE_KEY = 'test_private_key';
process.env.GITHUB_CLIENT_ID = 'test_github_id';
process.env.GITHUB_CLIENT_SECRET = 'test_github_secret';
process.env.GITLAB_CLIENT_ID = 'test_gitlab_id';
process.env.GITLAB_CLIENT_SECRET = 'test_gitlab_secret';
process.env.LINKEDIN_CLIENT_ID = 'test_linkedin_id';
process.env.LINKEDIN_CLIENT_SECRET = 'test_linkedin_secret';
process.env.DISCORD_CLIENT_ID = 'test_discord_id';
process.env.DISCORD_CLIENT_SECRET = 'test_discord_secret';
process.env.MAILING_HOST = 'localhost';
process.env.MAILING_PORT = '1025';
process.env.MAILING_USER = 'test';
process.env.MAILING_PASSWORD = 'test';
process.env.SESSION_COOKIE_KEY = 'test_session_key';
