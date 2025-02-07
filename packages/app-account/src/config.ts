const undefinedValues: string[] = [];
const CONFIG: { [k: string]: string } = {};

const envVars = [
  'ACCOUNT_FQDN',
  'GANYMEDE_FQDN',
  'FRONTEND_FQDN',
  'JWT_PUBLIC_KEY',
  'ALLOWED_ORIGINS',
  'ACCOUNT_SERVER_BIND',
  'PG_HOST',
  'PG_PORT',
  'PG_DATABASE',
  'PG_USER',
  'PG_PASSWORD',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITLAB_CLIENT_ID',
  'GITLAB_CLIENT_SECRET',
  'MAILING_HOST',
  'MAILING_PORT',
  'MAILING_USER',
  'MAILING_PASSWORD',
  'SESSION_COOKIE_KEY',
];

envVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    CONFIG[varName] = value;
  } else {
    undefinedValues.push(varName);
  }
});

if (undefinedValues.length > 0) {
  throw new Error(
    `The following environment variables are not defined: ${undefinedValues.join(
      ', '
    )}`
  );
}

CONFIG['APP_ACCOUNT_URL'] = `https://${CONFIG.ACCOUNT_FQDN}`;

CONFIG['APP_FRONTEND_URL'] = `https://${CONFIG.FRONTEND_FQDN}`;

CONFIG['APP_FRONTEND_URL_DEV'] = `https://frontend.${CONFIG.FRONTEND_FQDN}`;

CONFIG['LOGIN_PAGE_URL'] = `${CONFIG.APP_FRONTEND_URL}/account/login`;

CONFIG[
  'MAGIC_LINK_FAILED_URL'
] = `${CONFIG.APP_FRONTEND_URL}/account/link-failed`;

CONFIG['MAGILINK_SECRET'] = CONFIG.SESSION_COOKIE_KEY; // cause why not

export { CONFIG };
