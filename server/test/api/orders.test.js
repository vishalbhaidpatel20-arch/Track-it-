import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Notification, Order, StatusLog, User } from '../../src/models/index.js';
import { startTestServer, orderBody, CP } from '../helpers.js';

let t, customer, other, agent, agent2, admin;

before(async () => {
  t = await startTestServer();
  customer = await t.makeUser({ name: 'Cust', email: 'cust@test.com' });
  other = await t.makeUser({ name: 'Other', email: 'other@test.com' });
  agent = await t.makeUser({ name: 'Agent One', email: 'agent1@test.com', role: 'agent' });
  agent2 = await t.makeUser({ name: 'Agent Two', email: 'agent2@test.com', role: 'agent' });
  admin = await t.makeUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
});
after(() => t.stop());

const place = async (who = customer, extra = {}) => {
  const res = await t.api().post('/api/orders').set(who.auth).send(orderBody(extra));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.order;
};
const assign = (id, agentUser = agent) => t.api().patch(`/api/orders/${id}/assign`).set(admin.auth).send({ agentId: String(agentUser.user._id) });
const setStatus = (id, status, who = agent) => t.api().patch(`/api/orders/${id}/status`).set(who.auth).send({ status });

describe('placing orders', () => {
  test('a customer can place an order; distance, due time and history are computed', async () => {
    const order = await place();
    assert.equal(order.status, 'Placed');
    assert.match(order.orderId, /^ORD-[A-Z0-9]+$/);
    assert.ok(order.distanceKm > 2 && order.distanceKm < 3);
    assert.ok(new Date(order.dueAt) > new Date());
    assert.equal(await StatusLog.countDocuments({ order: order._id }), 1);
  });

  test('admins are notified of new orders', async () => {
    const before = await Notification.countDocuments({ user: admin.user._id });
    await place();
    assert.equal(await Notification.countDocuments({ user: admin.user._id }), before + 1);
  });

  test('invalid orders are rejected with 400', async () => {
    for (const body of [
      { ...orderBody(), drop: undefined },
      { ...orderBody(), packageDescription: '' },
      { ...orderBody(), pickup: { ...CP, lat: 123 } }, // latitude out of range
      { ...orderBody(), pickup: { address: 'xx', lat: 1, lng: 1 } }, // address too short
    ]) {
      const res = await t.api().post('/api/orders').set(customer.auth).send(body);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
    }
  });

  test('only customers can place orders', async () => {
    assert.equal((await t.api().post('/api/orders').set(agent.auth).send(orderBody())).status, 403);
    assert.equal((await t.api().post('/api/orders').set(admin.auth).send(orderBody())).status, 403);
    assert.equal((await t.api().post('/api/orders').send(orderBody())).status, 401);
  });
});

describe('visibility', () => {
  test('customers only see their own orders; others get 403 on direct access', async () => {
    const mine = await place(customer);
    const list = await t.api().get('/api/orders').set(other.auth);
    assert.equal(list.body.orders.length, 0);
    assert.equal((await t.api().get(`/api/orders/${mine._id}`).set(other.auth)).status, 403);
    assert.equal((await t.api().get(`/api/orders/${mine._id}`).set(customer.auth)).status, 200);
    assert.equal((await t.api().get(`/api/orders/${mine._id}`).set(admin.auth)).status, 200);
  });

  test('agents only see orders assigned to them', async () => {
    const order = await place();
    assert.equal((await t.api().get(`/api/orders/${order._id}`).set(agent2.auth)).status, 403);
    await assign(order._id, agent2);
    assert.equal((await t.api().get(`/api/orders/${order._id}`).set(agent2.auth)).status, 200);
    const list = await t.api().get('/api/orders').set(agent2.auth);
    assert.ok(list.body.orders.every((o) => o.agent._id === String(agent2.user._id)));
  });

  test('malformed ids return 400, unknown ids 404', async () => {
    assert.equal((await t.api().get('/api/orders/not-an-id').set(admin.auth)).status, 400);
    assert.equal((await t.api().get('/api/orders/64b7f0f0f0f0f0f0f0f0f0f0').set(admin.auth)).status, 404);
  });
});

