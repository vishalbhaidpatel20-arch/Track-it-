import http from 'node:http';
import { initMonitoring, captureError, flushMonitoring } from './monitoring.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { initSocket } from './socket.js';
import { seedIfEmpty } from './seed.js';

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
  await seedIfEmpty();
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
