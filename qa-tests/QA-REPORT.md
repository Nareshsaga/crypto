# QA Report — CryptoTrack `/dashboard`

| | |
|---|---|
| **Target** | http://localhost:5173/dashboard (Vite/React SPA) + API http://localhost:3000 (Express/Mongo) |
| **Date** | 2026-09-23 |
| **Scope** | Full QA pass per the installed qa-skills library (project scope `.opencode/skills/`, 50 skills), charter: the dashboard at `http://localhost:5173/dashboard`, plus the auth wall and API layer that back it |
| **Skills applied** | `qa-project-context` (context file) → `agentic-browser-testing` (oracle design) → `exploratory-testing` (session log) → `accessibility-testing` (axe/WCAG 2.2 AA) → `playwright-automation` (suite engineering) |
| **Tools** | Playwright 1.63.0 (Chromium 1243), @axe-core/playwright (tags: wcag2a, wcag2aa, wcag22aa), TypeScript strict, Node v24.13.0, npm 11.6.2 |
| **Suite** | `qa-tests/` — self-contained package, app manifests untouched |

---

## 1. Results summary

| Layer | Tests | Passed | Failed |
|---|---|---|---|
| API (phase 1, direct HTTP vs :3000) | 18 | 18 | 0 |
| UI functional (`auth.spec.ts`, `dashboard.spec.ts`) | 14 | 14 | 0 |
| Defect regression (`dashboard-defects.spec.ts`, DEF-01…04) | 4 | 4 | 0 |
| **Total** | **36** | **36** | **0** |

Final run: `18 passed in 14.6 s` (6 workers, **exit code 0**) — following the fix round (§2): all four DEF tests, authored to fail against the original build as defect evidence, now **pass** and stand as permanent regression tests.

```powershell
cd qa-tests
npm test                          # → 18/18 green (auto-starts Vite/Express if down)
npx playwright test e2e/tests/dashboard-defects.spec.ts   # → 4/4 DEF regressions
```

### 1.1 What passed (UI, 14)

| # | Test | Oracle |
|---|---|---|
| 1 | unauthenticated `/dashboard` → `/login` | guard redirect; no dashboard content leaked |
| 2 | invalid credentials | red `"Invalid credentials"` (server 400 body), stays on `/login` |
| 3 | valid login | URL `/dashboard` + Current Value + Total Investment + Portfolio Details + Logout; error states absent |
| 4 | logout lifecycle | → `/login`, `localStorage.token === null`, reload re-guarded |
| 5 | empty-portfolio oracle | `$0.00` ×2 (cents format), `0.00%`, all three empty states, **zero page errors** |
| 6 | add BTC from home table | invested **$100** / value **$200** / **+100.00%** (2×$50 vs mocked $100), row + recharts render, empty states cleared |
| 7 | form validation | zero amount → `"Amount cannot be empty or zero."`; then zero price → `"Buy price cannot be empty or zero."`; never submits |
| 8 | sell > owned | `"Amount exceeds your owned Bitcoin."` + `"You have 0.001 coins."`, form stays open |
| 9 | full sell | toast `"Coin removed from portfolio."`, position deleted server-side, `$0.00` + empty states restored |
| 10 | watchlist star | API round-trip proven: `GET /watchlist` contains then omits `bitcoin` after each UI click |
| 11 | currency → EUR | `$100` → **`€90`** (rate 0.9, Intl currency code switched), select value `EUR` |
| 12 | theme toggle | `html` gains then loses class `dark` |
| 13 | exports | `portfolio_report.csv` (header + `Bitcoin` row verified) and `.pdf` (>1 kB) via download events |
| 14 | runtime health | 0 console errors, 0 pageerrors, 0 failed localhost requests, 0 API 4xx/5xx across the dashboard lifecycle |

### 1.2 API layer (phase 1, 18/18)

register ✓ · duplicate register → 400 ✓ · login ✓ · wrong password → 400 `"Invalid credentials"` ✓ · no token → 401 ✓ · garbage token → 401 ✓ · portfolio add ✓ · sell > owned → 400 ✓ · sell not-owned → 400 ✓ · invalid types → 400 `"Invalid input data"` ✓ · watchlist add/get/remove round-trip ✓ · full sell deletes position ✓ · CORS rejects evil origin ✓ · PUT `/portfolio/update` accepts `{ coin, coinData }` ✓ · auth errors → 500 `"Authentication error"` path ✓.

