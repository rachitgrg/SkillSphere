import { expect, type Browser, type Page } from '@playwright/test';

/** Seeded demo accounts (server/scripts/seed.ts defaults). */
export const ACCOUNTS = {
  admin: { email: 'admin@skillsphere.dev', password: 'Admin@12345', home: '/admin/dashboard' },
  client: { email: 'kavya@client.demo', password: 'Demo@12345', home: '/client/dashboard' },
  freelancer: { email: 'arjun@freelancer.demo', password: 'Demo@12345', home: '/freelancer/dashboard' },
} as const;

export type Role = keyof typeof ACCOUNTS;

export const login = async (page: Page, role: Role) => {
  const account = ACCOUNTS[role];
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(new RegExp(`${account.home}$`));
};

/** A signed-in page in its own browser context, so each role keeps its own session cookie. */
export const signedIn = async (browser: Browser, role: Role) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, role);
  return page;
};

export const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
