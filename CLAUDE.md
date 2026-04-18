# CLAUDE.md — tayrax

Guidelines for working on this project. Read `docs/tayrax.md` for the full product plan.

---

## Project Overview

**tayrax** is a crypto monitoring and trading assistant PWA.
- Real-time price data via WebSocket (CoinCap, Binance)
- Background market data via REST (CoinGecko)
- No backend — runs entirely in the browser
- Hosted at `tayrax.github.io`

---

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Framework:** Svelte + Vite
- **App type:** PWA (Service Worker + Web App Manifest)
- **Styling:** plain CSS or CSS custom properties — no UI framework, no Tailwind

---

## Project Structure

```
tayrax/
├── src/
│   ├── lib/
│   │   ├── config.ts         # SUPPORTED_ASSETS, MANDATORY_ASSET, PRICE_PROVIDER, windows, storage keys
│   │   ├── provider.ts       # PriceProvider interface + shared types (PriceTick, etc.)
│   │   ├── websocket.ts      # CoinCap price WebSocket (PriceFeed implements PriceProvider)
│   │   ├── binance-price.ts  # Binance miniTicker price WebSocket (BinancePriceFeed)
│   │   ├── binance.ts        # Binance multi-interval kline WebSocket (BinanceKlineFeed — all CandleIntervals on one combined stream)
│   │   ├── symbols.ts        # CoinCap id ↔ Binance symbol mapping
│   │   ├── prices.ts         # Price store + 1h rolling history + snapshot cache
│   │   ├── volumes.ts        # Volume store + volumeSpikeRatio
│   │   ├── alert-core.ts     # Pure types + evaluate() + localStorage helpers; safe for worker imports
│   │   ├── alerts.ts         # Tab-side mirror store; addAlert/removeAlert post to worker
│   │   ├── proposals.ts      # Trade proposal types, evaluateProposals(asset, interval, …), per-asset+interval+signal cooldown (Phase 3)
│   │   ├── notifications.ts  # Web Notifications API wrapper
│   │   ├── logs.ts           # Action log store (ring buffer, cross-tab synced)
│   │   ├── candles.ts        # OHLCV candle store (ring buffer, CANDLE_HISTORY_MAX, persistence)
│   │   ├── backfill.ts       # Binance REST /api/v3/klines historical seed on startup
│   │   ├── indicators.ts     # SMA, EMA, RSI, MACD, Bollinger Bands (Phase 2)
│   │   ├── enabled-assets-core.ts # Pure helpers: load/persist/applyToggle/computeExpired; safe for worker imports
│   │   ├── enabled-assets.ts # Tab-side mirror store; toggleAsset posts to worker
│   │   ├── bot-types.ts      # Shared message types between SharedWorker and tabs (WorkerToTab, TabToWorker, BotState)
│   │   ├── bot-engine.ts     # Core engine: owns alerts+enabledAssets+disabledAt state, feed lifecycle, evaluation, backfill, logAction
│   │   ├── bot.worker.ts     # SharedWorker entry: port management, routes messages to BotEngine
│   │   └── bot-client.ts     # BotClient + SharedWorkerBotClient + createBotClient() + getBotClient() singleton
│   ├── components/
│   │   ├── PriceCard.svelte
│   │   ├── AlertForm.svelte
│   │   ├── AlertList.svelte
│   │   ├── NavMenu.svelte      # Clickable logo → dropdown nav (Dashboard / System / Logs / Bot)
│   │   ├── CoinSelector.svelte # Checkbox list of SUPPORTED_ASSETS; bitcoin locked; calls toggleAsset
│   │   └── Chart.svelte        # SVG candlestick chart with SMA/BB overlays + RSI/MACD sub-pane
│   ├── App.test.ts           # Root app smoke tests (mounts, layout, WebSocket + SharedWorker stubbed)
│   ├── test-setup.ts         # Vitest global setup: jest-dom matchers + afterEach cleanup
│   ├── vitest-matchers.d.ts  # TypeScript augmentation for jest-dom matchers on Vitest's Assertion
│   ├── App.svelte
│   ├── System.svelte         # /system/ diagnostic page (browser caps + WS tests)
│   ├── Logs.svelte           # /logs/ action-log viewer (reverse-chrono, filter, clear)
│   ├── Help.svelte           # /help/ help page (how it works, warm-up notes)
│   ├── Bot.svelte            # /bot/ bot console (feed status, errors, reconnect controls)
│   ├── app.css
│   ├── main.ts
│   ├── system.ts             # Entry point for system/index.html
│   ├── logs.ts               # Entry point for logs/index.html
│   ├── help.ts               # Entry point for help/index.html
│   └── bot.ts                # Entry point for bot/index.html
├── static/                   # Vite publicDir — copied to site root at build
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker (stale-while-revalidate shell)
│   ├── tayrax-logo.svg
│   └── tayrax-logo.png
├── .github/workflows/deploy.yml  # GitHub Pages deploy (main → Pages)
├── index.html                # Main app entry point
├── system/index.html         # Diagnostic page entry (multi-page Vite app) → /system/
├── logs/index.html           # Action-log page entry (multi-page Vite app) → /logs/
├── help/index.html           # Help page entry (multi-page Vite app) → /help/
├── bot/index.html            # Bot console entry (multi-page Vite app) → /bot/
├── vite.config.ts            # publicDir: 'static', base: TAYRAX_CDN env var (falls back to / in prod, localhost:5173 in dev), rollupOptions.input for each page
├── vitest.config.ts          # Vitest: jsdom env, svelte plugin, setupFiles
├── svelte.config.js
├── tsconfig.json
├── docs/tayrax.md            # Product plan and roadmap
└── CLAUDE.md                 # This file
```