---

## 2. Defects

Severity: **High / Medium / Low**. Every defect has a runnable test:
`npx playwright test e2e/tests/dashboard-defects.spec.ts -g "DEF-0X"`.

> **Status 2026-09-23 — fix round:** BUG-01…05 and BUG-07 are **FIXED** in the app and
> the corresponding DEF tests now **pass** (they were written to fail against the original
> build; they now lock the corrected behavior in as regressions). **BUG-06 remains OPEN**
> — it needs an owner decision (see its entry). Applied changes: §2.8.

### DEF-01 · BUG-01 — Client never validates the session; no 401 handling — **High**
- **Evidence:** `DEF-01` test seeds `token = "garbage.token.value"` → app still renders `/dashboard` instead of redirecting to `/login` (test fails = defect present).
- **Root cause:** `Client/src/context/AuthContext.jsx:18-27` authenticates purely on *presence* of `localStorage.token`; nothing ever checks expiry/signature, and no API layer reacts to 401 (`App.jsx:55-57` only `console.error`s the failed load and keeps stale state).
- **Impact:** expired or invalid sessions silently show stale/empty dashboards; server data stays protected (401s verified in phase 1) but the user is never re-prompted; any crafted token string yields a “logged in” UI.
- **Fix hint:** decode/validate `exp` on boot; global 401 interceptor → `authLogout()` + `<Navigate to="/login">`.
- **Status: FIXED** — `AuthContext.jsx` now decodes the JWT payload on boot (malformed → `atob`/`JSON.parse` throws → treated as no session; `exp` in the past → expired; corrupt `user` JSON is caught too) and clears the keys so the route guard falls back to `/login`; `services/api.js` gained a response interceptor that on **401** clears `token`/`user` and re-authenticates (`/login`). `DEF-01` **passes**.

### DEF-02 · BUG-02 — Dashboard has no level-1 heading — **Medium** (WCAG 2.4.6)
- **Evidence:** `DEF-02` → `getByRole('heading', { level: 1 })` count **0** on `/dashboard`.
- Hierarchy starts at `<h2>` (`Dashboard.jsx:104,133,151,192`); Home (`Home.jsx:33`) and Login (`Login.jsx:17`) *do* have h1 — inconsistent page structure, screen-reader users get no page title landmark.
- **Status: FIXED** — a single page-level `<h1>Dashboard</h1>` (light/dark aware) heads the dashboard container. `DEF-02` **passes** (exactly one level-1 heading).

### DEF-03 · BUG-03 — axe scan, default dashboard: **4 violating rule groups** — High/Medium
Expected `[]`, actual (JSON attached in failure trace, `axe-default-state`):

| Rule | Impact | Nodes | Element (from source) | WCAG |
|---|---|---|---|---|
| `button-name` | **critical** | 1 | watchlist star — icon-only, no `aria-label` (`CoinRow.jsx:74`, `PortfolioCoinRow.jsx:73`) | 4.1.2 A |
| `select-name` | **critical** | 1 | currency `<select>` with no label/aria (`CurrencySelector.jsx:29`, rendered twice in header) | 4.1.2 A |
| `color-contrast` | serious | 10 | gray-on-white text groups (card headings, table/attribution text — see trace node list) | 1.4.3 AA |
| `list` | serious | 1 | `<ul>` wraps non-`<li>` children: theme div, select, logout control (`Header.jsx:22`) | wcag2a per axe tags |

- **Status: FIXED** — every rule back to **0 violations** (`DEF-03` **passes**):
  `button-name` → `aria-label`s on both star buttons; `select-name` → `aria-label="Currency"`;
  `color-contrast` → the ten nodes were: profit chip green-600 on white (3.21:1), the
  seven `th` headers gray-500 on slate-100 (4.41:1), the empty-state `td` (4.41:1), and the
  seeded row's red profit (4.36:1) + white-on-green-600 "Add" (3.21:1) — all moved to
  gray-600 / green-700 / red-700 (with `dark:` variants), incl. the shared `utils/color.js`;
  `list` → `Header.jsx` rewritten so every direct `<ul>` child is an `<li>` (also fixed a
  literal tab typo inside the `dark:hover:bg-blue-500/1\t0` class).

