require('./environment');
const app = require('./app');

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`BharatShikshak API listening on http://127.0.0.1:${port}/api`);
});

server.on('error', error => {
  console.error(`Unable to start BharatShikshak API: ${error.message}`);
  process.exitCode = 1;
});
