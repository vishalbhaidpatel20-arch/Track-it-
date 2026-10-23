import { test, expect } from '@playwright/test';
import { loginAs, stubExternal } from './helpers.js';

test.beforeEach(async ({ context, page }) => {
  await stubExternal(context);
  await loginAs(page, 'admin');
});

test('dashboard shows KPIs, charts and agents', async ({ page }) => {
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();
  for (const kpi of ['Active deliveries', 'On-time delivery rate', 'Avg delivery duration', 'Tracking accuracy', 'Customer satisfaction', 'Total orders']) {
    await expect(page.getByText(kpi, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Orders by status' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent orders' })).toBeVisible();
  await expect(page.locator('.agent-row', { hasText: 'Ravi Agent' })).toBeVisible();
  await expect(page.locator('.recharts-surface').first()).toBeVisible();
});

test('orders page filters by status', async ({ page }) => {
  await page.goto('/admin/orders');
  const all = page.getByRole('button', { name: /^All \(/ });
  await expect(all).toBeVisible();
  await page.getByRole('button', { name: /^Delivered \(/ }).click();
  const rows = page.locator('.orders-desktop tbody tr');
  await expect(rows.first()).toBeVisible();
  for (const text of await rows.locator('.status').allTextContents()) expect(text).toBe('Delivered');
});

test('live map page loads with stats, filters and the delivery list', async ({ page }) => {
  await page.goto('/admin/live');
  await expect(page.getByRole('heading', { name: 'Live deliveries' })).toBeVisible();
  await expect(page.getByText('Agents reporting')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  for (const style of ['Street', 'Light', 'Dark', 'Satellite']) await expect(page.getByRole('button', { name: style })).toBeVisible();
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expect(page.locator('.map-full')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.map-full')).toHaveCount(0);
});

test('admin can create an agent, who can then sign in; and disable them', async ({ page, browser }) => {
  const email = `agent-${Date.now()}@test.com`;
  await page.goto('/admin/users');
  await page.getByPlaceholder('Name').fill('Fresh Agent');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill('secret12');
  await page.locator('form select').selectOption('agent');
  await page.getByRole('button', { name: 'Add user' }).click();
  const row = page.locator('tr', { hasText: email });
  await expect(row).toBeVisible();

  // the new agent can log in
  const ctx = await browser.newContext();
  const agentPage = await ctx.newPage();
  await agentPage.goto('/login');
  await agentPage.getByLabel('Email').fill(email);
  await agentPage.getByLabel('Password').fill('secret12');
  await agentPage.getByRole('button', { name: 'Sign in' }).click();
  await expect(agentPage).toHaveURL(/\/deliveries$/);

  // after being disabled they cannot sign in again
  await row.getByRole('button', { name: 'Disable' }).click();
  await expect(row.getByText('Disabled')).toBeVisible();
  await agentPage.getByRole('button', { name: 'Log out' }).click();
  await agentPage.getByLabel('Email').fill(email);
  await agentPage.getByLabel('Password').fill('secret12');
  await agentPage.getByRole('button', { name: 'Sign in' }).click();
  await expect(agentPage.getByText('Invalid email or password')).toBeVisible();
  await ctx.close();
});

test('admins cannot disable their own account', async ({ page }) => {
  await page.goto('/admin/users');
  const own = page.locator('tr', { hasText: 'admin@demo.com' });
  await expect(own).toBeVisible();
  await expect(own.getByRole('button', { name: 'Disable' })).toHaveCount(0);
});