Note: `static/` is Vite's `publicDir`. All files here are served from the site
root (`/manifest.json`, `/sw.js`, `/tayrax-logo.svg`). Do not create a separate
`public/` directory — keep PWA assets and logos together in `static/`.

---

## Development Phases

The project is built incrementally. Do not implement features from a later phase until the current one is complete and stable.

1. **Phase 1 — Simple Alerts:** live prices + user-defined alert rules + browser notifications ✅ Complete
2. **Phase 2 — Technical Indicators:** OHLCV charts, RSI/SMA/MACD/Bollinger Bands, signal alerts ✅ Complete
3. **Phase 3 — Semi-Automatic Trading:** indicator-driven trade proposals logged to action log (Phase 3a, no exchange required); exchange API integration + order execution (Phase 3b)
4. **Phase 4 — Fully Automatic Trading:** autonomous execution, paper trading mode, risk management

---

## APIs

| API | Usage | Notes |
|---|---|---|
| CoinCap WebSocket | Real-time prices | `wss://ws.coincap.io/prices?assets=...` |
| Binance WebSocket | Candlesticks, order book | `wss://stream.binance.com:9443/ws/...` |
| CoinGecko REST | Asset list, market cap, history | 50 req/min on free key |

- Both CoinCap and Binance allow direct browser requests (CORS is open for public endpoints)
- No proxy or backend needed for public market data
- For Phase 3+, exchange API keys must **never** be hardcoded or committed to git

---

## Asset Configuration

`SUPPORTED_ASSETS` in `config.ts` is the static compile-time registry of all coins the app knows about. It is the source of truth for `CoinSelector` and for `AssetId` typing. Feeds are **not** started for all supported assets — only for the user's enabled set.

```typescript
export const SUPPORTED_ASSETS = ['bitcoin', 'ethereum', 'solana', 'cardano'] as const;
export const MANDATORY_ASSET: AssetId = 'bitcoin'; // always tracked, cannot be disabled
export const DEFAULT_ENABLED_ASSETS: AssetId[] = ['bitcoin']; // default on first load
```

`enabledAssets` (`src/lib/enabled-assets.ts`) is the tab-side mirror of the worker's authoritative enabled-assets list. The store hydrates from `localStorage` at module load (for instant first render) and is then overwritten by `enabledAssetsList` broadcasts from the worker. `toggleAsset(id)` posts a `toggleAsset` message to the worker — the worker applies the toggle (bitcoin guarded), persists, and broadcasts. The worker (`BotEngine` in `bot-engine.ts`) owns `disabledAt` timestamps, computes expired assets on boot (> `DISABLED_ASSET_PRUNE_AFTER_MS` = 3 days), and hands off a one-time `pruneAssets` message to the first tab that connects. Tabs receive that message and run `pruneAssets` / `pruneCandles` / `pruneVolumes` to drop tab-side store data. Re-enabling within the grace period keeps all persisted history.

**Feed reconnection:** The worker's `BotEngine` owns the price and kline feed instances. When the enabled set changes (via `toggleAsset` or the internal `setEnabledAssets` bulk helper), it tears down existing feeds and starts new ones for the updated list, calling `backfillAll` only for newly added coins. Tabs never instantiate feeds directly — they only listen for `priceTick` / `closedCandle` / `priceStatus` / `klineStatus` broadcasts.

