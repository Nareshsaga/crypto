import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, applyAuth, seedPortfolio } from '../helpers/auth';
import { mockExternalApis } from '../helpers/mocks';

/**
 * Dashboard functional suite — deterministic by design:
 *  - CoinGecko + Frankfurter are mocked (helpers/mocks.ts): BTC=$100, ETH=$50, EUR rate 0.9
 *  - users/positions seeded through the real API; auth deep-linked via localStorage
 *  - NO waitForTimeout anywhere: locators auto-wait (playwright-automation rule)
 *
 * Scoping notes:
 *  - money oracles use toContainText on single resolved cards, so assertions
 *    are independent of how getByText resolves nested wrappers.
 *  - role/name + label locators throughout (the BUG-03/05 a11y fixes gave
 *    every control an accessible name); the number-input count check stays
 *    as structural evidence of the form shape.
 */

/** The portfolio table is identified by its unique "Coins Purchased" column. */
const portfolioTable = (page: Page) =>
  page.locator('table').filter({ hasText: 'Coins Purchased' });

/** Top card wrapper: the div directly above the unique h2 heading. */
const card = (page: Page, heading: string) =>
  page.getByRole('heading', { level: 2, name: heading, exact: true }).locator('..');

/** The add-coin modal (Form.jsx: fixed container with shadow-2xl). */
const formModal = (page: Page) => page.locator('div.shadow-2xl');

