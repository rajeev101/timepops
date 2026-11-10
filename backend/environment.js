const path = require('node:path');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw new Error('Backend environment file could not be loaded');
  }
}