---

## Price Provider

The live price WebSocket source is selected by `PRICE_PROVIDER` in `config.ts`:

```typescript
export const PRICE_PROVIDER: 'coincap' | 'binance' = 'binance';
```

| Value | Class | Stream |
|---|---|---|
| `'binance'` | `BinancePriceFeed` (`binance-price.ts`) | `wss://stream.binance.com:9443/stream?streams=...@miniTicker` |
| `'coincap'` | `PriceFeed` (`websocket.ts`) | `wss://ws.coincap.io/prices?assets=...` |

`App.svelte` calls `createPriceFeed()` at startup, which reads `PRICE_PROVIDER` and instantiates the right class. Both implement the `PriceProvider` interface (`provider.ts`). To add a new provider, implement `PriceProvider`, add it to the union type in `config.ts`, and add a branch in `createPriceFeed()`.

CoinCap API key support is planned for a future version — do not implement it yet.

---

## Coding Conventions

- Every source file must begin with the copyright header, followed by a blank line before the first line of code:
  - `.ts` files: `// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>` / `// See LICENSE file.`
  - `.svelte` files: `<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->` / `<!-- See LICENSE file. -->`
- TypeScript strict mode — no `any`, no implicit types
- Prefer named exports over default exports in `.ts` files
- Svelte components use `<script lang="ts">`
- WebSocket connections must handle reconnection automatically (exponential backoff, capped at 30s)
- Keep business logic (alerts, indicators, WebSocket) in `src/lib/`, not inside components
- One responsibility per file — don't mix WebSocket logic with indicator math
- Unit tests and component tests live alongside source files as `*.test.ts`. Framework: Vitest v2 (jsdom) for lib tests; `@testing-library/svelte` for component tests. Global setup in `src/test-setup.ts`; jest-dom type augmentation in `src/vitest-matchers.d.ts`.
- jsdom has no `WebSocket`. Any test that renders `App.svelte` (or any component that calls `new WebSocket`) must stub it with `vi.stubGlobal('WebSocket', MockWebSocket)` in `beforeAll` and restore with `vi.unstubAllGlobals()` in `afterAll`. See `src/App.test.ts` for the reference implementation.
- jsdom has no `SharedWorker`. Tests for `Bot.svelte` use `vi.mock('./lib/bot-client', ...)` so `getBotClient()` / `createBotClient()` return a controllable mock instead of trying to construct a real worker. Tests for `bot-client.ts` itself use `vi.stubGlobal('SharedWorker', class { port = mockPort; })`. Do NOT try to intercept `new SharedWorker(new URL(...))` directly from a `.ts` file — Vite transforms this pattern specially and `vi.stubGlobal` will not intercept it. See `src/Bot.test.ts` and `src/lib/bot-client.test.ts` for the reference implementations.
- Tab-side mirror stores (alerts, enabledAssets) post messages to the worker rather than owning state. For component tests that assert on those stores after calling `addAlert` / `removeAlert` / `toggleAsset`, use the manual mock at `src/lib/__mocks__/bot-client.ts` via `vi.mock('../lib/bot-client')`. The mock echoes post()s back as worker broadcasts so mirror stores update synchronously. Reset mock state between tests with `_resetMockBotClient()`. See `src/components/AlertList.test.ts`, `src/components/AlertForm.test.ts`, `src/components/CoinSelector.test.ts`, and `src/App.test.ts` for reference implementations.
- `vi.mock()` factories are hoisted before class declarations in the test file body. Any variable referenced inside a `vi.mock` factory must be created with `vi.hoisted()` or inlined inside the factory.
- Vite `define` globals (`__APP_VERSION__`, `__APP_BUILD__`, `__APP_CDN__`) are declared in `vite.config.ts` and typed in `src/vite-env.d.ts`. Vitest does **not** inherit `vite.config.ts` — the same globals must also be declared in the `define` block of `vitest.config.ts` (use neutral test values: version/build `'test'`, CDN `'/'`). Whenever a new `define` entry is added to `vite.config.ts`, add a matching entry to `vitest.config.ts` or tests that render any component using that global will throw `ReferenceError` at runtime.
- Persisted state in `localStorage` must be versioned (see `STORAGE_KEYS` in `config.ts`) — bump the version key rather than mutating an existing schema

---

## Commands