test.describe('dashboard', () => {
  test('empty portfolio renders the full dashboard oracle', async ({ page, seededUser }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto('/dashboard');

    // section evidence + logout control
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Current Value', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Total Investment', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Portfolio Allocation', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Investment vs Current Value', exact: true })).toBeVisible();
    await expect(page.getByText('Portfolio Details', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    // zero totals: both money cards render exactly "$0.00"
    // (formatCurrency default: money always closes out to cents)
    await expect(page.getByText('$0.00', { exact: true })).toHaveCount(2);
    // profit chip of an empty portfolio is 0.00%
    await expect(card(page, 'Current Value')).toContainText('0.00%');

    // the three empty states: pie chart, bar chart, portfolio table
    await expect(card(page, 'Portfolio Allocation')).toContainText('No coins in portfolio to display.');
    await expect(card(page, 'Investment vs Current Value')).toContainText('No data to display in chart.');
    await expect(portfolioTable(page)).toContainText('No Coins Added To Portfolio');

    expect(pageErrors, `uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    await page.screenshot({ path: 'e2e/screenshots/dashboard-empty.png', fullPage: true });
  });

  test('adding Bitcoin from the home table produces correct dashboard math', async ({ page, seededUser }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);

    await page.goto('/');
    // Home has exactly one table; row-scoped by coin name
    await page
      .getByRole('table')
      .getByRole('row')
      .filter({ hasText: 'Bitcoin' })
      .getByRole('button', { name: 'Add', exact: true })
      .click();

    await expect(page.getByRole('heading', { level: 2, name: 'Add to Portfolio', exact: true })).toBeVisible();

    // the form owns exactly two number inputs — addressed via their labels
    // (htmlFor/id added by the DEF-04 fix)
    await expect(page.locator('input[type="number"]')).toHaveCount(2);
    await page.getByLabel('Buy Price').fill('50');
    await page.getByLabel('Amount of Coins').fill('2');

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('body')).toContainText('Portfolio updated successfully.');

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // math oracle: 2 × $50 = $100 invested · 2 × $100 (mock) = $200 value · +100.00%
    await expect(card(page, 'Total Investment')).toContainText('$100');
    await expect(card(page, 'Current Value')).toContainText('$200');
    await expect(card(page, 'Current Value')).toContainText('100.00%');

    // position row present, empty states replaced, charts rendered
    await expect(portfolioTable(page).getByRole('row').filter({ hasText: 'Bitcoin' })).toHaveCount(1);
    await expect(page.getByText('No coins in portfolio to display.', { exact: true })).toHaveCount(0);
    await expect(page.getByText('No data to display in chart.', { exact: true })).toHaveCount(0);
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/dashboard-with-bitcoin.png', fullPage: true });
  });

  test('add-coin form validates zero amount then zero buy price', async ({ page, seededUser }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);

    await page.goto('/');
    await page
      .getByRole('table')
      .getByRole('row')
      .filter({ hasText: 'Ethereum' })
      .getByRole('button', { name: 'Add', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 2, name: 'Add to Portfolio', exact: true })).toBeVisible();

    const priceInput = page.getByLabel('Buy Price');
    const amountInput = page.getByLabel('Amount of Coins');

    // guard 1 (sequential): zero amount
    await amountInput.fill('0');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(formModal(page)).toContainText('Amount cannot be empty or zero.');

    // guard 2: valid amount + zero price
    await amountInput.fill('3');
    await priceInput.fill('0');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(formModal(page)).toContainText('Buy price cannot be empty or zero.');

    // never submitted: form still open, no success toast
    await expect(page.getByRole('heading', { level: 2, name: 'Add to Portfolio', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Portfolio updated successfully.');
  });

  test('sell form blocks selling more coins than owned', async ({ page, seededUser, request }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    await seedPortfolio(request, seededUser.token); // 0.001 BTC / $100 investment

    await page.goto('/dashboard');
    await portfolioTable(page)
      .getByRole('row')
      .filter({ hasText: 'Bitcoin' })
      .getByRole('button', { name: 'Remove', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 2, name: 'Remove from Portfolio', exact: true })).toBeVisible();

    // sell mode: price prefilled from mock ($100), amount 1 > 0.001 owned
    await page.getByLabel('Amount of Coins').fill('1');
    await page.getByRole('button', { name: 'Remove', exact: true }).click();

    await expect(formModal(page)).toContainText('Amount exceeds your owned Bitcoin.');
    await expect(formModal(page)).toContainText('You have 0.001 coins.');
    // blocked client-side: form stays open, position untouched
    await expect(page.getByRole('heading', { level: 2, name: 'Remove from Portfolio', exact: true })).toBeVisible();
  });

  test('selling the full position removes the row and empties totals', async ({ page, seededUser, request }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    await seedPortfolio(request, seededUser.token); // 0.001 BTC

    await page.goto('/dashboard');
    await expect(portfolioTable(page).getByRole('row').filter({ hasText: 'Bitcoin' })).toHaveCount(1);

    await portfolioTable(page)
      .getByRole('row')
      .filter({ hasText: 'Bitcoin' })
      .getByRole('button', { name: 'Remove', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 2, name: 'Remove from Portfolio', exact: true })).toBeVisible();

    // sell exactly the owned amount at the prefilled $100 price
    await page.getByLabel('Amount of Coins').fill('0.001');
    await page.getByRole('button', { name: 'Remove', exact: true }).click();

    await expect(page.locator('body')).toContainText('Coin removed from portfolio.');
    // server deletes positions that reach 0 coins → empty states return
    await expect(portfolioTable(page).getByRole('row').filter({ hasText: 'Bitcoin' })).toHaveCount(0);
    await expect(portfolioTable(page)).toContainText('No Coins Added To Portfolio');
    await expect(page.getByText('$0.00', { exact: true })).toHaveCount(2);
    await expect(page.getByText('No coins in portfolio to display.', { exact: true })).toBeVisible();
  });

  test('watchlist star round-trips through the API', async ({ page, seededUser, request }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);

    await page.goto('/');
    // star button has an aria-label now (BUG-03 fix); the name flips
    // Add→Remove on toggle, so match the stable "watchlist" part
    const star = page
      .getByRole('table')
      .getByRole('row')
      .filter({ hasText: 'Bitcoin' })
      .getByRole('button', { name: /watchlist/i });
    await star.click();

    // server-side persistence check (authoritative)
    let res = await request.get(`${process.env.API_URL ?? 'http://localhost:3000'}/watchlist`, {
      headers: { Authorization: `Bearer ${seededUser.token}` },
    });
    let body = await res.json();
    expect(body.watchlist).toContain('bitcoin');

    // toggle off → removed server-side
    await star.click();
    res = await request.get(`${process.env.API_URL ?? 'http://localhost:3000'}/watchlist`, {
      headers: { Authorization: `Bearer ${seededUser.token}` },
    });
    body = await res.json();
    expect(body.watchlist).not.toContain('bitcoin');
  });

  test('currency selector converts the dashboard to EUR', async ({ page, seededUser, request }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    await seedPortfolio(request, seededUser.token); // investment $100

    await page.goto('/dashboard');
    await expect(card(page, 'Total Investment')).toContainText('$100');

    // two <select> exist in the header (desktop+mobile blocks); act on the visible one
    const selector = page.locator('select:visible');
    await selector.selectOption('EUR');

    // rate 0.9: $100 → €90 (Intl en-US currency formatting)
    await expect(selector).toHaveValue('EUR');
    await expect(card(page, 'Total Investment')).toContainText('€90');
    await expect(card(page, 'Total Investment')).not.toContainText('$');
  });

  test('theme toggle applies dark mode to the document', async ({ page, seededUser }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    await page.goto('/dashboard');

    // theme control is a labelled button now (BUG-05 fix); only the desktop
    // twin is visible at test width (mobile block is sm:hidden)
    const themeToggle = page
      .locator('button[aria-label="Toggle color theme"]:visible')
      .first();

    await themeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.screenshot({ path: 'e2e/screenshots/dashboard-dark.png', fullPage: true });

    await themeToggle.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('CSV and PDF exports download valid files', async ({ page, seededUser, request }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    await seedPortfolio(request, seededUser.token);

    await page.goto('/dashboard');
    await expect(portfolioTable(page).getByRole('row').filter({ hasText: 'Bitcoin' })).toHaveCount(1);

    // export controls are real buttons now (BUG-05 fix)
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export To CSV' }).click(),
    ]);
    expect(csvDownload.suggestedFilename()).toBe('portfolio_report.csv');
    const csv = fs.readFileSync((await csvDownload.path()) ?? '', 'utf8');
    expect(csv.split('\n')[0]).toContain('Name');
    expect(csv).toContain('Bitcoin');

    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export To PDF' }).click(),
    ]);
    expect(pdfDownload.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);
    const size = fs.statSync((await pdfDownload.path()) ?? '').size;
    expect(size).toBeGreaterThan(1000); // non-trivial PDF payload
  });

  test('dashboard runs without console errors or failed API calls', async ({ page, seededUser, request }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    await seedPortfolio(request, seededUser.token);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const badResponses: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('requestfailed', (r) => {
      const u = r.url();
      if (u.includes('localhost')) failedRequests.push(`${r.failure()?.errorText} ${u}`);
    });
    page.on('response', (r) => {
      if (r.url().includes('localhost:3000') && r.status() >= 400) {
        badResponses.push(`${r.status()} ${r.url()}`);
      }
    });

    await page.goto('/dashboard');
    await expect(card(page, 'Current Value')).toBeVisible();
    await expect(portfolioTable(page).getByRole('row').filter({ hasText: 'Bitcoin' })).toBeVisible();

    const ctx = {
      pageErrors,
      consoleErrors,
      failedRequests,
      badResponses,
    };
    expect(pageErrors, `pageerrors:\n${JSON.stringify(ctx, null, 2)}`).toEqual([]);
    expect(badResponses, `API 4xx/5xx:\n${JSON.stringify(ctx, null, 2)}`).toEqual([]);
    expect(failedRequests, `failed localhost requests:\n${JSON.stringify(ctx, null, 2)}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${JSON.stringify(ctx, null, 2)}`).toEqual([]);
  });
});
