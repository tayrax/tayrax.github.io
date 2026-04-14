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
trex/
├── src/
│   ├── lib/
│   │   ├── websocket.ts     # WebSocket connection management
│   │   ├── alerts.ts        # Alert rule definitions and evaluation
│   │   └── indicators.ts    # Technical indicators (RSI, SMA, etc.)
│   ├── components/
│   │   ├── PriceCard.svelte
│   │   ├── AlertForm.svelte
│   │   └── Chart.svelte
│   └── App.svelte
├── public/
│   └── manifest.json        # PWA manifest
├── vite.config.ts
├── trex.md                  # Product plan and roadmap
└── CLAUDE.md                # This file
```

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
- WebSocket connections must handle reconnection automatically
- Keep business logic (alerts, indicators, WebSocket) in `src/lib/`, not inside components
- One responsibility per file — don't mix WebSocket logic with indicator math

---

## What to Avoid

- Do not add a backend or server — this is a pure client-side app
- Do not introduce a CSS framework (Tailwind, Bootstrap, etc.) — plain CSS only
- Do not use `any` in TypeScript
- Do not store sensitive data (API keys, secrets) in localStorage without encryption — flag it and ask
- Do not jump ahead to a later phase feature without finishing the current phase
- Do not add dependencies without a clear reason — keep the bundle lean
