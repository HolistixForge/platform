const undefinedValues: string[] = [];

const envVars = [
  'GATEWAY_TOKEN',
  'SERVER_BIND',
  'GANYMEDE_FQDN',
  'SCRIPTS_DIR',
  'GATEWAY_FQDN',
  'NOTION_API_KEY',
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

console.log('CONFIG', CONFIG);

export { CONFIG };
