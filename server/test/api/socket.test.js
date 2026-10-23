import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Location, User } from '../../src/models/index.js';
import { startTestServer, nextEvent, noEvent, orderBody } from '../helpers.js';

let t, customer, stranger, agent, admin, order;

before(async () => {
  t = await startTestServer();
  customer = await t.makeUser({ name: 'Cust', email: 'cust@test.com' });
  stranger = await t.makeUser({ name: 'Stranger', email: 'stranger@test.com' });
  agent = await t.makeUser({ name: 'Agent', email: 'agent@test.com', role: 'agent' });
  admin = await t.makeUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });

  order = (await t.api().post('/api/orders').set(customer.auth).send(orderBody())).body.order;
  await t.api().patch(`/api/orders/${order._id}/assign`).set(admin.auth).send({ agentId: String(agent.user._id) });
});
after(() => t.stop());

const join = (socket, id) => new Promise((resolve) => socket.emit('order:join', id, resolve));

describe('socket authentication', () => {
  test('rejects connections without a valid token', async () => {
    await assert.rejects(t.socket(undefined), /Unauthorized/);
    await assert.rejects(t.socket('garbage'), /Unauthorized/);
  });

  test('accepts a valid token', async () => {
    const s = await t.socket(customer.token);
    assert.ok(s.connected);
  });
});

describe('order rooms', () => {
  test('customer, agent and admin may join; strangers may not', async () => {
    for (const who of [customer, agent, admin]) {
      const s = await t.socket(who.token);
      assert.deepEqual(await join(s, order._id), { ok: true });
    }
    const s = await t.socket(stranger.token);
    assert.deepEqual(await join(s, order._id), { ok: false });
  });

  test('bad order ids are refused, not crashed on', async () => {
    const s = await t.socket(customer.token);
    assert.deepEqual(await join(s, 'not-an-id'), { ok: false });
  });
});

describe('live tracking', () => {
  test('before pickup, location pings are stored on the agent but not broadcast to the order', async () => {
    const agentSocket = await t.socket(agent.token);
    const custSocket = await t.socket(customer.token);
    await join(custSocket, order._id);
    const silent = noEvent(custSocket, 'location:update');
    agentSocket.emit('location:update', { lat: 28.62, lng: 77.22 });
    assert.equal(await silent, true);
    await new Promise((r) => setTimeout(r, 100));
    const stored = await User.findById(agent.user._id);
    assert.equal(stored.currentLocation.lat, 28.62);
  });

  test('once picked up, the customer and admin receive the agent position in real time', async () => {
    await t.api().patch(`/api/orders/${order._id}/status`).set(agent.auth).send({ status: 'Picked-up' });

    const agentSocket = await t.socket(agent.token);
    const custSocket = await t.socket(customer.token);
    const adminSocket = await t.socket(admin.token);
    await join(custSocket, order._id);

    const custGot = nextEvent(custSocket, 'location:update');
    const adminGot = nextEvent(adminSocket, 'agent:location');
    agentSocket.emit('location:update', { lat: 28.625, lng: 77.221 });

    const ping = await custGot;
    assert.equal(ping.orderId, order._id);
    assert.equal(ping.lat, 28.625);
    assert.equal(ping.lng, 77.221);
    assert.equal((await adminGot).agentId, String(agent.user._id));

    await new Promise((r) => setTimeout(r, 100));
    assert.ok((await Location.countDocuments({ order: order._id })) >= 1); // history persisted
  });

  test('strangers do not receive the position', async () => {
    const agentSocket = await t.socket(agent.token);
    const strangerSocket = await t.socket(stranger.token);
    await join(strangerSocket, order._id); // refused
    const silent = noEvent(strangerSocket, 'location:update');
    agentSocket.emit('location:update', { lat: 28.63, lng: 77.23 });
    assert.equal(await silent, true);
  });

  test('only agents can publish locations; invalid coordinates are ignored', async () => {
    const custSocket = await t.socket(customer.token);
    const agentSocket = await t.socket(agent.token);
    const adminSocket = await t.socket(admin.token);
    await join(custSocket, order._id);

    const silent = noEvent(adminSocket, 'agent:location');
    custSocket.emit('location:update', { lat: 1, lng: 1 }); // a customer cannot spoof an agent
    agentSocket.emit('location:update', { lat: 999, lng: 1 }); // out of range
    agentSocket.emit('location:update', { lat: 'x', lng: 1 }); // wrong type
    agentSocket.emit('location:update');
    assert.equal(await silent, true);
  });
});

describe('push updates', () => {
  test('status changes and notifications reach the customer instantly', async () => {
    const custSocket = await t.socket(customer.token);
    await join(custSocket, order._id);
    const status = nextEvent(custSocket, 'order:status');
    const notification = nextEvent(custSocket, 'notification');

    await t.api().patch(`/api/orders/${order._id}/status`).set(agent.auth).send({ status: 'In-Transit' });

    const s = await status;
    assert.equal(s.orderId, order._id);
    assert.equal(s.status, 'In-Transit');
    assert.equal((await notification).title, 'Order In-Transit');
  });

  test('admins are told about new orders', async () => {
    const adminSocket = await t.socket(admin.token);
    const got = nextEvent(adminSocket, 'order:new');
    await t.api().post('/api/orders').set(customer.auth).send(orderBody());
    assert.ok((await got).orderId);
  });
});
