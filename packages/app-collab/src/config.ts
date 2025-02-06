const undefinedValues: string[] = [];
const CONFIG: { [k: string]: string } = {};

const envVars = [
  'GATEWAY_TOKEN',
  'SERVER_BIND',
  'GANYMEDE_FQDN',
  'SCRIPTS_DIR',
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

export { CONFIG };
