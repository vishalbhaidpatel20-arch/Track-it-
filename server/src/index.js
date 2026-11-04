import http from 'node:http';
import { initMonitoring, captureError, flushMonitoring } from './monitoring.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { initSocket } from './socket.js';
import { bootstrapAdmin, seedIfEmpty } from './seed.js';

if (initMonitoring()) console.log('Sentry error monitoring enabled');

// Last-resort handlers: report, then exit on truly fatal errors so a supervisor can restart us.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  captureError(reason instanceof Error ? reason : new Error(String(reason)), { source: 'unhandledRejection' });
});
process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  captureError(err, { source: 'uncaughtException' });
  await flushMonitoring();
  process.exit(1);
});

try {
  await connectDb();
  await bootstrapAdmin(); // first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the database is empty
  if (process.env.SEED_DEMO === 'true' && config.nodeEnv !== 'production') await seedIfEmpty(); // opt-in demo data (used by e2e)
} catch (err) {
  console.error('Startup failed:', err);
  captureError(err, { source: 'startup' });
  await flushMonitoring();
  process.exit(1);
}

const app = createApp();
const server = http.createServer(app);
app.set('io', initSocket(server));

server.listen(config.port, () => console.log(`API + WebSocket listening on http://localhost:${config.port}`));
