// Exports every collection to server/backups/<timestamp>/*.json
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDb } from '../src/db.js';

await connectDb();
const dir = path.resolve('backups', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(dir, { recursive: true });
for (const { name } of await mongoose.connection.db.listCollections().toArray()) {
  const docs = await mongoose.connection.db.collection(name).find().toArray();
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(docs, null, 2));
  console.log(`  ${name}: ${docs.length} documents`);
}
console.log(`Backup saved to ${dir}`);
await mongoose.disconnect();
process.exit(0);
