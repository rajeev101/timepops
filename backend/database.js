const { Pool } = require('pg');
let pool;
function database() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('PostgreSQL is not configured');
    error.status = 503;
    error.code = 'database_unavailable';
    throw error;
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
  }
  return pool;
}
module.exports = { database };