### DEF-04 · BUG-04 — axe scan, add-coin form open: **5 violating rule groups** — High/Medium
JSON attached as `axe-form-open`:

| Rule | Impact | Nodes | Element | WCAG |
|---|---|---|---|---|
| `label` | **critical** | 2 | both form inputs unlabeled — labels exist but have no `htmlFor`, inputs no `id` (`Form.jsx:108/112`, `123/127`) | 1.3.1 / 3.3.2 A |
| `button-name` | **critical** | 1 | form close button, icon-only (`Form.jsx:81`) | 4.1.2 A |
| `select-name` | **critical** | 1 | header currency select | 4.1.2 A |
| `color-contrast` | serious | 1 | form control text (likely white-on-green submit, `Form.jsx:143-148`) | 1.4.3 AA |
| `list` | serious | 1 | header `<ul>` | wcag2a per axe tags |

- **Status: FIXED** — **0 violations** (`DEF-04` **passes**): `label` → `htmlFor`/`id`
  (`trade-price`, `trade-amount`, so the suite's inputs are now addressed via
  `getByLabel`); `button-name` → close button `aria-label="Close form"`; the submit
  button's white-on-green-600 (3.21:1) → `bg-green-700`/`bg-red-700` (4.95:1 / 6.43:1);
  `select-name` + `list` fixed as part of DEF-03.

### BUG-05 — Core controls unreachable by keyboard — **High** (WCAG 2.1.1 A)
Static finding (axe cannot flag unnamed divs as controls): interactive `<div onClick>` **without `role`/`tabindex`/key handler** — invisible to Tab traversal, mouse-only:
- theme toggle — `Header.jsx:114` (mobile twin `:130`)
- **Export To CSV / Export To PDF** — `PortfolioTable.jsx:34,51`
- **Top Gainers / Top Losers tabs** — `TopCoins.jsx:54,66`
- The watchlist star is a `<button>` (focusable) but has no accessible name → same users hit BUG-03.
Repro (manual): load `/dashboard`, press Tab from the address bar — none of the above ever receive focus.
- **Status: FIXED** — all listed controls are now real `<button type="button">` elements
  (shared labelled theme toggle ×2, Export CSV/PDF ×2, Top Coins tabs as a proper
  `role="tablist"`/`role="tab"` + `aria-selected` set); star and search icon buttons carry
  `aria-label`s; the hamburger got `aria-label` + `aria-expanded`. The suite's locators were
  upgraded to role/name (`getByRole('button', …)`), so keyboard operability is what the
  tests now click through.

### BUG-06 — Unauthenticated ML training endpoint (resource abuse) — **Medium** · *QUESTION: intended?*
- `Server/server.js` ML section: `POST /ml/:coin/train` has **no auth middleware** (every other mutating route requires Bearer JWT) and spawns `python ml/train.py` (~25 s typical, 5-min watchdog).
- The `/predictions` page is intentionally **public for reading models** (`App.jsx:245-246` comment), but it renders a **“Retrain this coin”** button (`Predictions.jsx:188` → `trainCoin`, `:108`) — so anonymous visitors can queue repeated expensive jobs (6-coin allowlist; concurrency guard only prevents *same-coin* overlap).
- **Evidence, without triggering training** (safe: the coin-allowlist check runs before any `spawn`):

  ```powershell
  curl.exe -s -X POST http://localhost:3000/ml/notacoin/train
  # → HTTP 404 {"error":"Unknown coin \"notacoin\"","available":[…]}   ← no 401 first ⇒ no auth gate
  curl.exe -s http://localhost:3000/ml
  # → HTTP 200 full model index (6 models, metrics, forecasts) — read-open by design,
  #   matching the "public page" comment; the mutation endpoint sharing that openness is the concern
  ```
- **Ask:** confirm whether public *retraining* is a deliberate demo behavior; if not, require JWT + rate-limit.

### BUG-07 — Shipped debug logging — **Low**
`Dashboard.jsx:24` — `console.log("DASHBOARD IS RENDERING")` executes on every dashboard render.
- **Status: FIXED** — statement removed; the runtime-health test (0 console errors) guards it.

### 2.8 Applied fix log (2026-09-23)

