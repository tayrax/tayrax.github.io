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
│   │   ├── config.ts         # MONITORED_ASSETS, PRICE_PROVIDER, windows, storage keys
│   │   ├── provider.ts       # PriceProvider interface + shared types (PriceTick, etc.)
│   │   ├── websocket.ts      # CoinCap price WebSocket (PriceFeed implements PriceProvider)
│   │   ├── binance-price.ts  # Binance miniTicker price WebSocket (BinancePriceFeed)
│   │   ├── binance.ts        # Binance 1m kline WebSocket (BinanceKlineFeed)
│   │   ├── symbols.ts        # CoinCap id ↔ Binance symbol mapping
│   │   ├── prices.ts         # Price store + 1h rolling history + snapshot cache
│   │   ├── volumes.ts        # Volume store + volumeSpikeRatio
│   │   ├── alerts.ts         # Alert rule types, store, evaluate() — Phase 1 + indicator rules (Phase 2)
│   │   ├── notifications.ts  # Web Notifications API wrapper
│   │   ├── logs.ts           # Action log store (ring buffer, cross-tab synced)
│   │   ├── candles.ts        # OHLCV candle store (ring buffer, CANDLE_HISTORY_MAX, persistence)
│   │   ├── backfill.ts       # Binance REST /api/v3/klines historical seed on startup
│   │   └── indicators.ts     # SMA, EMA, RSI, MACD, Bollinger Bands (Phase 2)
│   ├── components/
│   │   ├── PriceCard.svelte
│   │   ├── AlertForm.svelte
│   │   ├── AlertList.svelte
│   │   ├── NavMenu.svelte    # Clickable logo → dropdown nav (Dashboard / System / Logs)
│   │   └── Chart.svelte      # SVG candlestick chart with SMA/BB overlays + RSI/MACD sub-pane
│   ├── App.test.ts           # Root app smoke tests (mounts, layout, WebSocket stubbed)
│   ├── test-setup.ts         # Vitest global setup: jest-dom matchers + afterEach cleanup
│   ├── vitest-matchers.d.ts  # TypeScript augmentation for jest-dom matchers on Vitest's Assertion
│   ├── App.svelte
│   ├── System.svelte         # /system/ diagnostic page (browser caps + WS tests)
│   ├── Logs.svelte           # /logs/ action-log viewer (reverse-chrono, filter, clear)
│   ├── app.css
│   ├── main.ts
│   ├── system.ts             # Entry point for system/index.html
│   └── logs.ts               # Entry point for logs/index.html
├── static/                   # Vite publicDir — copied to site root at build
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker (stale-while-revalidate shell)
│   ├── tayrax-logo.svg
│   └── tayrax-logo.png
├── .github/workflows/deploy.yml  # GitHub Pages deploy (main → Pages)
├── index.html                # Main app entry point
├── system/index.html         # Diagnostic page entry (multi-page Vite app) → /system/
├── logs/index.html           # Action-log page entry (multi-page Vite app) → /logs/
├── vite.config.ts            # publicDir: 'static', base: '/', rollupOptions.input for each page
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
3. **Phase 3 — Semi-Automatic Trading:** exchange API integration, bot proposes trades, user confirms
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

Monitored assets are defined as a single configurable list. No per-coin implementation is needed.

```typescript
const MONITORED_ASSETS = ['bitcoin', 'ethereum', 'solana', 'cardano'];
```

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

---

## Maintaining CLAUDE.md

Keep this file up to date. Whenever you make a change that affects project structure, tooling, conventions, or environment setup, update the relevant section. If no section fits, add one.

---

## User-facing documentation

Any behavior that affects how the user perceives the app — update frequency, warm-up periods, limitations, badge meanings — must be documented in two places:

1. **`README.md`** — the `## Notes` section, one sub-heading per topic.
2. **In-app help panel** — the `<dl>` inside the `{#if helpOpen}` block in `App.svelte`.

Both must stay in sync. When you add, change, or remove a documented behavior, update both. Never write to one without checking the other.

---

## Multi-page app

The build has two entry points defined in `vite.config.ts` via `rollupOptions.input`:

| Entry | URL | Purpose |
|---|---|---|
| `index.html` | `/` | Main trading dashboard (PWA) |
| `system/index.html` | `/system/` | Diagnostic page: browser capabilities + live WebSocket tests |
| `logs/index.html` | `/logs/` | Action-log viewer: reverse-chrono list of bot actions |

