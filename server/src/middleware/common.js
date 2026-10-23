import { ZodError } from 'zod';
import { captureError } from '../monitoring.js';

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
  }
  req.body = result.data;
  next();
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Expected client errors: answer them, do not report them.
  if (err instanceof ZodError) return res.status(400).json({ message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err.code === 11000) return res.status(409).json({ message: 'Already exists' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large' });

  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
    captureError(err, { method: req.method, url: req.originalUrl, userId: req.user ? String(req.user._id) : undefined });
  }
  res.status(status).json({ message: status < 500 && err.message ? err.message : 'Server error' });
}
