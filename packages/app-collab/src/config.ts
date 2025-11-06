const undefinedValues: string[] = [];

const envVars = [
  'GATEWAY_ID',
  'GATEWAY_TOKEN',
  'GATEWAY_HMAC_SECRET',
  'SERVER_BIND',
  'GANYMEDE_FQDN',
  'SCRIPTS_DIR',
] as const;

type EnvVars = (typeof envVars)[number];

const CONFIG: Record<EnvVars, string> = {} as Record<EnvVars, string>;

envVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    CONFIG[varName] = value;
  } else {
    undefinedValues.push(varName);
  }
});

// Optional env vars (with defaults)
const DATA_DIR = process.env.DATA_DIR || '/data';

if (undefinedValues.length > 0) {
  throw new Error(
    `The following environment variables are not defined: ${undefinedValues.join(
      ', '
    )}`
  );
}

console.log('CONFIG', CONFIG);

export { CONFIG, DATA_DIR };