| File | Change |
|---|---|
| `context/AuthContext.jsx` | boot-time session validation (`readValidSession`: base64url JWT decode, `exp` check, corrupt-JSON catch); invalid/expired → keys cleared |
| `services/api.js` | 401 response interceptor → clear session, re-authenticate at `/login` |
| `pages/Dashboard.jsx` | added `<h1>Dashboard</h1>` (BUG-02/DEF-02); removed debug `console.log` (BUG-07); profit chip green-600 → green-700 (+dark); chart error text red-500 → red-700 |
| `components/Header.jsx` | `<ul>` children all `<li>` (axe `list`); theme `div onClick` → labelled `<button>` (BUG-05); fixed `blue-500/1\t0` typo; hamburger `aria-label`/`aria-expanded` |
| `components/Form.jsx` | `htmlFor`/`id` on both inputs; close button `aria-label`; submit green/red-600 → 700 (contrast); warning red-500 → red-700 |
| `components/CurrencySelector.jsx` | `aria-label="Currency"`; error text red-500 → red-700 |
| `components/CoinRow.jsx`, `PortfolioCoinRow.jsx` | star `aria-label` (Add/Remove … to watchlist); row Add/Remove bg 600 → 700; symbol gray-500 → gray-600 |
| `components/PortfolioTable.jsx` | export divs → buttons (BUG-05); `th`/empty/loading `td` gray-500 → gray-600; error `td` red-500 → red-700 |
| `components/TopCoins.jsx` | tab divs → `role=tab` buttons + `aria-selected` (BUG-05); error text red-700 |
| `components/Coin.jsx`, `utils/color.js` | profit colors green/red-600 → 700 (+dark variants) — contrast 3.21:1/4.36:1 → ≥4.9:1 |
| `components/Searchbar.jsx` | search button `aria-label` (icon-only, same class as BUG-03) |
| `qa-tests/e2e/tests/dashboard.spec.ts` | locators upgraded to the new accessible names (`getByLabel`, `getByRole('button', { name })`); zero-total oracle `$0` → `$0.00` to match the **committed** `formatCurrency` cents contract (user edit, `CurrencyContext.jsx` — not part of this fix round) |

