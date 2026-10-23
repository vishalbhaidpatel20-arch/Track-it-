import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../../src/models/index.js';
import { bootstrapAdmin } from '../../src/seed.js';
import { startTestServer } from '../helpers.js';

let t;
before(async () => {
  t = await startTestServer();
});
after(() => t.stop());
beforeEach(async () => {
  await User.deleteMany({});
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_NAME;
});

describe('first-admin bootstrap (production)', () => {
  test('creates one admin from the environment, who can sign in', async () => {
    Object.assign(process.env, { ADMIN_EMAIL: 'owner@company.com', ADMIN_PASSWORD: 'a-long-password', ADMIN_NAME: 'The Owner' });
    await bootstrapAdmin();
    assert.equal(await User.countDocuments(), 1);

    const res = await t.api().post('/api/auth/login').send({ email: 'owner@company.com', password: 'a-long-password' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'admin');
    assert.equal(res.body.user.name, 'The Owner');
  });

  test('does nothing when users already exist', async () => {
    await t.makeUser({ name: 'Existing', email: 'existing@test.com' });
    Object.assign(process.env, { ADMIN_EMAIL: 'owner@company.com', ADMIN_PASSWORD: 'a-long-password' });
    await bootstrapAdmin();
    assert.equal(await User.countDocuments(), 1);
    assert.equal(await User.exists({ email: 'owner@company.com' }), null);
  });

  test('does nothing without ADMIN_EMAIL and ADMIN_PASSWORD, and never creates demo accounts', async () => {
    await bootstrapAdmin();
    assert.equal(await User.countDocuments(), 0);
    assert.equal(await User.exists({ email: 'admin@demo.com' }), null);
  });
});
