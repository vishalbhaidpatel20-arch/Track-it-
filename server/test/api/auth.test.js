import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from '../helpers.js';

let t;
before(async () => {
  t = await startTestServer();
});
after(() => t.stop());

describe('health', () => {
  test('GET /api/health', async () => {
    const res = await t.api().get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
  });

  test('unknown API routes return a JSON 404', async () => {
    const res = await t.api().get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Not found');
  });
});

describe('registration', () => {
  test('creates a customer and returns a token (never the password)', async () => {
    const res = await t.api().post('/api/auth/register').send({ name: 'Asha', email: 'Asha@Test.com', password: 'secret12' });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'asha@test.com'); // normalised
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.password, undefined);
  });

  test('cannot self-register as admin or agent', async () => {
    const res = await t.api().post('/api/auth/register').send({ name: 'Eve', email: 'eve@test.com', password: 'secret12', role: 'admin' });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'user');
  });

  test('rejects duplicate emails with 409', async () => {
    const res = await t.api().post('/api/auth/register').send({ name: 'Asha 2', email: 'asha@test.com', password: 'secret12' });
    assert.equal(res.status, 409);
  });

  test('rejects invalid input with 400', async () => {
    for (const body of [
      { name: 'A', email: 'a@test.com', password: 'secret12' }, // name too short
      { name: 'Bob', email: 'not-an-email', password: 'secret12' },
      { name: 'Bob', email: 'bob@test.com', password: '123' }, // password too short
      {},
    ]) {
      const res = await t.api().post('/api/auth/register').send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });
});

describe('login and sessions', () => {
  test('logs in with correct credentials', async () => {
    const res = await t.api().post('/api/auth/login').send({ email: 'asha@test.com', password: 'secret12' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  test('wrong password and unknown email give the same 401 message', async () => {
    const wrong = await t.api().post('/api/auth/login').send({ email: 'asha@test.com', password: 'bad-password' });
    const unknown = await t.api().post('/api/auth/login').send({ email: 'ghost@test.com', password: 'secret12' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });

  test('disabled accounts cannot log in', async () => {
    const { user } = await t.makeUser({ name: 'Off', email: 'off@test.com' });
    user.active = false;
    await user.save();
    const res = await t.api().post('/api/auth/login').send({ email: 'off@test.com', password: 'password123' });
    assert.equal(res.status, 401);
  });

  test('GET /me requires a valid token', async () => {
    const { auth } = await t.makeUser({ name: 'Me', email: 'me@test.com' });
    assert.equal((await t.api().get('/api/auth/me')).status, 401);
    assert.equal((await t.api().get('/api/auth/me').set('Authorization', 'Bearer garbage')).status, 401);
    const ok = await t.api().get('/api/auth/me').set(auth);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, 'me@test.com');
  });

  test('a token stops working once the user is disabled', async () => {
    const { user, auth } = await t.makeUser({ name: 'Soon', email: 'soon@test.com' });
    assert.equal((await t.api().get('/api/auth/me').set(auth)).status, 200);
    user.active = false;
    await user.save();
    assert.equal((await t.api().get('/api/auth/me').set(auth)).status, 401);
  });
});

describe('role-based access', () => {
  test('customers and agents are forbidden from admin endpoints', async () => {
    const customer = await t.makeUser({ name: 'C', email: 'c@test.com' });
    const agent = await t.makeUser({ name: 'A', email: 'a@test.com', role: 'agent' });
    for (const who of [customer, agent]) {
      assert.equal((await t.api().get('/api/admin/users').set(who.auth)).status, 403);
      assert.equal((await t.api().get('/api/admin/reports').set(who.auth)).status, 403);
    }
    assert.equal((await t.api().get('/api/admin/users')).status, 401);
  });

  test('admins can list users, create agents and disable accounts', async () => {
    const admin = await t.makeUser({ name: 'Boss', email: 'boss@test.com', role: 'admin' });
    const list = await t.api().get('/api/admin/users').set(admin.auth);
    assert.equal(list.status, 200);
    assert.ok(list.body.users.length >= 1);
    assert.equal(list.body.users[0].password, undefined);

    const created = await t.api().post('/api/admin/users').set(admin.auth).send({ name: 'New Agent', email: 'newagent@test.com', password: 'secret12', role: 'agent' });
    assert.equal(created.status, 201);
    assert.equal(created.body.user.role, 'agent');

    const disabled = await t.api().patch(`/api/admin/users/${created.body.user._id}`).set(admin.auth).send({ active: false });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.user.active, false);
  });

  test('admins cannot demote or disable themselves', async () => {
    const admin = await t.makeUser({ name: 'Solo', email: 'solo@test.com', role: 'admin' });
    const res = await t.api().patch(`/api/admin/users/${admin.user._id}`).set(admin.auth).send({ role: 'user' });
    assert.equal(res.status, 400);
  });
});
