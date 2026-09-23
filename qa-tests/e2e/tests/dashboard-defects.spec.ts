import AxeBuilder from '@axe-core/playwright';
import { test, expect, applyAuth, seedPortfolio } from '../helpers/auth';
import { mockExternalApis } from '../helpers/mocks';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * KNOWN-DEFECT REPRODUCTIONS — EXPECTED TO FAIL against the current build.
 *
 * Each test asserts the CORRECT behavior, not the current behavior.
 * A failure here is defect EVIDENCE, referenced by ID in QA-REPORT.md.
 * Do not weaken these assertions to make the suite green; fix the app.
 *
 * DEF-01  invalid session token does not force re-authentication
 * DEF-02  dashboard has no level-1 heading (WCAG 2.4.6 / structure)
 * DEF-03  axe scan (default dashboard) — non-zero WCAG 2.2 A/AA violations
 * DEF-04  axe scan (add-coin form open) — non-zero WCAG 2.2 A/AA violations
 * ═══════════════════════════════════════════════════════════════════════
 */

test.describe('known defects — assertions encode correct behavior', () => {
  test('DEF-01: invalid session token must force re-authentication (/login)', async ({ page }) => {
    await mockExternalApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('token', 'garbage.token.value');
      localStorage.setItem('user', JSON.stringify({ id: 'x', username: 'ghost' }));
    });

    await page.goto('/dashboard');
    // Correct behavior: token rejected → route guard must fall back to /login.
    // Current behavior: app accepts the garbage token client-side and renders
    // /dashboard with silently empty data (no 401 handling / session expiry).
    await expect(page).toHaveURL(/\/login$/);
  });

  test('DEF-02: dashboard exposes exactly one level-1 heading', async ({ page, seededUser }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);

    await page.goto('/dashboard');
    // Correct behavior: one <h1> naming the page (WCAG 2.4.6 page titled /
    // structure). Current behavior: zero — the page starts at <h2>.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('DEF-03: axe scan of the default dashboard reports zero violations', async ({ page, seededUser, request }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    await seedPortfolio(request, seededUser.token);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 2, name: 'Current Value', exact: true })).toBeVisible();
    // let both chart fetches settle so icon-only buttons/charts are in the scan
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    await test.info().attach('axe-default-state', {
      body: JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map((n) => n.target),
        })),
        null,
        2,
      ),
      contentType: 'application/json',
    });

    expect(
      results.violations.map((v) => `${v.id} [${v.impact}] ${v.help} → ${v.nodes.length} node(s)`),
    ).toEqual([]);
  });

  test('DEF-04: axe scan with the add-coin form open reports zero violations', async ({ page, seededUser, request }) => {
    await mockExternalApis(page);
    await applyAuth(page, seededUser);
    await seedPortfolio(request, seededUser.token);

    await page.goto('/dashboard');
    await page
      .locator('table')
      .filter({ hasText: 'Coins Purchased' })
      .getByRole('row')
      .filter({ hasText: 'Bitcoin' })
      .getByRole('button', { name: 'Add', exact: true })
      .click();
    await expect(page.locator('div.shadow-2xl')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();

    await test.info().attach('axe-form-open', {
      body: JSON.stringify(
        results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map((n) => n.target),
        })),
        null,
        2,
      ),
      contentType: 'application/json',
    });

    expect(
      results.violations.map((v) => `${v.id} [${v.impact}] ${v.help} → ${v.nodes.length} node(s)`),
    ).toEqual([]);
  });
});
