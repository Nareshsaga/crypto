import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test';

export const API = process.env.API_URL ?? 'http://localhost:3000';

export type SeededUser = {
  username: string;
  password: string;
  token: string;
  user: { id: string; username: string };
};

/**
 * Registers a unique user through the real API and logs in, yielding a valid
 * JWT. Seeded per test → full test isolation (playwright-automation fixtures,
 * not hooks).
 */
export const test = base.extend<{ seededUser: SeededUser }>({
  seededUser: async ({ request }, use) => {
    const username = `qa_pw_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const password = 'Test1234!';

    const reg = await request.post(`${API}/register`, {
      data: { username, password },
    });
    expect(reg.ok(), `register failed: ${reg.status()}`).toBeTruthy();

    const login = await request.post(`${API}/login`, {
      data: { username, password },
    });
    expect(login.ok(), `login failed: ${login.status()}`).toBeTruthy();
    const body = await login.json();
    expect(body.token, 'login must return a JWT').toBeTruthy();

    await use({ username, password, token: body.token, user: body.user });
  },
});

/**
 * Deep-link past the login screen (agentic-browser-testing: seeded entry
 * point) by installing the same localStorage keys AuthContext reads.
 */
export async function applyAuth(page: Page, user: SeededUser): Promise<void> {
  await page.addInitScript(
    ([token, userJson]) => {
      localStorage.setItem('token', token as string);
      localStorage.setItem('user', userJson as string);
    },
    [user.token, JSON.stringify(user.user)],
  );
}

/** Seed a portfolio position directly through the API (deterministic data). */
export async function seedPortfolio(
  request: APIRequestContext,
  token: string,
  coin = 'bitcoin',
  totalInvestment = 100,
  coins = 0.001,
): Promise<void> {
  const res = await request.put(`${API}/portfolio/update`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { coin, coinData: { totalInvestment, coins } },
  });
  expect(res.ok(), `portfolio seed failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export { expect };
