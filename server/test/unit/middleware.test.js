import '../setup-env.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import { errorHandler, validate, wrap } from '../../src/middleware/common.js';
import { requireRole, signToken } from '../../src/middleware/auth.js';

const fakeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};

describe('validate()', () => {
  const mw = validate(z.object({ email: z.string().email(), age: z.number().optional() }));

  test('passes valid bodies through and strips unknown fields', () => {
    const req = { body: { email: 'a@b.co', role: 'admin' } };
    let called = false;
    mw(req, fakeRes(), () => (called = true));
    assert.ok(called);
    assert.deepEqual(req.body, { email: 'a@b.co' });
  });

  test('responds 400 with a readable message for invalid bodies', () => {
    const res = fakeRes();
    let called = false;
    mw({ body: { email: 'nope' } }, res, () => (called = true));
    assert.equal(called, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /email/);
  });
});

describe('errorHandler()', () => {
  const run = (err) => {
    const res = fakeRes();
    const orig = console.error;
    console.error = () => {};
    errorHandler(err, {}, res, () => {});
    console.error = orig;
    return res;
  };

  test('maps ZodError to 400', () => assert.equal(run(new ZodError([])).statusCode, 400));
  test('maps invalid ObjectId (CastError) to 400', () => assert.equal(run({ name: 'CastError' }).statusCode, 400));
  test('maps duplicate key errors to 409', () => assert.equal(run({ code: 11000 }).statusCode, 409));
  test('hides internals of unexpected errors', () => {
    const res = run(new Error('db password leaked'));
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Server error');
  });
});

describe('wrap()', () => {
  test('forwards async rejections to next()', async () => {
    const boom = new Error('boom');
    let received;
    await wrap(async () => {
      throw boom;
    })({}, {}, (e) => (received = e));
    assert.equal(received, boom);
  });
});

describe('auth helpers', () => {
  test('signToken embeds id and role and is verifiable', () => {
    const token = signToken({ _id: 'abc123', role: 'agent' });
    const payload = jwt.verify(token, 'test-secret');
    assert.equal(payload.id, 'abc123');
    assert.equal(payload.role, 'agent');
  });

  test('tokens signed with another secret are rejected', () => {
    const forged = jwt.sign({ id: 'x', role: 'admin' }, 'wrong-secret');
    assert.throws(() => jwt.verify(forged, 'test-secret'));
  });

  test('requireRole allows listed roles and blocks others with 403', () => {
    const guard = requireRole('admin', 'agent');
    let ok = false;
    guard({ user: { role: 'agent' } }, fakeRes(), () => (ok = true));
    assert.ok(ok);

    const res = fakeRes();
    let passed = false;
    guard({ user: { role: 'user' } }, res, () => (passed = true));
    assert.equal(passed, false);
    assert.equal(res.statusCode, 403);
  });
});
