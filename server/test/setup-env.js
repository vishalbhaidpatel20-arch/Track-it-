// Imported first by helpers so config picks these up before anything else loads.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/unused'; // never used; tests start their own database
process.env.SENTRY_DSN = ''; // never report test errors
