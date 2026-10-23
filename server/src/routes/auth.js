import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate, wrap } from '../middleware/common.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  phone: z.string().max(20).optional(),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone });

router.post(
  '/register',
  validate(registerSchema),
  wrap(async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (await User.exists({ email: email.toLowerCase() })) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    // Public sign-up always creates a customer; agents/admins are created by an admin.
    const user = await User.create({ name, email, phone, password: await bcrypt.hash(password, 10), role: 'user' });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  validate(loginSchema),
  wrap(async (req, res) => {
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password');
    if (!user || !user.active || !(await bcrypt.compare(req.body.password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
