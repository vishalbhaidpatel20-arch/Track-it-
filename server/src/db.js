import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from './config.js';

export const DATA_DIR = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/db');
export const DB_PORT = Number(process.env.DB_PORT) || 27017;
export const LOCAL_URI = `mongodb://127.0.0.1:${DB_PORT}/delivery`;

async function reachable(uri) {
  try {
    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 1500 }).asPromise();
    await conn.close();
    return true;
  } catch {
    return false;
  }
}

/** Starts a local MongoDB on a fixed port, storing data in server/data/db. Stays alive with this process. */
export async function startLocalMongo() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return MongoMemoryServer.create({
    instance: { port: DB_PORT, dbPath: DATA_DIR, storageEngine: 'wiredTiger' },
  });
}

/**
 * Connection order:
 *  1. MONGODB_URI (Atlas or any MongoDB you run yourself)
 *  2. a local MongoDB already listening on DB_PORT (e.g. started with `npm run db:start`)
 *  3. otherwise start one here on DB_PORT
 */
export async function connectDb() {
  let uri = config.mongoUri;
  if (!uri) {
    uri = LOCAL_URI;
    if (await reachable(uri)) {
      console.log(`Using local MongoDB on port ${DB_PORT}`);
    } else {
      await startLocalMongo();
      console.log(`Started local MongoDB on port ${DB_PORT} (data: server/data/db)`);
    }
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
