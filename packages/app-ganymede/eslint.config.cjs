const baseConfig = require('../../eslint.config.cjs');

module.exports = [
  { ignores: ['tests/.venv/**'] },
  ...baseConfig,
];
