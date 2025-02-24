const undefinedValues: string[] = [];

const envVars = [
  'FRONTEND_FQDN',
  'ACCOUNT_FQDN',
  'GANYMEDE_FQDN',
  'ALLOWED_ORIGINS',
  'GANYMEDE_SERVER_BIND',
  'JUPYTER_HUB_VERSION',
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

if (undefinedValues.length > 0) {
  throw new Error(
    `The following environment variables are not defined: ${undefinedValues.join(
      ', '
    )}`
  );
}

export { CONFIG };
