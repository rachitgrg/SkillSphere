import { expect, type Page } from '@playwright/test';
import { inDays, signedIn, test } from './helpers';

/**
 * §9 steps 3, 5 and 7: post a gig with milestones → admin approval → apply → hire → fund
 * milestone 1 (simulated checkout) → start → submit → approve, which releases the payment.
 */
test('gig to released payment', async ({ browser }) => {
  test.setTimeout(180_000);
  const title = `E2E Kotlin delivery app ${Date.now()}`;
  const [client, admin, freelancer] = await Promise.all([signedIn(browser, 'client'), signedIn(browser, 'admin'), signedIn(browser, 'freelancer')]);
  const toast = (page: Page, text: string | RegExp) => expect(page.getByText(text).first()).toBeVisible();

  // Client posts a gig with two milestones.
  await client.goto('/client/gigs/new');
  await client.getByLabel('Title', { exact: true }).fill(title);
  await client.getByLabel('Description', { exact: true }).fill('Build a Kotlin Android app for tracking deliveries with live maps and push notifications.');
  const skills = client.getByRole('textbox', { name: 'Skills', exact: true });
  await skills.fill('Kotlin');
  await skills.press('Enter');
  await client.getByLabel('Budget from (₹)', { exact: true }).fill('20000');
  await client.getByLabel('Budget up to (₹)', { exact: true }).fill('30000');
  await client.getByLabel('Duration', { exact: true }).fill('3');
  await client.getByLabel('Unit', { exact: true }).selectOption('weeks');
  for (const [index, [name, amount]] of [['Core screens', '10000'], ['Maps and notifications', '15000']].entries()) {
    await client.getByRole('button', { name: 'Add milestone' }).click();
    const n = index + 1;
    await client.getByLabel(`Milestone ${n} title`, { exact: true }).fill(name);
    await client.getByLabel(`Milestone ${n} amount`, { exact: true }).fill(amount);
    await client.getByLabel(`Milestone ${n} due date`, { exact: true }).fill(inDays(7 * n));
    await client.getByLabel(`Milestone ${n} description`, { exact: true }).fill(`${name} delivered and demoed`);
  }
  await client.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(client).toHaveURL(/\/gigs\/[a-f0-9]{24}$/);
  const gigId = client.url().split('/').pop()!;

  // Admin approves it from the queue.
  await admin.goto('/admin/gigs');
  const card = admin.locator('div', { hasText: title }).filter({ has: admin.getByRole('button', { name: 'Approve' }) }).last();
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText(title)).toHaveCount(0);

  // Freelancer applies.
  await freelancer.goto(`/gigs/${gigId}`);
  await freelancer.getByRole('button', { name: 'Apply now' }).click();
  await freelancer.getByLabel('Cover letter', { exact: true }).fill('I have shipped three Kotlin delivery apps with live tracking; happy to start this week.');
  await freelancer.getByLabel('Your bid (₹)', { exact: true }).fill('25000');
  await freelancer.getByLabel('Estimated time', { exact: true }).fill('3');
  await freelancer.getByLabel('Duration unit', { exact: true }).selectOption('weeks');
  await freelancer.getByRole('button', { name: 'Submit proposal' }).click();
  await toast(freelancer, /proposal/i);

  // Client hires the freelancer.
  await client.goto(`/client/gigs/${gigId}/proposals`);
  await client.getByRole('button', { name: /^Hire for/ }).click();
  await client.getByRole('button', { name: 'Hire', exact: true }).click();
  await toast(client, /hired|accepted/i);

  // Client funds milestone 1 through the simulated checkout.
  await client.goto(`/projects/${gigId}`);
  await client.getByRole('button', { name: 'Fund milestone' }).first().click();
  await client.getByRole('button', { name: 'Pay ₹10,000' }).click();
  await expect(client.getByText('Funded — waiting for the freelancer to start')).toBeVisible();

  // Freelancer starts and submits.
  await freelancer.goto(`/projects/${gigId}`);
  await freelancer.getByRole('button', { name: 'Start work' }).click();
  await toast(freelancer, 'Milestone started');
  await freelancer.getByRole('button', { name: 'Submit for review' }).click();
  await freelancer.getByLabel('Delivery note', { exact: true }).fill('Core screens are done; APK link in the progress log.');
  await freelancer.getByRole('button', { name: 'Submit', exact: true }).click();
  await toast(freelancer, 'Submitted — the client has been notified');

  // Client approves, releasing the escrowed payment.
  await client.reload();
  await client.getByRole('button', { name: 'Approve & release ₹10,000' }).click();
  await toast(client, 'Approved — payment released');

  await client.goto('/client/payments');
  await expect(client.getByText(/released/i).first()).toBeVisible();
});
