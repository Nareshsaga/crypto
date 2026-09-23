import { test, expect, applyAuth, API } from '../helpers/auth';

/**
 * On-demand coin predictions — the picker is no longer limited to the six
 * configured coins: any coin can be searched (CoinGecko) and trained, behind
 * the BUG-06 gate.
 *
 * Safety: the API tests only exercise rejection paths (invalid id/ticker/
 * name), all of which return 400 before any spawn. The one flow that reaches
 * the train endpoint with a valid new coin mocks the POST, so no Python
 * process ever starts during a run.
 */

const bitcoinEntry = {
  coin: 'bitcoin',
  name: 'Bitcoin',
  symbol: 'BTC',
  yahooSymbol: 'BTC-USD',
  trainedAt: '2026-09-23T00:00:00Z',
  durationSec: 22,
  source: 'Yahoo Finance',
  summary: {},
};

const polkadotEntry = {
  ...bitcoinEntry,
  coin: 'polkadot',
  name: 'Polkadot',
  symbol: 'DOT',
  yahooSymbol: 'DOT-USD',
};

test.describe('on-demand coin training — validation (API)', () => {
  test('rejects a malformed coin id with 400', async ({ request, seededUser }) => {
    const res = await request.post(`${API}/ml/EVIL/train`, {
      headers: { Authorization: `Bearer ${seededUser.token}` },
      data: { ticker: 'DOT-USD', name: 'Polkadot' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid coin id/i);
  });

  test('rejects an invalid ticker with 400', async ({ request, seededUser }) => {
    const res = await request.post(`${API}/ml/testcoin/train`, {
      headers: { Authorization: `Bearer ${seededUser.token}` },
      data: { ticker: 'hack; rm -rf', name: 'Testcoin' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ticker/i);
  });

  test('rejects a malformed display name with 400', async ({ request, seededUser }) => {
    const res = await request.post(`${API}/ml/testcoin/train`, {
      headers: { Authorization: `Bearer ${seededUser.token}` },
      data: { ticker: 'ABC-USD', name: '<script>' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });
});

test.describe('on-demand coin predictions (UI)', () => {
  test('search → train a new coin → it appears selected in the picker', async ({
    page,
    seededUser,
  }) => {
    await applyAuth(page, seededUser);

    let trained = false;
    let posted: { ticker?: string; name?: string } = {};

    await page.route('**/api/v3/search*', (route) =>
      route.fulfill({
        json: {
          coins: [
            { id: 'polkadot', name: 'Polkadot', symbol: 'dot', market_cap_rank: 12 },
          ],
        },
      }),
    );
    await page.route('**/ml', (route) =>
      route.fulfill({
        json: {
          generatedAt: '2026-09-23T00:00:00Z',
          coins: trained ? [bitcoinEntry, polkadotEntry] : [bitcoinEntry],
        },
      }),
    );
    await page.route('**/ml/bitcoin', (route) =>
      route.fulfill({ status: 404, json: { error: 'No trained model for "bitcoin"' } }),
    );
    await page.route('**/ml/polkadot/train', async (route) => {
      posted = JSON.parse(route.request().postData() ?? '{}');
      trained = true;
      await route.fulfill({ json: { coin: 'polkadot', message: 'Training complete' } });
    });

    await page.goto('/predictions');
    await page.getByLabel('Search any coin to predict').fill('polkadot');
    await page.getByRole('button', { name: /Polkadot/ }).click();

    const trainButton = page.getByRole('button', { name: /Train Polkadot/ });
    await expect(trainButton).toBeEnabled();
    await trainButton.click();

    const chip = page.getByRole('tab', { name: 'DOT' });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute('aria-selected', 'true');
    expect(posted.ticker).toBe('DOT-USD');
    expect(posted.name).toBe('Polkadot');
  });

  test('anonymous searcher gets a locked train affordance', async ({ page }) => {
    await page.route('**/api/v3/search*', (route) =>
      route.fulfill({
        json: {
          coins: [
            { id: 'polkadot', name: 'Polkadot', symbol: 'dot', market_cap_rank: 12 },
          ],
        },
      }),
    );
    await page.route('**/ml', (route) =>
      route.fulfill({ json: { generatedAt: '2026-09-23T00:00:00Z', coins: [bitcoinEntry] } }),
    );
    await page.route('**/ml/bitcoin', (route) =>
      route.fulfill({ status: 404, json: { error: 'No trained model for "bitcoin"' } }),
    );

    await page.goto('/predictions');
    await page.getByLabel('Search any coin to predict').fill('polkadot');
    await page.getByRole('button', { name: /Polkadot/ }).click();

    await expect(page.getByRole('button', { name: 'Log in to train' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Train Polkadot/ })).toHaveCount(0);
  });
});
