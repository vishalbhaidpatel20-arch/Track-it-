import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setReporter } from '../../src/monitoring.js';
import { startTestServer } from '../helpers.js';

let t, admin;
before(async () => {
  t = await startTestServer();
  admin = await t.makeUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
});
after(() => t.stop());

describe('error handling over HTTP', () => {
  test('malformed JSON returns 400 JSON, not a stack trace', async () => {
    const res = await t.api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid JSON body');
  });

  test('oversized bodies are refused with 413', async () => {
    const res = await t.api().post('/api/auth/register').send({ name: 'x'.repeat(200_000), email: 'a@b.co', password: 'secret12' });
    assert.equal(res.status, 413);
  });

  test('a server crash inside a route is reported once and the client only sees a generic message', async () => {
    const reports = [];
    setReporter((err, ctx) => reports.push({ err, ctx }));
    const origError = console.error;
    console.error = () => {};

    // Force a real failure deep in a route: break the database call used by the users listing.
    const { User } = await import('../../src/models/index.js');
    const original = User.find;
    User.find = () => {
      throw new Error('simulated database outage');
    };
    try {
      const res = await t.api().get('/api/admin/users').set(admin.auth);
      assert.equal(res.status, 500);
      assert.deepEqual(res.body, { message: 'Server error' });
    } finally {
      User.find = original;
      setReporter(null);
      console.error = origError;
    }

    assert.equal(reports.length, 1);
    assert.match(reports[0].err.message, /simulated database outage/);
    assert.equal(reports[0].ctx.url, '/api/admin/users');
    assert.equal(reports[0].ctx.userId, String(admin.user._id));
  });

  test('the API keeps serving after an error', async () => {
    assert.equal((await t.api().get('/api/health')).status, 200);
  });
});
