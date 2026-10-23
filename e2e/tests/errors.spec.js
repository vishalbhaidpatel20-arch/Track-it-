import { test, expect } from '@playwright/test';
import { loginAs, stubExternal } from './helpers.js';

test.beforeEach(async ({ context }) => stubExternal(context));

test.describe('error handling in the browser', () => {
  test('a failing API shows a retry panel (not an endless spinner) and recovers once the API is back', async ({ page }) => {
    await loginAs(page, 'customer');

    // Simulate the API going down for the orders list
    await page.route('**/api/orders', (route) => route.abort('connectionrefused'));
    await page.reload();
    await expect(page.getByText("We couldn't load this page")).toBeVisible();
    await expect(page.getByText(/Cannot reach the server/)).toBeVisible();
    await expect(page.getByText('Loading…')).toHaveCount(0);

    // ...and it comes back
    await page.unroute('**/api/orders');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
  });

  test('a 500 from the server shows a generic message and never leaks internals', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.route('**/api/admin/users', (route) => route.fulfill({ status: 500, json: { message: 'Server error' } }));
    await page.goto('/admin/users');
    await expect(page.getByText("We couldn't load this page")).toBeVisible();
    await expect(page.getByText('Server error')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/at .*\.js:\d+/); // no stack traces
  });

  test('an expired or invalid session sends the user back to the login page', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('token', 'expired.or.invalid'));
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a crash while rendering shows the recovery screen instead of a blank page', async ({ page }) => {
    await loginAs(page, 'customer');
    // Make the orders API answer with a shape the page cannot render
    await page.route('**/api/orders', (route) => route.fulfill({ json: { orders: [{ _id: 'x', status: 'Placed' }] } }));
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Something went wrong');
    await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible();
  });

  test('form errors from the server are shown inline', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await page.getByPlaceholder('Name').fill('Dup');
    await page.getByPlaceholder('Email').fill('admin@demo.com'); // already exists
    await page.getByPlaceholder('Password').fill('secret12');
    await page.getByRole('button', { name: 'Add user' }).click();
    await expect(page.getByText('Already exists')).toBeVisible();
  });
});
