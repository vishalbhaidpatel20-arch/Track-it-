import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler } from './middleware/common.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  if (config.nodeEnv !== 'test') app.use(morgan('dev'));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), authRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));
  app.use(errorHandler);
  return app;
}
