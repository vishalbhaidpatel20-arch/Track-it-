import bcrypt from 'bcryptjs';
import { Order, User } from './models/index.js';
import { computeDueAt, haversineKm } from './services/orders.js';
import { StatusLog } from './models/index.js';

const DEMO_PASSWORD = 'password123';

const places = {
  cp: { address: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167 },
  indiaGate: { address: 'India Gate, New Delhi', lat: 28.6129, lng: 77.2295 },
  saket: { address: 'Select Citywalk, Saket, New Delhi', lat: 28.5286, lng: 77.2193 },
  hauz: { address: 'Hauz Khas Village, New Delhi', lat: 28.5494, lng: 77.1944 },
  karol: { address: 'Karol Bagh, New Delhi', lat: 28.6519, lng: 77.1909 },
};

/** Inserts demo accounts and a few sample orders when the database is empty. */
export async function seedIfEmpty() {
  if (await User.exists({})) return;
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [admin, agent1, agent2, customer] = await User.create([
    { name: 'Admin', email: 'admin@demo.com', password, role: 'admin' },
    { name: 'Ravi Agent', email: 'agent1@demo.com', password, role: 'agent', phone: '9000000001', currentLocation: { ...places.cp, updatedAt: new Date() } },
    { name: 'Sana Agent', email: 'agent2@demo.com', password, role: 'agent', phone: '9000000002' },
    { name: 'Demo Customer', email: 'user@demo.com', password, role: 'user', phone: '9000000003' },
  ]);

  const make = async (pickup, drop, description, extra = {}) => {
    const d = haversineKm(pickup, drop);
    const order = await Order.create({
      customer: customer._id,
      pickup,
      drop,
      packageDescription: description,
      distanceKm: Math.round(d * 10) / 10,
      dueAt: computeDueAt(d),
      ...extra,
    });
    await StatusLog.create({ order: order._id, status: 'Placed', changedBy: customer._id, note: 'Order placed' });
    return order;
  };

  await make(places.cp, places.saket, 'Documents envelope');
  const delivered = await make(places.karol, places.hauz, 'Birthday gift', {
    agent: agent1._id,
    status: 'Delivered',
    pickedUpAt: new Date(Date.now() - 3 * 3600e3),
    deliveredAt: new Date(Date.now() - 2.5 * 3600e3),
    rating: 5,
    feedback: 'Quick and careful!',
  });
  await StatusLog.create({ order: delivered._id, status: 'Delivered', changedBy: agent1._id });
  console.log(`Seeded demo data. Accounts: admin@demo.com, agent1@demo.com, agent2@demo.com, user@demo.com / ${DEMO_PASSWORD}`);
  return { admin, agent2 };
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('seed.js')) {
  const { connectDb } = await import('./db.js');
  await connectDb();
  await seedIfEmpty();
  process.exit(0);
}
