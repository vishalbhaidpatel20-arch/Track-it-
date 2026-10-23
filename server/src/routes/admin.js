import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Order, User, ACTIVE_STATUSES } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/common.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const createUserSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  phone: z.string().max(20).optional(),
  role: z.enum(['user', 'agent', 'admin']),
});

const updateUserSchema = z.object({
  role: z.enum(['user', 'agent', 'admin']).optional(),
  active: z.boolean().optional(),
  name: z.string().min(2).max(80).optional(),
  phone: z.string().max(20).optional(),
});

router.get(
  '/users',
  wrap(async (req, res) => {
    const filter = req.query.role ? { role: req.query.role } : {};
    const users = await User.find(filter).sort('-createdAt');
    res.json({ users });
  })
);

router.post(
  '/users',
  validate(createUserSchema),
  wrap(async (req, res) => {
    const { password, ...rest } = req.body;
    const user = await User.create({ ...rest, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ user });
  })
);

router.patch(
  '/users/:id',
  validate(updateUserSchema),
  wrap(async (req, res) => {
    if (String(req.user._id) === req.params.id && (req.body.active === false || (req.body.role && req.body.role !== 'admin'))) {
      return res.status(400).json({ message: 'You cannot demote or deactivate yourself' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  })
);

// Orders in progress with their agent's latest position, for the live map.
router.get(
  '/live',
  wrap(async (req, res) => {
    const orders = await Order.find({ status: { $in: ['Placed', ...ACTIVE_STATUSES] }, agent: { $ne: null } })
      .populate('customer', 'name')
      .populate('agent', 'name currentLocation');
    res.json({ orders });
  })
);

router.get(
  '/reports',
  wrap(async (req, res) => {
    const orders = await Order.find().populate('agent', 'name').lean();
    const byStatus = {};
    for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

    const delivered = orders.filter((o) => o.status === 'Delivered' && o.deliveredAt);
    const onTime = delivered.filter((o) => o.dueAt && o.deliveredAt <= o.dueAt).length;
    const durations = delivered.filter((o) => o.pickedUpAt).map((o) => (o.deliveredAt - o.pickedUpAt) / 60000);
    const avgDeliveryMinutes = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const rated = delivered.filter((o) => o.rating);
    const csat = rated.length ? rated.reduce((a, o) => a + o.rating, 0) / rated.length : 0;

    // Tracking accuracy: share of in-flight deliveries whose agent reported a position in the last 2 minutes.
    const inFlight = await Order.find({ status: { $in: ACTIVE_STATUSES } }).populate('agent', 'currentLocation');
    const fresh = inFlight.filter((o) => o.agent?.currentLocation?.updatedAt > Date.now() - 2 * 60 * 1000).length;

    // Orders per day, last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ date: d, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), orders: 0, delivered: 0 });
    }
    for (const o of orders) {
      const day = days.find((d) => o.createdAt >= d.date && o.createdAt < new Date(d.date.getTime() + 86400000));
      if (day) {
        day.orders++;
        if (o.status === 'Delivered') day.delivered++;
      }
    }

    const perAgent = {};
    for (const o of delivered) {
      if (!o.agent) continue;
      const a = (perAgent[o.agent._id] ||= { name: o.agent.name, delivered: 0, onTime: 0, totalMin: 0, withTime: 0 });
      a.delivered++;
      if (o.dueAt && o.deliveredAt <= o.dueAt) a.onTime++;
      if (o.pickedUpAt) {
        a.totalMin += (o.deliveredAt - o.pickedUpAt) / 60000;
        a.withTime++;
      }
    }
    const agents = Object.values(perAgent).map((a) => ({
      name: a.name,
      delivered: a.delivered,
      onTimeRate: Math.round((a.onTime / a.delivered) * 100),
      avgMinutes: a.withTime ? Math.round(a.totalMin / a.withTime) : 0,
    }));

    res.json({
      totalOrders: orders.length,
      activeDeliveries: inFlight.length,
      byStatus,
      onTimeRate: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
      avgDeliveryMinutes: Math.round(avgDeliveryMinutes),
      trackingAccuracy: inFlight.length ? Math.round((fresh / inFlight.length) * 100) : 100,
      csat: Math.round(csat * 10) / 10,
      ratingCount: rated.length,
      daily: days.map(({ label, orders: o, delivered: d }) => ({ label, orders: o, delivered: d })),
      agents,
    });
  })
);

export default router;
