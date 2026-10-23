// Prints a summary of what is in the database (password hashes hidden).
import mongoose from 'mongoose';
import { connectDb } from '../src/db.js';
import { Notification, Location, Order, StatusLog, User } from '../src/models/index.js';

await connectDb();
console.log(`\nDatabase: ${mongoose.connection.name}`);
for (const [name, Model] of Object.entries({ users: User, orders: Order, statuslogs: StatusLog, locations: Location, notifications: Notification })) {
  console.log(`  ${name.padEnd(14)} ${await Model.countDocuments()}`);
}
console.table((await User.find().lean()).map((u) => ({ name: u.name, email: u.email, role: u.role, active: u.active })));
console.table((await Order.find().sort('-createdAt').limit(10).lean()).map((o) => ({ orderId: o.orderId, status: o.status, to: o.drop.address })));
await mongoose.disconnect();
process.exit(0);