All pages share `src/app.css`. The system and logs pages are self-contained (`src/System.svelte` + `src/system.ts`, `src/Logs.svelte` + `src/logs.ts`). The logs page reads the `logs` store from `src/lib/logs.ts`, which is the same store the main app writes to via `logAction` — cross-tab sync is handled by a `storage` event listener in `logs.ts`. Pages are navigable via the nav menu (NavMenu.svelte). When adding a new page, create its HTML file at `<name>/index.html` (project root level), register it in `vite.config.ts` under `rollupOptions.input`, and add its entry to the nav items in `NavMenu.svelte`. Page HTML files use absolute `/src/…` script paths so they resolve correctly from any subdirectory in both dev and build.

---

## Action Logging

Any action the app or bot takes that is meaningful to the user must be recorded via `logAction` in `src/lib/logs.ts`. Current logged action: alert dispatched. Future actions to log as they are implemented include (but are not limited to): trade proposed, trade confirmed, trade executed, trade cancelled, order placed, order filled, signal triggered.

Rules:
- Call `logAction` at the point where the action is taken, not after the fact.
- Every new action kind requires a new entry in the `LogKind` union in `src/lib/logs.ts`. The TypeScript compiler will then flag every render site that is missing a case (e.g. `KIND_LABEL` in `Logs.svelte`) — fix all flagged sites before committing.
- Do not log routine data updates (price ticks, candle closes) — only log discrete decisions or outputs the user would care to audit.

---

## Known Behaviors

- **Volume-spike alerts** require ≥10 closed 1m candles (~10 minutes of uptime) before they can fire. Baseline is the median of prior closed-candle base volumes from the Binance kline stream. Don't "fix" the warm-up by lowering the sample threshold — it exists to avoid false positives from a cold history.
- **CoinCap tick throttle** — `applyTick` in `prices.ts` silently drops ticks that arrive within `PRICE_TICK_MIN_INTERVAL_MS` (default 5s) of the last accepted tick for the same asset. The first tick for a new asset always passes. Tune the constant in `config.ts`; don't lower it below 1s without a clear reason.
- **WebSocket reconnect backoff** — `reconnectAttempts` is only reset when a connection has been open for ≥10 s (`STABLE_CONNECTION_MS` in `websocket.ts`, `binance-price.ts`, and `binance.ts`). This prevents the backoff from being nullified when a server accepts the handshake but then immediately closes the connection (e.g. Origin rejection from a new deploy domain).
- **Action log ring buffer** — `logAction` in `src/lib/logs.ts` caps the stored entry list at `LOG_MAX_ENTRIES` (500, in `config.ts`). New entries are prepended so the store is always reverse-chronological. Persisted under `STORAGE_KEYS.logs` (`tayrax.logs.v1`); open tabs stay in sync via a module-level `storage` event listener. When adding a new action type, extend the `LogKind` union in `logs.ts` — the compiler will then flag every render site that hasn't been updated (e.g. `KIND_LABEL` in `Logs.svelte`).
- **Candle history backfill** — On startup `backfillAll` in `src/lib/backfill.ts` fetches up to `CANDLE_HISTORY_MAX` (200) recent 1m candles per asset from the Binance REST API and calls `prependCandles`. This is fire-and-forget: failures are swallowed so a network error or rate-limit doesn't block startup. The candle store is persisted under `STORAGE_KEYS.candles` (`tayrax.candles.v1`). Live candles (from `BinanceKlineFeed`) always win over historical candles when the same `openTime` exists.
- **Indicator warm-up** — Indicators are null until their minimum candle counts are met: SMA(n) / BB(n) need n candles; RSI(14) needs 15; MACD(12,26,9) needs 34 (26 + 9 − 1). With a successful backfill these are met immediately at load time. Indicator-based alert rules return null (skip) when the required data isn't available yet — they do not fire false positives on insufficient history.
- **Candle deduplication** — `applyClosedCandle` deduplicates by `openTime` (new candle wins). `prependCandles` also deduplicates, with existing (live) candles winning over historical ones. Both trim the result to `CANDLE_HISTORY_MAX` entries, keeping the most recent.

---

## What to Avoid

- Do not add a backend or server — this is a pure client-side app
- Do not introduce a CSS framework (Tailwind, Bootstrap, etc.) — plain CSS only
- Do not use `any` in TypeScript
- Do not store sensitive data (API keys, secrets) in localStorage without encryption — flag it and ask
- Do not jump ahead to a later phase feature without finishing the current phase
- Do not add dependencies without a clear reason — keep the bundle lean
- Do not upgrade Vitest beyond v2.x — Vitest v3+ bundles its own Vite 6+, which conflicts with `@sveltejs/vite-plugin-svelte@3` (Svelte 4 / Vite 5) and produces deprecation warnings. Upgrade Vitest only when Svelte and Vite are also being upgraded.
