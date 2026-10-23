import { Server } from 'socket.io';
import { config } from './config.js';
import { userFromToken } from './middleware/auth.js';
import { Location, Order, User, ACTIVE_STATUSES } from './models/index.js';

const PERSIST_EVERY_MS = 5000;

export function initSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: config.clientOrigin, credentials: true } });

  io.use(async (socket, next) => {
    try {
      socket.data.user = await userFromToken(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const lastSaved = new Map(); // orderId -> timestamp of last persisted ping
    socket.join(`user:${user._id}`);
    if (user.role === 'admin') socket.join('admin');
    if (user.role === 'agent') socket.join(`agent:${user._id}`);

    // Join the live room of one order (customer, its agent, or admin only).
    socket.on('order:join', async (orderId, ack) => {
      try {
        const order = await Order.findById(orderId);
        const ok =
          order &&
          (user.role === 'admin' ||
            String(order.customer) === String(user._id) ||
            String(order.agent) === String(user._id));
        if (!ok) return ack?.({ ok: false });
        socket.join(`order:${orderId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('order:leave', (orderId) => socket.leave(`order:${orderId}`));

    // Agents stream their GPS position; it is relayed to every active order they carry.
    socket.on('location:update', async ({ lat, lng } = {}) => {
      if (user.role !== 'agent') return;
      if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      const at = new Date();
      await User.updateOne({ _id: user._id }, { currentLocation: { lat, lng, updatedAt: at } });
      const orders = await Order.find({ agent: user._id, status: { $in: ACTIVE_STATUSES } }).select('_id');
      for (const o of orders) {
        const payload = { orderId: String(o._id), agentId: String(user._id), lat, lng, at };
        io.to(`order:${o._id}`).to('admin').emit('location:update', payload);
        const key = String(o._id);
        if (!lastSaved.has(key) || at - lastSaved.get(key) >= PERSIST_EVERY_MS) {
          lastSaved.set(key, at.getTime());
          await Location.create({ order: o._id, agent: user._id, lat, lng });
        }
      }
      // Admin map also tracks agents with an assigned (not yet picked-up) order.
      io.to('admin').emit('agent:location', { agentId: String(user._id), lat, lng, at });
    });
  });

  return io;
}
