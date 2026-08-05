const undefinedValues: string[] = [];

const envVars = [
  // Domains
  'FRONTEND_FQDN',
  'GANYMEDE_FQDN',
  // Server
  'GANYMEDE_SERVER_BIND',
  'ALLOWED_ORIGINS',
  // Database
  'PG_HOST',
  'PG_PORT',
  'PG_DATABASE',
  'PG_USER',
  'PG_PASSWORD',
  // JWT
  'JWT_PUBLIC_KEY',
  'JWT_PRIVATE_KEY',
  // OAuth Providers
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITLAB_CLIENT_ID',
  'GITLAB_CLIENT_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  // Email
  'MAILING_HOST',
  'MAILING_PORT',
  'MAILING_USER',
  'MAILING_PASSWORD',
  // Session
  'SESSION_COOKIE_KEY',
] as const;

// Optional environment variables (have sensible defaults for testing)
const optionalEnvVars = [
  // Credentials Wallet Encryption (defaults to test key if not set)
  'CREDENTIALS_ENCRYPTION_KEY',
  // GitHub App, used to pull project container images from GHCR.
  //
  // Optional because a deployment that only runs built-in images needs none of
  // it — those are ours and carry no tenant credential. The internal image
  // route answers 503 rather than half-working when they are absent.
  'GITHUB_APP_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_SLUG',
] as const;

type EnvVars = (typeof envVars)[number];
type OptionalEnvVars = (typeof optionalEnvVars)[number];

type ExtraKeys =
  | 'APP_GANYMEDE_URL'
  | 'APP_FRONTEND_URL'
  | 'APP_FRONTEND_URL_DEV'
  | 'LOGIN_PAGE_URL'
  | 'MAGIC_LINK_FAILED_URL'
  | 'MAGILINK_SECRET';

const CONFIG: Record<EnvVars | OptionalEnvVars | ExtraKeys, string> =
  {} as Record<EnvVars | OptionalEnvVars | ExtraKeys, string>;

envVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    CONFIG[varName] = value;
  } else {
    undefinedValues.push(varName);
  }
});

// Process optional env vars with defaults
const optionalDefaults: Record<OptionalEnvVars, string> = {
  // Default key for testing only - MUST be overridden in production
  CREDENTIALS_ENCRYPTION_KEY: 'test-encryption-key-not-for-production-use',
  // No defaults: a placeholder App id would turn "not configured" into a
  // confusing 401 from GitHub instead of an honest 503 from us.
  GITHUB_APP_ID: '',
  GITHUB_APP_PRIVATE_KEY: '',
  GITHUB_APP_SLUG: '',
};

optionalEnvVars.forEach((varName) => {
  const value = process.env[varName];
  CONFIG[varName] = value || optionalDefaults[varName];
});

if (undefinedValues.length > 0) {
  throw new Error(
    `The following environment variables are not defined: ${undefinedValues.join(
      ', '
    )}`
  );
}

// Derived config values
CONFIG['APP_GANYMEDE_URL'] = `https://${CONFIG.GANYMEDE_FQDN}`;
CONFIG['APP_FRONTEND_URL'] = `https://${CONFIG.FRONTEND_FQDN}`;
CONFIG['APP_FRONTEND_URL_DEV'] = `https://frontend.${CONFIG.FRONTEND_FQDN}`;
CONFIG['LOGIN_PAGE_URL'] = `${CONFIG.APP_FRONTEND_URL}/account/login`;
CONFIG[
  'MAGIC_LINK_FAILED_URL'
] = `${CONFIG.APP_FRONTEND_URL}/account/link-failed`;
CONFIG['MAGILINK_SECRET'] = CONFIG.SESSION_COOKIE_KEY;

export { CONFIG };
