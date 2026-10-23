import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from './config.js';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/db');

export async function connectDb() {
  let uri = config.mongoUri;
  if (!uri) {
    // No MONGODB_URI: run a local embedded MongoDB so the app works out of the box.
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    fs.mkdirSync(dataDir, { recursive: true });
    const mongod = await MongoMemoryServer.create({
      instance: { dbPath: dataDir, storageEngine: 'wiredTiger' },
    });
    uri = mongod.getUri('delivery');
    console.log('Using embedded MongoDB (set MONGODB_URI to use your own)');
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
