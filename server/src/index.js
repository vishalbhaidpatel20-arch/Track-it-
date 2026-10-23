import http from 'node:http';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { initSocket } from './socket.js';
import { seedIfEmpty } from './seed.js';

await connectDb();
await seedIfEmpty();

const app = createApp();
const server = http.createServer(app);
app.set('io', initSocket(server));

server.listen(config.port, () => console.log(`API + WebSocket listening on http://localhost:${config.port}`));
