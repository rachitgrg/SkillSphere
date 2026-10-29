import { expect } from '@playwright/test';
import { ACCOUNTS, login, test, type Role } from './helpers';

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

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu button opens the full sidebar as a drawer', async ({ page }) => {
    await login(page, 'freelancer');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('navigation', { name: 'Main menu' });
    await drawer.getByRole('link', { name: 'Analytics' }).click();
    await expect(page).toHaveURL(/\/freelancer\/analytics$/);
    await expect(drawer).toBeHidden();
    await expect(page).toHaveTitle('Analytics · SkillSphere');
  });
});
