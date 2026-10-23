import { Router } from 'express';
import { z } from 'zod';
import { Order, StatusLog, User } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/common.js';
import {
  broadcastOrder,
  computeDueAt,
  haversineKm,
  logStatus,
  notify,
  notifyAdmins,
  releaseAgentIfIdle,
} from '../services/orders.js';

const router = Router();
router.use(requireAuth);

const pointSchema = z.object({
  address: z.string().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const createSchema = z.object({
  pickup: pointSchema,
  drop: pointSchema,
  packageDescription: z.string().min(2).max(300),
  notes: z.string().max(500).optional(),
});

// Agents move an order forward one step at a time.
const NEXT_STATUS = { Placed: 'Picked-up', 'Picked-up': 'In-Transit', 'In-Transit': 'Delivered' };

const populate = (q) => q.populate('customer', 'name email phone').populate('agent', 'name phone available currentLocation');

async function loadAuthorized(req, res) {
  const order = await populate(Order.findById(req.params.id));
  if (!order) {
    res.status(404).json({ message: 'Order not found' });
    return null;
  }
  const { user } = req;
  const allowed =
    user.role === 'admin' ||
    String(order.customer._id) === String(user._id) ||
    (order.agent && String(order.agent._id) === String(user._id));
  if (!allowed) {
    res.status(403).json({ message: 'Forbidden' });
    return null;
  }
  return order;
}

router.post(
  '/',
  requireRole('user'),
  validate(createSchema),
  wrap(async (req, res) => {
    const distanceKm = haversineKm(req.body.pickup, req.body.drop);
    const order = await Order.create({
      ...req.body,
      customer: req.user._id,
      distanceKm: Math.round(distanceKm * 10) / 10,
      dueAt: computeDueAt(distanceKm),
    });
    await logStatus(order, req.user._id, 'Order placed');
    const io = req.app.get('io');
    await notifyAdmins(io, order, 'New order', `${order.orderId} was placed by ${req.user.name}`);
    io?.to('admin').emit('order:new', { orderId: String(order._id) });
    res.status(201).json({ order });
  })
);

router.get(
  '/',
  wrap(async (req, res) => {
    const filter = {};
    if (req.user.role === 'user') filter.customer = req.user._id;
    if (req.user.role === 'agent') filter.agent = req.user._id;
    if (req.query.status) filter.status = req.query.status;
    const orders = await populate(Order.find(filter).sort('-createdAt').limit(500));
    res.json({ orders });
  })
);

router.get(
  '/:id',
  wrap(async (req, res) => {
    const order = await loadAuthorized(req, res);
    if (!order) return;
    const logs = await StatusLog.find({ order: order._id }).sort('createdAt').populate('changedBy', 'name role');
    res.json({ order, logs });
  })
);

router.patch(
  '/:id/assign',
  requireRole('admin'),
  validate(z.object({ agentId: z.string().min(1) })),
  wrap(async (req, res) => {
    const order = await populate(Order.findById(req.params.id));
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Placed') return res.status(400).json({ message: 'Only placed orders can be (re)assigned' });
    const agent = await User.findOne({ _id: req.body.agentId, role: 'agent', active: true });
    if (!agent) return res.status(400).json({ message: 'Agent not found' });

    const previousAgent = order.agent?._id;
    order.agent = agent._id;
    order.assignedAt = new Date();
    await order.save();
    await logStatus(order, req.user._id, `Assigned to ${agent.name}`);

    const io = req.app.get('io');
    await notify(io, agent._id, order, 'New delivery', `${order.orderId} has been assigned to you`);
    await notify(io, order.customer._id, order, 'Agent assigned', `${agent.name} will deliver ${order.orderId}`);
    if (previousAgent && String(previousAgent) !== String(agent._id)) {
      await notify(io, previousAgent, order, 'Delivery reassigned', `${order.orderId} was reassigned`);
    }
    broadcastOrder(io, order);
    res.json({ order: await populate(Order.findById(order._id)) });
  })
);

router.patch(
  '/:id/status',
  requireRole('agent', 'admin'),
  validate(z.object({ status: z.enum(['Picked-up', 'In-Transit', 'Delivered']) })),
  wrap(async (req, res) => {
    const order = await populate(Order.findById(req.params.id));
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.agent) return res.status(400).json({ message: 'Assign an agent first' });
    if (req.user.role === 'agent' && String(order.agent._id) !== String(req.user._id)) {
      return res.status(403).json({ message: 'This order is not assigned to you' });
    }
    if (NEXT_STATUS[order.status] !== req.body.status) {
      return res.status(400).json({ message: `Cannot move from ${order.status} to ${req.body.status}` });
    }

    order.status = req.body.status;
    if (order.status === 'Picked-up') order.pickedUpAt = new Date();
    if (order.status === 'Delivered') order.deliveredAt = new Date();
    await order.save();
    await logStatus(order, req.user._id);

    if (order.status === 'Picked-up') await User.updateOne({ _id: order.agent._id }, { available: false });
    if (order.status === 'Delivered') await releaseAgentIfIdle(order.agent._id);

    const io = req.app.get('io');
    await notify(io, order.customer._id, order, `Order ${order.status}`, `${order.orderId} is now ${order.status}`);
    broadcastOrder(io, order);
    res.json({ order });
  })
);

router.patch(
  '/:id/cancel',
  wrap(async (req, res) => {
    const order = await loadAuthorized(req, res);
    if (!order) return;
    const isOwner = String(order.customer._id) === String(req.user._id);
    if (req.user.role === 'agent') return res.status(403).json({ message: 'Forbidden' });
    if (isOwner && req.user.role === 'user' && order.status !== 'Placed') {
      return res.status(400).json({ message: 'Order can no longer be cancelled' });
    }
    if (['Delivered', 'Cancelled'].includes(order.status)) {
      return res.status(400).json({ message: `Order already ${order.status}` });
    }
    const agentId = order.agent?._id;
    order.status = 'Cancelled';
    await order.save();
    await logStatus(order, req.user._id, 'Order cancelled');
    await releaseAgentIfIdle(agentId);

    const io = req.app.get('io');
    if (agentId) await notify(io, agentId, order, 'Delivery cancelled', `${order.orderId} was cancelled`);
    if (!isOwner) await notify(io, order.customer._id, order, 'Order cancelled', `${order.orderId} was cancelled`);
    broadcastOrder(io, order);
    res.json({ order });
  })
);

router.post(
  '/:id/rate',
  requireRole('user'),
  validate(z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().max(500).optional() })),
  wrap(async (req, res) => {
    const order = await loadAuthorized(req, res);
    if (!order) return;
    if (order.status !== 'Delivered') return res.status(400).json({ message: 'Only delivered orders can be rated' });
    if (order.rating) return res.status(400).json({ message: 'Already rated' });
    order.rating = req.body.rating;
    order.feedback = req.body.feedback;
    await order.save();
    res.json({ order });
  })
);

export default router;