- `npm run dev` — Vite dev server (HMR). Service worker is NOT registered in dev.
- `npm run check` — `svelte-check` over `.ts` and `.svelte` files; must pass with 0 errors.
- `npm run build` — runs `svelte-check` then `vite build` → `dist/`.
- `npm run preview` — serve `dist/` locally to test the production bundle + service worker.
- `npm test` — run the Vitest unit test suite once (CI mode, no watch).
- `npm run test:watch` — run Vitest in watch mode during development.
- `make check` — shell/python lint of repo-level scripts (shellcheck on `docker/*.sh`, `py_compile` on `upgrade.py`).
- `make ci-check` — what CI runs: `make check` + `npm ci` + `npm run check` + `npm run test` + `npm run build`. Run this locally before opening a PR if you want to mirror CI exactly.

## CI / Release

Two workflows live in `.github/workflows/`:

- **`check.yml`** — runs `make ci-check` on every push to `main` and on every PR targeting `main`. This is the gate for merges.
- **`deploy.yml`** — builds and deploys to GitHub Pages. Triggers ONLY on pushes of a tag matching `release/<version>`, where `<version>` is `x.y`, `x.y.z`, or `x.y.z-n` (e.g. `release/0.1`, `release/1.2.3`, `release/1.2.3-4`). A non-matching tag/ref fails in the `validate` job before any build work. `workflow_dispatch` is retained as a manual escape hatch but also runs through `validate`.

Releasing:

```sh
git tag release/0.1.0
git push origin release/0.1.0
```

The repo's Pages source must be set to **Source: GitHub Actions** for the deploy to succeed. Do NOT add a `release/*` branch trigger — releases are tag-driven; branches named `release/*` are not special.

**CDN split:** The `Make Dist` step passes `TAYRAX_CDN` (read from a GitHub Actions repository variable of the same name) to `vite build` as the `base` URL. When set, all built asset URLs (`<script>`, `<link>`, images) become absolute to that CDN origin while the HTML page files are uploaded to GitHub Pages at their normal paths. If `TAYRAX_CDN` is unset the build falls back to `/` (current behaviour). In dev mode the default is `http://localhost:5173/`. To activate, add a repository variable `TAYRAX_CDN` under **Settings → Secrets and variables → Actions → Variables**.

---

## Maintaining CLAUDE.md

Keep this file up to date. Whenever you make a change that affects project structure, tooling, conventions, or environment setup, update the relevant section. If no section fits, add one.

---

## User-facing documentation

Any behavior that affects how the user perceives the app — update frequency, warm-up periods, limitations, badge meanings — must be documented in two places:

1. **`README.md`** — the `## Notes` section, one sub-heading per topic.
2. **Help page** — the `<dl>` inside `src/Help.svelte` (served at `/help/`).

Both must stay in sync. When you add, change, or remove a documented behavior, update both. Never write to one without checking the other.

---

## Multi-page app

The build has two entry points defined in `vite.config.ts` via `rollupOptions.input`:

| Entry | URL | Purpose |
|---|---|---|
| `index.html` | `/` | Main trading dashboard (PWA) |
| `system/index.html` | `/system/` | Diagnostic page: browser capabilities + live WebSocket tests |
| `logs/index.html` | `/logs/` | Action-log viewer: reverse-chrono list of bot actions |
| `help/index.html` | `/help/` | Help page: how it works, warm-up periods, badge meanings |
| `bot/index.html` | `/bot/` | Bot console: feed statuses, errors, reconnect controls |

All pages share `src/app.css`. The system and logs pages are self-contained (`src/System.svelte` + `src/system.ts`, `src/Logs.svelte` + `src/logs.ts`). The logs page reads the `logs` store from `src/lib/logs.ts`, which is the same store the main app writes to via `logAction` — cross-tab sync is handled by a `storage` event listener in `logs.ts`. Pages are navigable via the nav menu (NavMenu.svelte). When adding a new page, create its HTML file at `<name>/index.html` (project root level), register it in `vite.config.ts` under `rollupOptions.input`, and add its entry to the nav items in `NavMenu.svelte`. Page HTML files use absolute `/src/…` script paths so they resolve correctly from any subdirectory in both dev and build.

---

## Action Logging

Any action the app or bot takes that is meaningful to the user must be recorded via `logAction` in `src/lib/logs.ts`. Current logged action: alert dispatched. Future actions to log as they are implemented include (but are not limited to): trade proposed, trade confirmed, trade executed, trade cancelled, order placed, order filled, signal triggered.

