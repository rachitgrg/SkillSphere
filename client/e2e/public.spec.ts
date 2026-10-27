import { expect, test } from '@playwright/test';
import { ACCOUNTS, login, type Role } from './helpers';

test('a visitor browses the marketplace and opens a real gig', async ({ page }) => {
  await page.goto('/gigs');
  const firstGig = page.locator('a[href^="/gigs/"]').first();
  await expect(firstGig).toBeVisible();
  await firstGig.click();
  await expect(page).toHaveURL(/\/gigs\/[a-f0-9]{24}$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

for (const role of Object.keys(ACCOUNTS) as Role[]) {
  test(`${role} lands on their own dashboard after signing in`, async ({ page }) => {
    await login(page, role);
    await expect(page.getByRole('navigation').first()).toBeVisible();
  });
}

test('a signed-out visitor is sent to login from a protected page', async ({ page }) => {
  await page.goto('/client/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
