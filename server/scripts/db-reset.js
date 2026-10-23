// Wipes all data and re-seeds the demo accounts:  npm run db:reset -- --yes
import mongoose from 'mongoose';
import { connectDb } from '../src/db.js';
import { seedIfEmpty } from '../src/seed.js';

if (!process.argv.includes('--yes')) {
  console.log('This deletes ALL data. Re-run with --yes to confirm:  npm run db:reset -- --yes');
  process.exit(1);
}
await connectDb();
await mongoose.connection.dropDatabase();
await seedIfEmpty();
await mongoose.disconnect();
process.exit(0);