Rules:
- Call `logAction` at the point where the action is taken, not after the fact.
- Every new action kind requires a new entry in the `LogKind` union in `src/lib/logs.ts`. The TypeScript compiler will then flag every render site that is missing a case (e.g. `KIND_LABEL` in `Logs.svelte`) — fix all flagged sites before committing.
- Do not log routine data updates (price ticks, candle closes) — only log discrete decisions or outputs the user would care to audit.
- Trade proposals (`tradeProposed`) are generated in `src/lib/proposals.ts` and logged via `logAction`. They are driven by indicator signals (RSI, MACD, BB) evaluated across all `CANDLE_INTERVALS`, and subject to `PROPOSAL_COOLDOWN_MS` per asset+interval+signal to avoid flooding the log. The `interval` is included in the log entry's `data` field and displayed as a badge in `Logs.svelte`.

---

## Known Behaviors

- **Volume-spike alerts** require ≥10 closed 1m candles (~10 minutes of uptime) before they can fire. Only 1m candles are routed to the volume store — `applyCandle` in `App.svelte` is guarded by `candle.interval === '1m'`. Baseline is the median of prior closed-candle base volumes from the Binance kline stream. Don't "fix" the warm-up by lowering the sample threshold — it exists to avoid false positives from a cold history.
- **CoinCap tick throttle** — `applyTick` in `prices.ts` silently drops ticks that arrive within `PRICE_TICK_MIN_INTERVAL_MS` (default 5s) of the last accepted tick for the same asset. The first tick for a new asset always passes. Tune the constant in `config.ts`; don't lower it below 1s without a clear reason.
- **WebSocket reconnect backoff** — `reconnectAttempts` is only reset when a connection has been open for ≥10 s (`STABLE_CONNECTION_MS` in `websocket.ts`, `binance-price.ts`, and `binance.ts`). This prevents the backoff from being nullified when a server accepts the handshake but then immediately closes the connection (e.g. Origin rejection from a new deploy domain).
- **Action log ring buffer** — `logAction` in `src/lib/logs.ts` caps the stored entry list at `LOG_MAX_ENTRIES` (500, in `config.ts`). New entries are prepended so the store is always reverse-chronological. Persisted under `STORAGE_KEYS.logs` (`tayrax.logs.v1`); open tabs stay in sync via a module-level `storage` event listener. When adding a new action type, extend the `LogKind` union in `logs.ts` — the compiler will then flag every render site that hasn't been updated (e.g. `KIND_LABEL` in `Logs.svelte`).
- **Multi-interval candle stores** — `candleStores` in `src/lib/candles.ts` is a `Record<CandleInterval, Readable<CandleMap>>` with one independent Svelte store per interval (`1m`, `15m`, `1h`, `4h`, `1d`). Each store has its own `localStorage` key (see `CANDLE_STORAGE_KEYS` in `config.ts`). `applyClosedCandle(interval, candle)`, `prependCandles(interval, asset, historical)`, and `pruneCandles(toRemove)` (which prunes all intervals) are the public API. Alerts use the candle store for their own `interval` field. Proposals are evaluated across all intervals (`CANDLE_INTERVALS` loop in `App.svelte`). The chart has a per-component interval selector.
- **Candle history backfill** — On startup `backfillAll` in `src/lib/backfill.ts` fetches up to `CANDLE_HISTORY_MAX` (200) candles per asset per interval from the Binance REST API, iterating intervals sequentially with a 300 ms gap between each to avoid rate-limit issues. Failures are swallowed. Live candles (from `BinanceKlineFeed`) always win over historical candles when the same `openTime` exists.
- **Indicator warm-up** — Indicators are null until their minimum candle counts are met: SMA(n) / BB(n) need n candles; RSI(14) needs 15; MACD(12,26,9) needs 34 (26 + 9 − 1). With a successful backfill these are met immediately at load time. Indicator-based alert rules return null (skip) when the required data isn't available yet — they do not fire false positives on insufficient history.
- **Candle deduplication** — `applyClosedCandle` deduplicates by `openTime` (new candle wins). `prependCandles` also deduplicates, with existing (live) candles winning over historical ones. Both trim the result to `CANDLE_HISTORY_MAX` entries, keeping the most recent.
- **Disabled-asset grace period** — When a coin is toggled off (via a `toggleAsset` message to the worker), `BotEngine` writes its `disabledAt` timestamp to `STORAGE_KEYS.disabledAt`. Persisted price/candle data is kept for `DISABLED_ASSET_PRUNE_AFTER_MS` (3 days). When the worker boots (first tab opens after shutdown), it computes expired entries via `computeExpiredDisabledAssets` in `enabled-assets-core.ts`, clears the map, and hands off a one-time `pruneAssets` message to the first tab that connects (via `takePendingPrune()`). Tabs run `pruneAssets` / `pruneCandles` / `pruneVolumes` to drop their tab-side store data. Re-enabling within 3 days recovers all history instantly without a new backfill.
- **SharedWorker bot (core runtime)** — `src/lib/bot.worker.ts` is a thin SharedWorker shell that owns port management and routes messages to a single `BotEngine` instance (`src/lib/bot-engine.ts`). `BotEngine` is the authoritative owner of: WebSocket feed instances (`BinancePriceFeed`/`BinanceKlineFeed`), the alerts list, the enabled-assets list, the `disabledAt` map, alert evaluation, proposal evaluation, backfill, and `logAction` calls. All persistence to `localStorage` happens inside the worker; tab-side stores (`alerts`, `enabledAssets`) are **mirrors** that hydrate from localStorage at load (for instant first render) and are then overwritten by `alertList` / `enabledAssetsList` broadcasts.
  - Tab → worker messages: `addAlert`, `removeAlert`, `toggleAsset`, `reconnect`, `subscribeBotState`.
  - Worker → tab broadcasts: `priceTick`, `closedCandle`, `priceStatus`, `klineStatus`, `notify`, `botState`, `alertList`, `enabledAssetsList`, `pruneAssets`.
  - `bot-client.ts` exports `createBotClient()` plus a `getBotClient()` singleton accessor. Tab-side modules (`alerts.ts`, `enabled-assets.ts`) use the singleton so they share one SharedWorker connection. `App.svelte` and `Bot.svelte` also use the singleton.
  - The worker stays alive as long as any tab from the origin is open, so feeds run across page navigation. It boots by reading `enabledAssets` and `alerts` from localStorage via helpers in `alert-core.ts` and `enabled-assets-core.ts` (those `-core` modules are worker-safe — they do not import `bot-client.ts`, which would pull in browser-only APIs).
  - The `/bot/` page calls `getBotClient()` synchronously in the `<script>` block (not in `onMount`) so it is immediately available on first render and testable without microtask flushing; it sends `subscribeBotState` to receive `botState` broadcasts.
  - **Dev note:** SharedWorker HMR does not work — after changing `bot.worker.ts` or `bot-engine.ts`, terminate the worker via Chrome DevTools → Application → Shared workers, then reload.

