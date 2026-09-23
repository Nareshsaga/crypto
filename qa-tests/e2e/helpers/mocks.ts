import type { Page } from '@playwright/test';

/**
 * Deterministic market fixture — the suite never hits real third-party
 * services (playwright-automation anti-pattern list). Prices chosen so the
 * math assertions in dashboard.spec.ts are trivially verifiable:
 *   bitcoin @ $100, ethereum @ $50.
 * Image points at the app's own public asset to avoid external fetches.
 */
export const MOCK_COINS = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    image: '/logo.png',
    current_price: 100,
    market_cap_rank: 1,
    price_change_percentage_24h: 2.5,
    market_cap: 2_000_000_000_000,
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    image: '/logo.png',
    current_price: 50,
    market_cap_rank: 2,
    price_change_percentage_24h: -1.25,
    market_cap: 900_000_000_000,
  },
];

export const MOCK_RATES = {
  base: 'USD',
  rates: { EUR: 0.9, GBP: 0.8 },
};

/**
 * Replace the app's two external dependencies:
 *  - CoinGecko market data (home table + dashboard portfolio pricing)
 *  - Frankfurter currency rates (currency selector options + conversion)
 * Route predicates match by hostname so every endpoint variant is covered.
 */
export async function mockExternalApis(page: Page): Promise<void> {
  await page.route(
    (url) => url.hostname === 'api.coingecko.com',
    (route) => route.fulfill({ json: MOCK_COINS }),
  );
  await page.route(
    (url) => url.hostname === 'api.frankfurter.dev',
    (route) => route.fulfill({ json: MOCK_RATES }),
  );
}
