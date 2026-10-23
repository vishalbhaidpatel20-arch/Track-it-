import { Router } from 'express';
import { Notification } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap } from '../middleware/common.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  wrap(async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id }).sort('-createdAt').limit(50);
    res.json({ notifications });
  })
);

router.patch(
  '/read-all',
  wrap(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ ok: true });
  })
);

export default router;
