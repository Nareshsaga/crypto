import type { Page } from '@playwright/test';
import { test, expect, applyAuth, API } from '../helpers/auth';

/**
 * BUG-06 — POST /ml/:coin/train spawns ~25 s of Python per request. The fix
 * puts it behind the same JWT as every other mutating route, adds a per-user
 * rate limit, and gates the public /predictions retrain button on session.
 *
 * Safety: every API probe uses an unknown coin, so the request dies at the
 * auth gate (401/400/429) before any spawn. The signed-in UI test asserts
 * the button is enabled but never clicks it.
 */

const mlIndex = {
  generatedAt: '2026-09-23T00:00:00Z',
  coins: [
    {
      coin: 'bitcoin',
      name: 'Bitcoin',
      symbol: 'BTC',
      trainedAt: '2026-09-23T00:00:00Z',
      durationSec: 21.5,
    },
  ],
};

/** Self-contained ML reads: index mocked, per-coin model 404s (error callout). */
async function mockMlEndpoints(page: Page): Promise<void> {
  await page.route('**/ml', (route) => route.fulfill({ json: mlIndex }));
  await page.route('**/ml/bitcoin', (route) =>
    route.fulfill({ status: 404, json: { error: 'No trained model for "bitcoin"' } }),
  );
}

test.describe('ML training gate (BUG-06)', () => {
  test('anonymous training request is rejected with 401', async ({ request }) => {
    const res = await request.post(`${API}/ml/bitcoin/train`);
    expect(res.status()).toBe(401);
  });

  test('garbage bearer token is rejected with 401', async ({ request }) => {
    const res = await request.post(`${API}/ml/bitcoin/train`, {
      headers: { Authorization: 'Bearer garbage.token.value' },
    });
    expect(res.status()).toBe(401);
  });

  test('valid session passes the gate; a new coin without a ticker is rejected', async ({
    request,
    seededUser,
  }) => {
    const res = await request.post(`${API}/ml/notacoin/train`, {
      headers: { Authorization: `Bearer ${seededUser.token}` },
    });
    expect(res.status()).toBe(400); // not 401 → auth admitted; validation stops pre-spawn
    const body = await res.json();
    expect(body.error).toMatch(/ticker/i);
  });

  test('one user is rate-limited after the training budget', async ({ request, seededUser }) => {
    const headers = { Authorization: `Bearer ${seededUser.token}` };
    let status = 0;
    // 13 attempts against an untrained coin: 12 pass the gate (400 from
    // validation), the 13th must trip the budget with 429 + Retry-After.
    for (let attempt = 0; attempt < 13 && status !== 429; attempt += 1) {
      const res = await request.post(`${API}/ml/notacoin/train`, { headers });
      status = res.status();
      if (status === 429) {
        expect(res.headers()['retry-after']).toBeTruthy();
        const body = await res.json();
        expect(body.error).toMatch(/too many/i);
      }
    }
    expect(status).toBe(429);
  });

  test('anonymous visitor only gets the locked retrain affordance', async ({ page }) => {
    await mockMlEndpoints(page);
    await page.goto('/predictions');
    await expect(page.getByRole('button', { name: 'Retrain this coin' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Log in to retrain' })).toBeDisabled();
  });

  test('signed-in visitor gets an enabled retrain button', async ({ page, seededUser }) => {
    await applyAuth(page, seededUser);
    await mockMlEndpoints(page);
    await page.goto('/predictions');
    await expect(page.getByRole('button', { name: 'Retrain this coin' })).toBeEnabled();
    // Deliberately not clicked: a real click spawns a ~25 s training job.
  });
});