describe('assignment', () => {
  test('only admins can assign, and only real active agents', async () => {
    const order = await place();
    assert.equal((await t.api().patch(`/api/orders/${order._id}/assign`).set(customer.auth).send({ agentId: String(agent.user._id) })).status, 403);
    assert.equal((await assign(order._id, customer)).status, 400); // a customer is not an agent
    const ok = await assign(order._id, agent);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.order.agent.name, 'Agent One');
  });

  test('assignment notifies both the agent and the customer', async () => {
    const order = await place();
    const agentBefore = await Notification.countDocuments({ user: agent.user._id });
    const custBefore = await Notification.countDocuments({ user: customer.user._id });
    await assign(order._id);
    assert.equal(await Notification.countDocuments({ user: agent.user._id }), agentBefore + 1);
    assert.equal(await Notification.countDocuments({ user: customer.user._id }), custBefore + 1);
  });

  test('can be reassigned until pickup, not after', async () => {
    const order = await place();
    await assign(order._id, agent);
    assert.equal((await assign(order._id, agent2)).status, 200);
    await setStatus(order._id, 'Picked-up', agent2);
    assert.equal((await assign(order._id, agent)).status, 400);
  });
});

describe('delivery lifecycle (end to end)', () => {
  let order;

  test('Placed -> Picked-up -> In-Transit -> Delivered, with history and agent availability', async () => {
    order = await place();
    await assign(order._id, agent);

    const picked = await setStatus(order._id, 'Picked-up');
    assert.equal(picked.status, 200);
    assert.equal(picked.body.order.status, 'Picked-up');
    assert.ok(picked.body.order.pickedUpAt);
    assert.equal((await User.findById(agent.user._id)).available, false);

    assert.equal((await setStatus(order._id, 'In-Transit')).body.order.status, 'In-Transit');

    const done = await setStatus(order._id, 'Delivered');
    assert.equal(done.body.order.status, 'Delivered');
    assert.ok(done.body.order.deliveredAt);
    assert.equal((await User.findById(agent.user._id)).available, true); // freed up again

    const detail = await t.api().get(`/api/orders/${order._id}`).set(customer.auth);
    assert.deepEqual(detail.body.logs.map((l) => l.status), ['Placed', 'Placed', 'Picked-up', 'In-Transit', 'Delivered']);
  });

  test('the customer was notified at each step', async () => {
    const titles = (await Notification.find({ user: customer.user._id, order: order._id })).map((n) => n.title);
    for (const expected of ['Agent assigned', 'Order Picked-up', 'Order In-Transit', 'Order Delivered']) {
      assert.ok(titles.includes(expected), `missing "${expected}" in ${titles}`);
    }
  });

  test('delivered orders can be rated once by the customer', async () => {
    const rate = (who, body) => t.api().post(`/api/orders/${order._id}/rate`).set(who.auth).send(body);
    assert.equal((await rate(customer, { rating: 6 })).status, 400); // out of range
    assert.equal((await rate(other, { rating: 5 })).status, 403); // not their order
    const ok = await rate(customer, { rating: 5, feedback: 'Great' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.order.rating, 5);
    assert.equal((await rate(customer, { rating: 1 })).status, 400); // already rated
  });

  test('undelivered orders cannot be rated', async () => {
    const fresh = await place();
    const res = await t.api().post(`/api/orders/${fresh._id}/rate`).set(customer.auth).send({ rating: 4 });
    assert.equal(res.status, 400);
  });
});

describe('status rules', () => {
  test('status changes need an assigned agent', async () => {
    const order = await place();
    assert.equal((await setStatus(order._id, 'Picked-up', admin)).status, 400);
  });

  test('steps cannot be skipped or repeated', async () => {
    const order = await place();
    await assign(order._id);
    assert.equal((await setStatus(order._id, 'In-Transit')).status, 400);
    assert.equal((await setStatus(order._id, 'Delivered')).status, 400);
    assert.equal((await setStatus(order._id, 'Picked-up')).status, 200);
    assert.equal((await setStatus(order._id, 'Picked-up')).status, 400);
  });

  test("an agent cannot update another agent's order; customers cannot update status", async () => {
    const order = await place();
    await assign(order._id, agent);
    assert.equal((await setStatus(order._id, 'Picked-up', agent2)).status, 403);
    assert.equal((await setStatus(order._id, 'Picked-up', customer)).status, 403);
    assert.equal((await t.api().patch(`/api/orders/${order._id}/status`).set(agent.auth).send({ status: 'Teleported' })).status, 400);
  });
});

describe('cancellation', () => {
  test('a customer can cancel before pickup but not after', async () => {
    const a = await place();
    assert.equal((await t.api().patch(`/api/orders/${a._id}/cancel`).set(customer.auth)).body.order.status, 'Cancelled');

    const b = await place();
    await assign(b._id);
    await setStatus(b._id, 'Picked-up');
    assert.equal((await t.api().patch(`/api/orders/${b._id}/cancel`).set(customer.auth)).status, 400);
  });

  test('an admin can cancel an in-flight order, which frees the agent', async () => {
    const solo = await t.makeUser({ name: 'Solo Agent', email: 'solo@test.com', role: 'agent' }); // no other open orders
    const order = await place();
    await assign(order._id, solo);
    await setStatus(order._id, 'Picked-up', solo);
    assert.equal((await User.findById(solo.user._id)).available, false);
    const res = await t.api().patch(`/api/orders/${order._id}/cancel`).set(admin.auth);
    assert.equal(res.body.order.status, 'Cancelled');
    assert.equal((await User.findById(solo.user._id)).available, true);
  });

  test('finished orders cannot be cancelled, and nothing can be updated afterwards', async () => {
    const order = await place();
    await t.api().patch(`/api/orders/${order._id}/cancel`).set(customer.auth);
    assert.equal((await t.api().patch(`/api/orders/${order._id}/cancel`).set(admin.auth)).status, 400);
    assert.equal((await assign(order._id)).status, 400);
  });
});

describe('notifications API', () => {
  test('lists own notifications and marks them read', async () => {
    const list = await t.api().get('/api/notifications').set(customer.auth);
    assert.equal(list.status, 200);
    assert.ok(list.body.notifications.some((n) => !n.read));
    assert.equal((await t.api().patch('/api/notifications/read-all').set(customer.auth)).status, 200);
    const after = await t.api().get('/api/notifications').set(customer.auth);
    assert.ok(after.body.notifications.every((n) => n.read));
    // other people's notifications are untouched
    assert.ok((await Notification.countDocuments({ user: admin.user._id, read: false })) > 0);
  });
});

describe('admin reports', () => {
  test('aggregates orders, ratings and per-agent stats', async () => {
    await Order.deleteMany({});
    const o = await place();
    await assign(o._id);
    for (const s of ['Picked-up', 'In-Transit', 'Delivered']) await setStatus(o._id, s);
    await t.api().post(`/api/orders/${o._id}/rate`).set(customer.auth).send({ rating: 4 });
    await place(); // stays Placed

    const res = await t.api().get('/api/admin/reports').set(admin.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.totalOrders, 2);
    assert.equal(res.body.byStatus.Delivered, 1);
    assert.equal(res.body.byStatus.Placed, 1);
    assert.equal(res.body.onTimeRate, 100);
    assert.equal(res.body.csat, 4);
    assert.equal(res.body.ratingCount, 1);
    assert.equal(res.body.daily.length, 7);
    assert.equal(res.body.daily.at(-1).orders, 2);
    assert.equal(res.body.agents[0].name, 'Agent One');
    assert.equal(res.body.agents[0].delivered, 1);
  });
});
