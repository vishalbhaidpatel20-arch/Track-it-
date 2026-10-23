// Restores a backup:  npm run db:restore -- backups/<folder> --yes   (replaces current data)
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import { connectDb } from '../src/db.js';

const [dir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!dir || !process.argv.includes('--yes')) {
  console.log('Usage: npm run db:restore -- <backup folder> --yes   (this REPLACES all current data)');
  process.exit(1);
}
await connectDb();
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const name = path.basename(file, '.json');
  const docs = EJSON.deserialize(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  const col = mongoose.connection.db.collection(name);
  await col.deleteMany({});
  if (docs.length) await col.insertMany(docs);
  console.log(`  ${name}: ${docs.length} documents restored`);
}
await mongoose.disconnect();
process.exit(0);
