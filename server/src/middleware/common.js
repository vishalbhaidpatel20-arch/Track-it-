import { ZodError } from 'zod';

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
  if (err instanceof ZodError) return res.status(400).json({ message: err.message });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err.code === 11000) return res.status(409).json({ message: 'Already exists' });
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Server error' });
}
