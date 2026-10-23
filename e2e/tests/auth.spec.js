import { test, expect } from '@playwright/test';
import { loginAs, registerCustomer, stubExternal } from './helpers.js';

test.beforeEach(async ({ context }) => stubExternal(context));

test.describe('authentication', () => {
  test('login page shows demo shortcuts and rejects bad credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await page.getByLabel('Email').fill('user@demo.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('each demo role lands on its own home page', async ({ page }) => {
    await loginAs(page, 'customer');
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await loginAs(page, 'agent');
    await expect(page).toHaveURL(/\/deliveries$/);
    await expect(page.getByRole('heading', { name: 'My Deliveries' })).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await loginAs(page, 'admin');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('link', { name: 'Live Map' }).first()).toBeVisible();
  });

  test('a new customer can sign up and starts with an empty order list', async ({ page }) => {
    await registerCustomer(page);
    await expect(page.getByText('No orders yet.')).toBeVisible();
  });

  test('signing up twice with the same email shows an error', async ({ page }) => {
    const email = await registerCustomer(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.goto('/register');
    await page.getByLabel('Name').fill('Copy Cat');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/Password/).fill('secret12');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByText('Email already registered')).toBeVisible();
  });

  test('the session survives a reload and ends on log out', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'My Orders' })).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('access control', () => {
  test('visitors are redirected to the login page', async ({ page }) => {
    for (const path of ['/admin', '/orders', '/deliveries']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('a customer cannot open admin or agent pages', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/orders$/);
    await page.goto('/deliveries');
    await expect(page).toHaveURL(/\/orders$/);
  });

  test('an agent cannot open the customer or admin pages', async ({ page }) => {
    await loginAs(page, 'agent');
    await page.goto('/orders/new');
    await expect(page).toHaveURL(/\/deliveries$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/deliveries$/);
  });
});