**Untouched by design:** `Server/` (BUG-06 awaits the owner's decision), the user's ML work
(`Predictions`, `useML`, `components/ml/*`, `ml/`).

### Corrections / non-defects (honest record)
- **Withdrawn:** initial static pass flagged “mobile hamburger dead / Menu never mounted”. Post-restart re-read of `App.jsx:155-161` shows `menu`/`toggleMenu` **are** passed and `<Menu>` is rendered behind `AnimatePresence`; hamburger wired at `Header.jsx:145`. Not reproducible → **not a defect**.
- `AuthContext.logout` correctly clears storage (`:37-38`) — an early logout-test failure was **test-side** (`addInitScript` re-seeding the token on navigation), fixed by switching that test to the real UI login flow; the fix now also asserts token removal.
- ARIA is present and well used in the new ML components (`role=tablist/aria-selected/role=group` in `Predictions.jsx`, `components/ml/*`) — the gap is only in the original core screens.

---

## 3. Exploratory session log (tagged)

| Seq | Tag | Entry |
|---|---|---|
| S1 | NOTE | qa-skills installed at project scope (50 skills → `.opencode/skills/`); context file `.agents/qa-project-context.md` written (required first step). |
| S1 | NOTE | Environment: :5173 + :3000 both verified up; `Server/.env` `PORT=3000`, `CLIENT=http://localhost:5173`. |
| S1 | NOTE | Phase 1 — API layer driven directly over HTTP: **18/18 pass**; validation/auth/CORS rules catalogued as oracles. |
| S2 | BUG-01 | Static read: AuthContext trusts localStorage presence only; no 401 path anywhere → later confirmed by DEF-01 failure. |
| S2 | NOTE | Determinism contract chosen: mock `api.coingecko.com` (BTC=$100, ETH=$50) + `api.frankfurter.dev` (EUR=0.9) via `page.route`; seed users/portfolio via API; deep-link auth by seeding `token`/`user` localStorage keys. |
| S2 | IDEA | Money oracles asserted with `toContainText` on single-resolved cards so assertions don’t depend on nested text-node resolution. |
| S3 | NOTE | Env restart flattened repo (`Client/`/`Server/` at root). Re-checked diffs: font imports, `index.css` type system, **new ML endpoints appended** to `server.js` — auth/portfolio/watchlist routes untouched. |
| S3 | RISK | Uncommitted user work present (`ml/`, `Predictions`, `useML`) → suite tested against current working tree; `/predictions` declared out of charter. |
| S4 | NOTE | Suite authored: 18 tests / 3 files; `tsc --noEmit` strict clean; grep proves **0× `waitForTimeout`**. |
| S4 | BUG (test) | Run #1 logout re-guard failed → root-caused as *test* bug: `addInitScript` re-seeds token on every navigation. Fixed via UI-login flow; added `localStorage.token === null` assertion (regression value kept). |
| S4 | BUG-01…04 | Run #2: all four DEF tests fail exactly as specified — evidence captured (screenshots + traces + axe JSON). |
| S4 | NOTE | Final: **14/14 functional green, 4/4 intended-defect red, 12.8 s**. |
| S4 | BUG-06 | While bounding `/predictions` scope: unauthenticated `POST /ml/:coin/train` discovered (spawns Python). Verified with safe non-spawning request (`notacoin` → 404 past the auth point). Tagged QUESTION — confirm intent. |
| S4 | BUG-05 | Keyboard reachability gap compiled from `onClick` inventory (theme/exports/tabs are divs). |
| S4 | QUESTION | Is public *retraining* (BUG-06) intended, or only public *reading* of models? |
| S5 | NOTE | Fix round begun: one-off axe probe (`qa-tests/_axe-probe.cjs`) dumped exact violation node targets — pinned the 10 contrast nodes (th ×7 on slate-100, profit chip, empty `td`, seeded row's red profit + green Add) instead of guessing. |
| S5 | BUG-01…07 | Fixes applied per §2.8 (app code only; Server/ML untouched). |
| S5 | BUG (test) | First re-run: DEF-01…04 **all green** + 16/18 functional; two failures were the exact `$0` oracles — root-caused as a *contract drift*: the user's committed `formatCurrency` now renders cents (`$0.00`). Oracles aligned to the committed contract (substring oracles `$100`/`€90` were already format-agnostic). |
| S5 | NOTE | Final: **18/18 UI green in 14.6 s, exit code 0** (DEF tests now regressions); API layer 18/18 from phase 1 → **36/36**. |

---

## 4. Coverage gaps & risk-based next steps

1. **Cross-browser** — Chromium only; add Firefox/WebKit projects (`cross-browser-testing`).
2. **Visual regression** — no baselines yet; screenshots taken are evidence, not diffs (`visual-testing`).
3. **Mobile viewport pass** — desktop-only automation; a 390 px charter should cover the hamburger → `Menu` flow (`mobile-testing` / exploratory charter).
4. **`/watchlist` & `/signup` UI** — guarded/round-trip covered indirectly; no dedicated page specs yet.
5. **`/predictions` + ML endpoints** — out of charter; only BUG-06 touched it; user-side `_verify.cjs` scripts exist in `qa-tests/` (external, untouched, not in `testDir`).
6. **Performance/load** — unauthenticated training spawn makes abuse a perf+security concern (ties to BUG-06).
7. **Session-expiry UX matrix** — beyond DEF-01: mid-session expiry, concurrent logout in two tabs.

---

## 5. Evidence & re-run

```powershell
cd C:\Users\nares\Downloads\CryptoTrack-main\qa-tests
npm test                       # playwright test — auto-starts Vite/Express if down, reuses if up
npx playwright show-report     # HTML report (playwright-report/)
npx playwright show-trace test-results\<dir>\trace.zip   # incl. axe JSON attachments
```

| Artifact | Path |
|---|---|
| Evidence screenshots (last green run) | `qa-tests/e2e/screenshots/dashboard-empty.png`, `…-with-bitcoin.png`, `…-dark.png` |
| axe JSON | attached on every run as `axe-default-state` / `axe-form-open` — open via `npx playwright show-report` |
| Pre-fix failure artifacts | superseded: `test-results/` is rewritten each run; the original DEF-01…04 failures are recorded in §2 + §3 (S4) and the assertions themselves |
| Suite hygiene | 0× `waitForTimeout`, auto-waiting role/name/label locators, per-test seeded users, all third-party APIs mocked |
