import { Notification, Order, StatusLog, User, ACTIVE_STATUSES } from '../models/index.js';

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Promised delivery time: 30 min handling + travel at 25 km/h. */
export const computeDueAt = (distanceKm, from = new Date()) =>
  new Date(from.getTime() + (30 + (distanceKm / 25) * 60) * 60 * 1000);

export async function notify(io, userId, order, title, message) {
  const doc = await Notification.create({ user: userId, order: order?._id, title, message });
  io?.to(`user:${userId}`).emit('notification', doc);
}

export async function notifyAdmins(io, order, title, message) {
  const admins = await User.find({ role: 'admin', active: true }).select('_id');
  await Promise.all(admins.map((a) => notify(io, a._id, order, title, message)));
}

/** Broadcast an order change to everyone who should see it. */
export function broadcastOrder(io, order) {
  const payload = { orderId: String(order._id), status: order.status, agent: order.agent ? String(order.agent) : null };
  io?.to(`order:${order._id}`)
    .to('admin')
    .to(`user:${order.customer}`)
    .emit('order:status', payload);
  if (order.agent) io?.to(`agent:${order.agent}`).emit('order:status', payload);
}

export async function logStatus(order, userId, note) {
  await StatusLog.create({ order: order._id, status: order.status, changedBy: userId, note });
}

export async function releaseAgentIfIdle(agentId) {
  if (!agentId) return;
  const busy = await Order.exists({ agent: agentId, status: { $in: ACTIVE_STATUSES } });
  if (!busy) await User.updateOne({ _id: agentId }, { available: true });
}
