import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

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

/** Collects Content-Security-Policy violations reported in the console of every page in `context`. */
const cspViolations: string[] = [];
export const watchCsp = (context: BrowserContext) =>
  context.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) cspViolations.push(message.text());
  });

/** `test` that fails when any page broke the production CSP. */
export const test = base.extend({
  // Named `provide` rather than Playwright's usual `use`, which the react-hooks lint rule mistakes for React's `use`.
  context: async ({ context }, provide) => {
    cspViolations.length = 0;
    watchCsp(context);
    await provide(context);
    expect(cspViolations, 'CSP violations').toEqual([]);
  },
});

/** A signed-in page in its own browser context, so each role keeps its own session cookie. */
export const signedIn = async (browser: Browser, role: Role) => {
  const context = await browser.newContext();
  watchCsp(context);
  const page = await context.newPage();
  await login(page, role);
  return page;
};

export const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
