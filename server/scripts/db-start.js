// Runs MongoDB on its own, so the database stays up while you restart the API.
import { startLocalMongo, DB_PORT, LOCAL_URI } from '../src/db.js';

await startLocalMongo();
console.log(`MongoDB running on port ${DB_PORT}\nConnect with: ${LOCAL_URI}\nPress Ctrl+C to stop.`);
setInterval(() => {}, 1 << 30); // keep the process alive
