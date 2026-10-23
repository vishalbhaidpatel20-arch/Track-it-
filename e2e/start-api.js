// Starts the real API on its own port with a brand-new database, so e2e runs never touch your data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbDir = path.join(root, 'server', 'data', 'e2e-db');

fs.rmSync(dbDir, { recursive: true, force: true });

Object.assign(process.env, {
  PORT: '5055',
  DB_PORT: '27099',
  DB_PATH: dbDir,
  MONGODB_URI: '',
  JWT_SECRET: 'e2e-secret',
  CLIENT_ORIGIN: 'http://localhost:5174',
  SENTRY_DSN: '',
});

await import(pathToFileURL(path.join(root, 'server', 'src', 'index.js')).href);
