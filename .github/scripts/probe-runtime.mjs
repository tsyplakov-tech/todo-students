import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const { HOST, PORT, API_TOKEN, DATABASE_URL } = process.env;
const address = { '0.0.0.0': '127.0.0.1', '::': '::1' }[HOST] ?? HOST;
const hostname = address.includes(':') ? `[${address}]` : address;
const baseUrl = `http://${hostname}:${PORT}`;

for (let attempt = 1; ; attempt++) {
  try {
    const response = await fetch(`${baseUrl}/login/`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error(`Startup check returned HTTP ${response.status}`);
    break;
  } catch (error) {
    if (error.cause?.code !== 'ECONNREFUSED') throw error;
    if (attempt === 10) throw new Error('The application did not start on the configured HOST and PORT');
    await delay(500);
  }
}

const response = await fetch(`${baseUrl}/api/tasks/?runId=ci_runtime`, {
  headers: { Authorization: `Bearer ${API_TOKEN}` },
  signal: AbortSignal.timeout(10000),
});

if (response.status === 503) {
  const client = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 3000, query_timeout: 3000 });
  let operation = 'connection';
  try {
    await client.connect();
    operation = 'read from todo.tasks';
    await client.query('SELECT id, owner_login, title, done, run_id, created_at FROM todo.tasks WHERE false');
  } catch (error) {
    const code = /^[A-Z0-9_]{1,40}$/.test(error.code ?? '') ? error.code : 'UNKNOWN';
    throw new Error(`API returned HTTP 503. PostgreSQL ${operation} failed (${code}).`);
  } finally {
    await client.end();
  }
  throw new Error('API returned HTTP 503. Direct PostgreSQL connection and read permissions passed.');
}

if (!response.ok) throw new Error(`Application database check returned HTTP ${response.status}`);
if (!Array.isArray(await response.json())) throw new Error('The tasks endpoint did not return an array');
console.log('Application and PostgreSQL check passed');
