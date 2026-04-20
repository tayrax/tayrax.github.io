# tayrax

A personalized crypto trading bot and monitoring dashboard, built as a PWA using TypeScript.
Hosted at [tayrax.github.io](https://tayrax.github.io).

> Named after the tayra — a fast and precise wild predator native to South America. Short, unique, and the GitHub organization was available.

---

## Goal

Build a web-based crypto monitoring and trading assistant that:
- Displays real-time price data for selected cryptocurrencies
- Runs entirely in the browser (PWA)
- Uses free public APIs — no paid subscriptions
- Starts simple (alerts) and evolves toward automated trading strategies

---

## Tech Stack

- **Language:** TypeScript
- **App type:** PWA (Progressive Web App)
- **Framework:** Svelte + Vite (see rationale below)
- **Hosting:** GitHub Pages (`tayrax.github.io`)

### Framework Rationale

The goal is a functional, useful UI without unnecessary complexity. Options considered:

| Option | Verdict |
|---|---|
| **Vanilla TypeScript** | Viable, but managing real-time DOM updates manually gets verbose quickly |
| **htmx** | Not suitable — designed for server-driven HTML, not client-side WebSocket apps |
| **Alpine.js** | Too limited for a reactive trading dashboard with complex state |
| **Preact** | No meaningful advantage over Svelte for this use case |
| **Svelte + Vite** | ✅ Chosen — compiles to plain JS (no framework at runtime), minimal bundle, clean reactive syntax |

**Why Svelte:**
- Reactivity is built into the language — no `useState`, no `useEffect`, no boilerplate
- The compiler produces plain JavaScript; there is no framework overhead at runtime
- Ideal for real-time dashboards where data changes frequently
- Gentle learning curve — the syntax is close to plain HTML + TypeScript

### Project Structure

```
tayrax/
├── src/
│   ├── lib/
│   │   ├── websocket.ts     # WebSocket connection (CoinCap / Binance)
│   │   ├── alerts.ts        # Alert rule logic
│   │   └── indicators.ts    # RSI, SMA, etc. (Phase 2)
│   ├── components/
│   │   ├── PriceCard.svelte
│   │   ├── AlertForm.svelte
│   │   └── Chart.svelte
│   └── App.svelte
├── vite.config.ts
└── manifest.json            # PWA manifest
```

---

## Data Sources (Free APIs)

| API | Use case | Protocol |
|---|---|---|
| [CoinCap](https://docs.coincap.io/) | Real-time prices for most assets | WebSocket + REST |
| [Binance](https://binance-docs.github.io/apidocs/spot/en/) | Real-time tickers, order book, candlesticks | WebSocket + REST |
| [CoinGecko](https://www.coingecko.com/api/documentation) | Market data, rankings, asset list | REST only |
| [Kraken](https://docs.kraken.com/api/) | Alternative exchange data | WebSocket + REST |

### Recommended combination
- **CoinCap WebSocket** → real-time prices (simple, low overhead)
- **Binance WebSocket** → when order book or candlestick (OHLCV) data is needed
- **CoinGecko REST** → background data (market cap, full asset list, historical)

### Asset coverage
- CoinGecko: 15,000+ coins (most complete)
- CoinCap: ~3,000 coins (good altcoin coverage)
- Binance: ~400 pairs (top coins only, most liquid)

---

## Asset Configuration

Assets to monitor are defined as a simple configurable list — no separate implementation needed per coin:

```typescript
const MONITORED_ASSETS = ['bitcoin', 'ethereum', 'solana', 'cardano'];
```

Adding a new coin = adding one string to the list.

---

## Development Phases

### Phase 1 — Simple Alerts ✅ Completed (2026-04-14)
> The bot monitors prices and notifies the user. No trades are executed.

**Features (all implemented):**
- ✅ Connect to real-time WebSocket feed — CoinCap for prices, Binance for 1m klines (`src/lib/websocket.ts`, `src/lib/binance.ts`), with exponential-backoff reconnection
- ✅ Display live prices for a configurable list of assets (`MONITORED_ASSETS` in `src/lib/config.ts`)
- ✅ Alert rules (`src/lib/alerts.ts`, `evaluate()` + `EvalContext`):
  - ✅ Price threshold (`above`)
  - ✅ Price floor (`below`)
  - ✅ Price range (`range`)
  - ✅ % change /1h (`pctChange`) — backed by a 1h rolling history ring buffer in `src/lib/prices.ts`
  - ✅ Volume spike /1m (`volumeSpike`) — latest base volume ÷ median of previous ≥ multiplier (see `src/lib/volumes.ts`; requires ≥10 closed candles of warm-up)
- ✅ Browser push notifications via Web Notifications API (`src/lib/notifications.ts`)
- ✅ PWA: `static/manifest.json` + `static/sw.js` (stale-while-revalidate shell cache, last price snapshot persisted to `localStorage`, "cached" badge on stale cards)
- ✅ GitHub Pages auto-deploy from `main` (`.github/workflows/deploy.yml`)

**Why start here:**
- No exchange account needed
- Zero financial risk from bugs
- Validates the data pipeline before adding logic
- Already useful as a standalone tool

---

### Phase 2 — Technical Indicators ✅ Completed (2026-04-15)
> The bot calculates indicators from price data and generates trading signals.

**Implemented:**
- **SMA(20), SMA(50), EMA(12), EMA(26)** — `src/lib/indicators.ts`
- **RSI(14)** — Wilder smoothed averages
- **MACD(12,26,9)** — line, signal, histogram
- **Bollinger Bands(20)** — upper/middle/lower bands
- **Candlestick chart** — SVG-based, displays last 60 1m candles with SMA/BB overlays and RSI/MACD sub-pane (`src/components/Chart.svelte`)
- **Indicator-based alerts** — `rsiBelow`, `rsiAbove`, `macdCross`, `bbBreakout` added to `alerts.ts`; `AlertForm.svelte` updated with grouped options
- **OHLCV candle store** — `src/lib/candles.ts`: ring buffer of up to 200 candles per asset, persisted to `localStorage`
- **Historical backfill** — `src/lib/backfill.ts`: fetches 200 1m candles from Binance REST on startup to seed indicators immediately

---

### Phase 3 — Semi-Automatic Trading
> The bot suggests actions based on indicator signals. Exchange integration and order execution are deferred to Phase 3b; this phase focuses on proposal logic and auditability.

**Phase 3a — Trade Proposals ✅ Completed (2026-04-20) (no exchange account required):**
- `src/lib/proposals.ts` evaluates indicator state per asset each candle close and emits `TradeProposal` objects when signal conditions are met
- Signal triggers: RSI oversold/overbought, MACD bullish/bearish crossover, Bollinger Band breakout
- Each proposal is logged via `logAction('tradeProposed', ...)` and appears on the Logs page
- Per-asset-per-signal cooldown (`PROPOSAL_COOLDOWN_MS`) prevents flooding the log
- No exchange account or API key needed

**Phase 3b — Order execution (future, requires exchange API key):**
- Connect to exchange account via API key (Binance, Kraken, or Coinbase)
- Replace `logAction` call in proposal evaluation with an actual order submission
- User reviews open proposals and confirms/dismisses before orders execute
- Order history and basic P&L tracking

---

### Phase 4 — Fully Automatic Trading
> The bot executes trades autonomously based on configured strategies.

**Features:**
- Define strategy rules (entry/exit conditions)
- Risk management: stop-loss, take-profit, max position size
- Paper trading mode (simulated, no real money) for strategy validation
- Live trading mode with real exchange orders
- Audit log of all automated decisions

---

## Testing Strategy

### Unit tests (current)
Pure functions and Svelte store integration tests live alongside source files as `*.test.ts`. Framework: Vitest + jsdom. Run with `npm test`.

### Component tests (planned — Phase 1 follow-up)
`@testing-library/svelte` tests for `PriceCard`, `AlertForm`, and `AlertList`. Tests rendering, user interactions, and store-driven updates without mounting the full app.

### E2E tests (future — after Phase 2)
Full browser automation with [Playwright](https://playwright.dev). When to add: once Phase 2 (charts + indicators) is stable and the feature surface is large enough to justify maintaining a browser test suite. Target scenarios: WebSocket feed connects and prices update, alert fires and notification is shown, PWA installs and works offline. Defer until then — the unit + component layers are sufficient for Phase 1 coverage.

---

## Notes

- CORS: Binance and CoinCap allow direct browser requests — no proxy needed for public data
- WebSocket reconnection logic is required (auto-reconnect on disconnect)
- CoinGecko free tier: 30 req/min without key, 50 req/min with free API key
- For Phase 3+: exchange API keys must be stored securely (never committed to git)
- Altcoins = all cryptocurrencies that are not Bitcoin (Ethereum, Solana, Cardano, XRP, DOGE, etc.)

---

## Deferred Ideas

Ideas that came up during development and are worth revisiting, but not prioritized yet.

### Stablecoin de-peg monitoring

Stablecoins (USDT, USDC, DAI) are excluded from `SUPPORTED_ASSETS` because their price is pegged to $1.00, making price cards, candlestick charts, and technical indicators useless for normal operation. However, de-peg events are a real risk signal — USDC briefly dropped to ~$0.87 during the SVB bank collapse in March 2023.

If implemented:
- Add `usd-coin` (`USDCUSDT`) and `dai` (`DAIUSDT`) to `SUPPORTED_ASSETS` and `BINANCE_SYMBOL`. These are the ones with valid Binance pairs.
- USDT itself cannot be added: it is the Binance quote currency — no `USDTUSDT` pair exists.
- The primary alert use case is a simple `below` threshold (e.g. "notify me if USDC drops below $0.98").
- Charts and indicators on a flat series are not useful; consider suppressing or marking them differently in the UI.

### SUPPORTED_ASSETS maintenance: Binance symbol drift

The `BINANCE_SYMBOL` map in `src/lib/symbols.ts` is a static snapshot. Exchange listings change over time — pairs get delisted, renamed, or added. Current known cases:
- **XMR** — delisted from Binance in 2024; `XMRUSDT` no longer streams data.
- **BSV** — delisted from Binance in 2019; would silently produce no data if added.
- **MATIC → POL** — Polygon rebranded to POL in late 2024. Binance listed `POLUSDT` but `MATICUSDT` remains active. If the old pair is eventually retired, update the symbol (and optionally the CoinCap ID from `polygon` to `pol-ecosystem`).

The app handles stale/missing symbols gracefully: `toBinanceSymbol` returns `null`, the stream filter drops it silently, and the price card shows "waiting for data" indefinitely. No crash, but also no alert that something is wrong. A future improvement would be a diagnostic check in the System page (`/system/`) that flags any `SUPPORTED_ASSETS` entry with no Binance data after a timeout.

### CoinCap ID verification

The CoinCap IDs used as internal asset identifiers (e.g. `toncoin`, `sei-network`, `immutable-x`) were chosen to match CoinCap's slug convention. They are only relevant if `PRICE_PROVIDER` is switched back to `'coincap'` — with Binance the IDs are opaque internal keys and only the `BINANCE_SYMBOL` mapping matters. If CoinCap is re-enabled, each ID should be verified against `https://api.coincap.io/v2/assets/<id>` before use.

### CoinSelector UX at scale

The current `CoinSelector` renders all `SUPPORTED_ASSETS` as a flat flex-wrap checkbox list. At 50 coins this is manageable, but at ~100+ coins a grouped layout (by category: L1, L2, DeFi, etc.) or a searchable/filterable input would significantly improve usability.
