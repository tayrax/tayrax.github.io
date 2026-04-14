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
│   │   ├── config.ts         # MONITORED_ASSETS, windows, storage keys
│   │   ├── websocket.ts      # CoinCap price WebSocket (PriceFeed)
│   │   ├── binance.ts        # Binance 1m kline WebSocket (BinanceKlineFeed)
│   │   ├── symbols.ts        # CoinCap id ↔ Binance symbol mapping
│   │   ├── prices.ts         # Price store + 1h rolling history + snapshot cache
│   │   ├── volumes.ts        # Volume store + volumeSpikeRatio
│   │   ├── alerts.ts         # Alert rule types, store, evaluate()
│   │   ├── notifications.ts  # Web Notifications API wrapper
│   │   └── indicators.ts     # Technical indicators (Phase 2)
│   ├── components/
│   │   ├── PriceCard.svelte
│   │   ├── AlertForm.svelte
│   │   ├── AlertList.svelte
│   │   └── Chart.svelte      # Phase 2
│   ├── App.svelte
│   ├── app.css
│   └── main.ts
├── static/                   # Vite publicDir — copied to site root at build
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker (stale-while-revalidate shell)
│   ├── tayrax-logo.svg
│   └── tayrax-logo.png
├── .github/workflows/deploy.yml  # GitHub Pages deploy (main → Pages)
├── index.html
├── vite.config.ts            # publicDir: 'static', base: '/'
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

1. **Phase 1 — Simple Alerts:** live prices + user-defined alert rules + browser notifications
2. **Phase 2 — Technical Indicators:** OHLCV charts, RSI/SMA/MACD/Bollinger Bands, signal alerts
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

## Coding Conventions

- TypeScript strict mode — no `any`, no implicit types
- Prefer named exports over default exports in `.ts` files
- Svelte components use `<script lang="ts">`
- WebSocket connections must handle reconnection automatically (exponential backoff, capped at 30s)
- Keep business logic (alerts, indicators, WebSocket) in `src/lib/`, not inside components
- One responsibility per file — don't mix WebSocket logic with indicator math
- Persisted state in `localStorage` must be versioned (see `STORAGE_KEYS` in `config.ts`) — bump the version key rather than mutating an existing schema

---

## Commands

- `npm run dev` — Vite dev server (HMR). Service worker is NOT registered in dev.
- `npm run check` — `svelte-check` over `.ts` and `.svelte` files; must pass with 0 errors.
- `npm run build` — runs `svelte-check` then `vite build` → `dist/`.
- `npm run preview` — serve `dist/` locally to test the production bundle + service worker.

Deploy is automated via `.github/workflows/deploy.yml` on push to `main`; the repo's Pages source must be set to "GitHub Actions".

---

## Maintaining CLAUDE.md

Keep this file up to date. Whenever you make a change that affects project structure, tooling, conventions, or environment setup, update the relevant section. If no section fits, add one.

---

## Known Behaviors

- **Volume-spike alerts** require ≥10 closed 1m candles (~10 minutes of uptime) before they can fire. Baseline is the median of prior closed-candle base volumes from the Binance kline stream. Don't "fix" the warm-up by lowering the sample threshold — it exists to avoid false positives from a cold history.

---

## What to Avoid

- Do not add a backend or server — this is a pure client-side app
- Do not introduce a CSS framework (Tailwind, Bootstrap, etc.) — plain CSS only
- Do not use `any` in TypeScript
- Do not store sensitive data (API keys, secrets) in localStorage without encryption — flag it and ask
- Do not jump ahead to a later phase feature without finishing the current phase
- Do not add dependencies without a clear reason — keep the bundle lean
