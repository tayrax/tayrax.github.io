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

### Phase 1 — Simple Alerts
> The bot monitors prices and notifies the user. No trades are executed.

**Features:**
- Connect to real-time WebSocket feed (CoinCap or Binance)
- Display live prices for a configurable list of assets
- Define alert rules:
  - Price threshold: "notify when BTC > $100,000"
  - Price floor: "notify when SOL < $130"
  - Price range: "notify when ETH is between $3,000 and $3,200"
  - % change: "notify if any asset moves more than 5% in the last hour"
  - Volume spike: "notify if SOL volume is unusually high"
- Browser push notifications (Web Notifications API)
- PWA support: installable, works offline with last known prices cached via Service Worker

**Why start here:**
- No exchange account needed
- Zero financial risk from bugs
- Validates the data pipeline before adding logic
- Already useful as a standalone tool

---

### Phase 2 — Technical Indicators
> The bot calculates indicators from price data and generates trading signals.

**Planned indicators:**
- **SMA / EMA** — Simple and Exponential Moving Averages
- **RSI** — Relative Strength Index (overbought/oversold)
- **MACD** — Moving Average Convergence Divergence
- **Bollinger Bands**

**Features:**
- Candlestick chart visualization (OHLCV data)
- Signal overlays on charts
- Alerts based on indicator conditions (e.g., "notify when RSI < 30 on BTC")

---

### Phase 3 — Semi-Automatic Trading
> The bot suggests actions and asks for user confirmation before executing.

**Features:**
- Connect to exchange account via API key (Binance, Kraken, or Coinbase)
- Bot proposes: "RSI is 28 on SOL — buy $50 worth?"
- User approves or dismisses via UI
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

## Notes

- CORS: Binance and CoinCap allow direct browser requests — no proxy needed for public data
- WebSocket reconnection logic is required (auto-reconnect on disconnect)
- CoinGecko free tier: 30 req/min without key, 50 req/min with free API key
- For Phase 3+: exchange API keys must be stored securely (never committed to git)
- Altcoins = all cryptocurrencies that are not Bitcoin (Ethereum, Solana, Cardano, XRP, DOGE, etc.)
