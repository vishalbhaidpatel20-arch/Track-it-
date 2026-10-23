import { test, expect } from '@playwright/test';
import { loginAs, newSession, placeOrder, registerCustomer } from './helpers.js';

const badge = (page, text) => page.locator('.status', { hasText: text }).first();

test('full delivery journey across three people, with live updates and no page reloads', async ({ browser }) => {
  const customer = await newSession(browser);
  const admin = await newSession(browser);
  const agent = await newSession(browser);

  // 1. Customer signs up and places an order
  await registerCustomer(customer.page, 'Journey Customer');
  const orderPath = await placeOrder(customer.page, 'Journey parcel');
  const orderId = (await customer.page.getByRole('heading', { level: 2 }).textContent()).match(/ORD-[A-Z0-9]+/)[0];
  await expect(badge(customer.page, 'Placed')).toBeVisible();
  await expect(customer.page.getByText('Not assigned yet')).toBeVisible();

  // 2. Admin sees the new order and assigns an agent
  await loginAs(admin.page, 'admin');
  await admin.page.goto('/admin/orders');
  await expect(admin.page.getByRole('link', { name: orderId }).first()).toBeVisible();
  await admin.page.goto(orderPath);
  const ravi = await admin.page.locator('option', { hasText: 'Ravi Agent' }).getAttribute('value');
  await admin.page.locator('select').selectOption(ravi);
  await admin.page.getByRole('button', { name: 'Assign' }).click();
  await expect(admin.page.getByText('Ravi Agent').first()).toBeVisible();

  // ...and the customer's open page updates by itself
  await expect(customer.page.getByText('Ravi Agent').first()).toBeVisible();

  // 3. Agent gets the delivery and works through the statuses
  await loginAs(agent.page, 'agent');
  const card = agent.page.locator('.delivery-card', { hasText: orderId });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Mark Picked-up' }).click();
  await expect(badge(customer.page, 'Picked-up')).toBeVisible(); // pushed live to the customer

  // Agent shares a (simulated) location; the customer sees the agent marker appear on their map
  await agent.page.getByRole('button', { name: 'Simulate' }).click();
  await expect(agent.page.getByText('Sharing your live location')).toBeVisible();
  await expect(customer.page.locator('.pin', { hasText: '🛵' }).first()).toBeVisible({ timeout: 20_000 });
  await expect(customer.page.getByText(/Live tracking/)).toBeVisible();

  await card.getByRole('button', { name: 'Mark In-Transit' }).click();
  await expect(badge(customer.page, 'In-Transit')).toBeVisible();
  await card.getByRole('button', { name: 'Mark Delivered' }).click();

  // 4. Customer sees "Delivered", is notified, and can rate
  await expect(badge(customer.page, 'Delivered')).toBeVisible();
  await expect(customer.page.getByRole('heading', { name: 'Rate this delivery' })).toBeVisible();
  await customer.page.getByRole('button', { name: '★' }).nth(3).click(); // 4 stars
  await customer.page.getByPlaceholder('Feedback (optional)').fill('Fast and friendly');
  await customer.page.getByRole('button', { name: 'Submit rating' }).click();
  await expect(customer.page.getByText('★★★★')).toBeVisible();
  await expect(customer.page.getByText('Fast and friendly')).toBeVisible();

  // Status history lists every step
  for (const step of ['Order placed', 'Assigned to Ravi Agent']) await expect(customer.page.getByText(step)).toBeVisible();

  // 5. Agent's delivery moved to Completed
  await agent.page.reload();
  await expect(agent.page.getByText(/Completed \(/)).toBeVisible();
  await expect(agent.page.locator('.delivery-card', { hasText: orderId })).toHaveCount(0);

  // 6. Admin dashboard reflects the delivered order
  await admin.page.goto('/admin');
  await expect(admin.page.getByText('On-time delivery rate')).toBeVisible();

  await Promise.all([customer, admin, agent].map((s) => s.context.close()));
});

test('customer receives in-app notifications for status changes', async ({ browser }) => {
  const customer = await newSession(browser);
  const admin = await newSession(browser);
  await registerCustomer(customer.page);
  await placeOrder(customer.page);

  await loginAs(admin.page, 'admin');
  await admin.page.goto('/admin/orders');
  const select = admin.page.locator('.orders-desktop select').first();
  const ravi = await select.locator('option', { hasText: 'Ravi Agent' }).getAttribute('value');
  await select.selectOption(ravi);

  await expect(customer.page.locator('.toast')).toContainText('Agent assigned');
  await customer.page.getByLabel('Notifications').click();
  await expect(customer.page.locator('.notif').first()).toContainText('Ravi Agent');

  await Promise.all([customer, admin].map((s) => s.context.close()));
});

test('a customer can cancel an order before pickup', async ({ browser }) => {
  const customer = await newSession(browser);
  await registerCustomer(customer.page);
  await placeOrder(customer.page);
  await customer.page.getByRole('button', { name: 'Cancel order' }).click();
  await expect(badge(customer.page, 'Cancelled')).toBeVisible();
  await expect(customer.page.getByText('This order was cancelled.')).toBeVisible();
  await expect(customer.page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
  await customer.context.close();
});

test('order form validation: both locations are required', async ({ browser }) => {
  const customer = await newSession(browser);
  await registerCustomer(customer.page);
  await customer.page.goto('/orders/new');
  await customer.page.getByPlaceholder('e.g. Documents, 1 small box').fill('No locations');
  await customer.page.getByRole('button', { name: 'Place order' }).click();
  await expect(customer.page.getByText(/Set both pickup and drop locations/)).toBeVisible();
  await expect(customer.page).toHaveURL(/\/orders\/new$/);
  await customer.context.close();
});

test("one customer cannot open another customer's order", async ({ browser }) => {
  const owner = await newSession(browser);
  const stranger = await newSession(browser);
  await registerCustomer(owner.page, 'Owner');
  const orderPath = await placeOrder(owner.page);
  await registerCustomer(stranger.page, 'Stranger');
  await stranger.page.goto(orderPath);
  await expect(stranger.page.getByText('Forbidden')).toBeVisible();
  await Promise.all([owner, stranger].map((s) => s.context.close()));
});
