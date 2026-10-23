import { expect } from '@playwright/test';

export const DEMO = {
  admin: { email: 'admin@demo.com', button: 'Admin' },
  agent: { email: 'agent1@demo.com', button: 'Agent' },
  customer: { email: 'user@demo.com', button: 'Customer' },
};

/** Keeps tests fast and offline-safe: no real map tiles or geocoding requests. */
export async function stubExternal(context) {
  await context.route(/tile\.openstreetmap\.org|arcgisonline\.com|cartocdn\.com/, (route) => route.abort());
  await context.route(/nominatim\.openstreetmap\.org/, (route) =>
    route.fulfill({ json: route.request().url().includes('/search') ? [{ lat: '28.6315', lon: '77.2167' }] : { display_name: 'Mock Street, New Delhi' } })
  );
}

/** A fresh, isolated browser session (own cookies/localStorage), like a separate person on another device. */
export async function newSession(browser) {
  const context = await browser.newContext();
  await stubExternal(context);
  return { context, page: await context.newPage() };
}

export async function loginAs(page, who) {
  await page.goto('/login');
  await page.getByRole('button', { name: DEMO[who].button, exact: true }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function registerCustomer(page, name = 'E2E Customer') {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.com`;
  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/Password/).fill('secret12');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/orders$/);
  return email;
}

/** Fills pickup + drop (typed address + a click on the map) and the package, then submits. Returns the new order's URL path. */
export async function placeOrder(page, description = 'E2E parcel') {
  await page.goto('/orders/new');
  const map = page.locator('.leaflet-container').first();
  const box = await map.boundingBox();

  await page.getByPlaceholder('Search an address…').nth(0).fill('Pickup Lane, New Delhi');
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.35);
  await page.getByPlaceholder('Search an address…').nth(1).fill('Drop Road, New Delhi');
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.65);
  await expect(page.getByText(/^Location set/)).toHaveCount(2);

  await page.getByPlaceholder('e.g. Documents, 1 small box').fill(description);
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{24}$/);
  return new URL(page.url()).pathname;
}
