import '../setup-env.js';
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { captureError, initMonitoring, monitoringEnabled, setReporter } from '../../src/monitoring.js';
import { errorHandler } from '../../src/middleware/common.js';

const fakeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};

let reported;
let origError;
beforeEach(() => {
  reported = [];
  setReporter((err, ctx) => reported.push({ err, ctx }));
  origError = console.error;
  console.error = () => {};
});
afterEach(() => {
  setReporter(null);
  console.error = origError;
});

describe('monitoring setup', () => {
  test('is disabled (and harmless) without a SENTRY_DSN', () => {
    assert.equal(initMonitoring(), false);
    assert.equal(monitoringEnabled(), false);
    setReporter(null);
    assert.doesNotThrow(() => captureError(new Error('ignored')));
  });

  test('a failing reporter can never break the app', () => {
    setReporter(() => {
      throw new Error('sentry is down');
    });
    assert.doesNotThrow(() => captureError(new Error('x')));
  });
});

describe('errorHandler reporting', () => {
  test('unexpected errors are reported with request context and hidden from the client', () => {
    const boom = new Error('database exploded');
    const res = fakeRes();
    errorHandler(boom, { method: 'POST', originalUrl: '/api/orders', user: { _id: 'u1' } }, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Server error');
    assert.equal(reported.length, 1);
    assert.equal(reported[0].err, boom);
    assert.deepEqual(reported[0].ctx, { method: 'POST', url: '/api/orders', userId: 'u1' });
  });

  test('expected client errors are not reported', () => {
    for (const err of [{ name: 'CastError' }, { code: 11000 }, { type: 'entity.parse.failed' }, { type: 'entity.too.large' }]) {
      errorHandler(err, {}, fakeRes(), () => {});
    }
    assert.equal(reported.length, 0);
  });

  test('malformed JSON and oversized bodies get clear 4xx answers', () => {
    const bad = fakeRes();
    errorHandler({ type: 'entity.parse.failed' }, {}, bad, () => {});
    assert.equal(bad.statusCode, 400);
    const big = fakeRes();
    errorHandler({ type: 'entity.too.large' }, {}, big, () => {});
    assert.equal(big.statusCode, 413);
  });

  test('errors carrying a 4xx status keep their message and are not reported', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('Nope'), { status: 403 }), {}, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'Nope');
    assert.equal(reported.length, 0);
  });
});
