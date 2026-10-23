import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/index.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

export async function userFromToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  const user = await User.findById(payload.id);
  if (!user || !user.active) throw new Error('Invalid user');
  return user;
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    req.user = await userFromToken(token);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Forbidden' });
