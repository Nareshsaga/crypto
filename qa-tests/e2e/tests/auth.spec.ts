import { test, expect, applyAuth } from '../helpers/auth';
import { mockExternalApis } from '../helpers/mocks';

/**
 * Access control around /dashboard (route guard + login/logout lifecycle).
 * Oracle per agentic-browser-testing skill:
 *   PASS = lands on /dashboard with section evidence and a Logout control
 *   FAIL = stuck on /login, or login error visible on the dashboard
 */
test.describe('authentication & route guarding (/dashboard)', () => {
  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Login to your account' })).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    // guard evidence: no dashboard content leaked
    await expect(page.getByText('Portfolio Details', { exact: true })).toHaveCount(0);
  });

  test('invalid credentials show the server error and stay on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill('qa_nobody_987654');
    await page.getByPlaceholder('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Login' }).click();

    // server 400 { error: "Invalid credentials" } → useLogin → red div
    await expect(page.getByText('Invalid credentials', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Login to your account' })).toBeVisible();
    await expect(page.getByText('Portfolio Details', { exact: true })).toHaveCount(0);
  });

  test('valid credentials land on the dashboard (agentic oracle)', async ({ page, seededUser }) => {
    await mockExternalApis(page); // dashboard fires CoinGecko on mount — keep it deterministic
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill(seededUser.username);
    await page.getByPlaceholder('Password').fill(seededUser.password);
    await page.getByRole('button', { name: 'Login' }).click();

    // PASS criteria: URL + section evidence + logout control
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Current Value', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Total Investment', exact: true })).toBeVisible();
    await expect(page.getByText('Portfolio Details', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    // FAIL states must be absent
    await expect(page.getByText('Invalid credentials', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Login to your account' })).toHaveCount(0);
  });

  test('logout ends the session and re-guards /dashboard', async ({ page, seededUser }) => {
    // UI login flow (no addInitScript here): the re-guard check below must see
    // the REAL localStorage state after logout — an init script would re-seed
    // the token on every navigation and invalidate the assertion.
    await mockExternalApis(page);
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill(seededUser.username);
    await page.getByPlaceholder('Password').fill(seededUser.password);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // session must actually be gone: reload + deep link stays guarded
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Login to your account' })).toBeVisible();
  });
});
