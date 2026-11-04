// Usage: npm run admin:create -- <email> <password> [name]
// Creates (or promotes/resets) an admin account in the configured database.
import bcrypt from 'bcryptjs';
import { connectDb } from '../src/db.js';
import { User } from '../src/models/index.js';

const [email, password, name = 'Admin'] = process.argv.slice(2);
if (!email || !password || password.length < 6) {
  console.error('Usage: npm run admin:create -- <email> <password (min 6)> [name]');
  process.exit(1);
}
await connectDb();
const hash = await bcrypt.hash(password, 10);
await User.findOneAndUpdate(
  { email: email.toLowerCase() },
  { name, email, password: hash, role: 'admin', active: true, approval: 'approved' },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);
console.log(`Admin ready: ${email}`);
process.exit(0);