---

## What to Avoid

- Do not add a backend or server — this is a pure client-side app
- Do not introduce a CSS framework (Tailwind, Bootstrap, etc.) — plain CSS only
- Do not use `any` in TypeScript
- Do not store sensitive data (API keys, secrets) in localStorage without encryption — flag it and ask
- Do not jump ahead to a later phase feature without finishing the current phase
- Do not add dependencies without a clear reason — keep the bundle lean
- Do not upgrade Vitest beyond v2.x — Vitest v3+ bundles its own Vite 6+, which conflicts with `@sveltejs/vite-plugin-svelte@3` (Svelte 4 / Vite 5) and produces deprecation warnings. Upgrade Vitest only when Svelte and Vite are also being upgraded.
- Do not instantiate `BinancePriceFeed`, `BinanceKlineFeed`, or `PriceFeed` directly in `App.svelte` or `Bot.svelte` — feed lifecycle is owned by the SharedWorker (`BotEngine`). To update the active asset set, post `{ type: 'toggleAsset', asset }` to the worker via the bot client.
- Do not write to `alerts` or `enabledAssets` stores from tab code. Those stores are mirrors — post `addAlert` / `removeAlert` / `toggleAsset` messages to the worker instead. Direct writes will be clobbered by the next worker broadcast.
- Do not import `bot-client.ts` from `bot-engine.ts`, `bot.worker.ts`, or `*-core.ts` modules. `bot-client` instantiates a `SharedWorker`, which would recurse in a worker context. Keep worker-imported helpers in `alert-core.ts` / `enabled-assets-core.ts`.
- Do not add fallbacks, polyfills, or graceful-degradation paths for old browsers (Safari < 16.4, stale Chrome/Firefox, IE, etc.). Target modern evergreen browsers only. If a feature is needed (SharedWorker, Web Notifications, etc.), use it directly and let unsupported browsers fail loudly. Only add compatibility code when the user explicitly asks for it.
