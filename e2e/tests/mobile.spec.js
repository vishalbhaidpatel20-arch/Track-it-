import { test, expect } from '@playwright/test';
import { loginAs, registerCustomer, stubExternal } from './helpers.js';

test.beforeEach(async ({ context }) => stubExternal(context));

const noHorizontalScroll = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page is wider than the screen').toBeLessThanOrEqual(1);
};

test.describe('phone layout', () => {
  test('uses a bottom tab bar and a one-line footer', async ({ page }) => {
    await loginAs(page, 'customer');
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect(page.locator('.topnav-links')).toBeHidden();
    await expect(page.locator('.footer-compact')).toBeVisible();
    await expect(page.locator('.footer-inner')).toBeHidden();
    await page.locator('.bottom-nav').getByRole('link', { name: 'New Order' }).click();
    await expect(page).toHaveURL(/\/orders\/new$/);
  });

  test('orders appear as cards, not a table', async ({ page }) => {
    await loginAs(page, 'customer');
    await expect(page.locator('.order-card').first()).toBeVisible();
    await expect(page.locator('.orders-desktop')).toBeHidden();
  });

  test('new order screen puts the map above the form and has a sticky submit button', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto('/orders/new');
    const map = await page.locator('.neworder-map').boundingBox();
    const form = await page.getByPlaceholder('Search an address…').first().boundingBox();
    expect(map.y).toBeLessThan(form.y);
    await expect(page.getByRole('button', { name: 'Place order' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Use my location/ })).toBeVisible();
  });

  test('buttons and inputs are big enough to tap', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto('/orders/new');
    const input = await page.getByPlaceholder('e.g. Documents, 1 small box').boundingBox();
    expect(input.height).toBeGreaterThanOrEqual(44);
    const submit = await page.getByRole('button', { name: 'Place order' }).boundingBox();
    expect(submit.height).toBeGreaterThanOrEqual(44);
  });

  test('agent sees location sharing and one-tap Navigate / Call actions', async ({ page }) => {
    await loginAs(page, 'agent');
    await expect(page.getByText('Location sharing is off')).toBeVisible();
    for (const mode of ['Off', 'GPS', 'Simulate']) await expect(page.getByRole('button', { name: mode, exact: true })).toBeVisible();
  });

  test('admin users page hides the add form behind a button', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByPlaceholder('Email')).toBeHidden();
    await page.getByRole('button', { name: '+ Add user' }).click();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
  });

  test('no screen scrolls sideways', async ({ page }) => {
    await loginAs(page, 'admin');
    for (const path of ['/admin', '/admin/orders', '/admin/live', '/admin/users']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
    }
    await page.getByRole('button', { name: 'Log out' }).click();
    await registerCustomer(page);
    for (const path of ['/orders', '/orders/new']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await noHorizontalScroll(page);
    }
  });
});
