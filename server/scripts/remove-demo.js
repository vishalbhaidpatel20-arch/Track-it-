// Removes the seeded demo accounts (and the orders/notifications that belong to them) from the configured database.
import { connectDb } from '../src/db.js';
import { Location, Notification, Order, StatusLog, User } from '../src/models/index.js';

await connectDb();
const demo = await User.find({ email: /@demo\.com$/i }, '_id');
const ids = demo.map((u) => u._id);
const orders = await Order.find({ $or: [{ customer: { $in: ids } }, { agent: { $in: ids } }] }, '_id');
const oids = orders.map((o) => o._id);
await Promise.all([
  Location.deleteMany({ order: { $in: oids } }),
  StatusLog.deleteMany({ order: { $in: oids } }),
  Notification.deleteMany({ $or: [{ user: { $in: ids } }, { order: { $in: oids } }] }),
]);
await Order.deleteMany({ _id: { $in: oids } });
await User.deleteMany({ _id: { $in: ids } });
console.log(`Removed ${ids.length} demo users and ${oids.length} orders`);
process.exit(0);
