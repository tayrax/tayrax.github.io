# tayrax

A personalized crypto trading bot and monitoring dashboard.
Hosted at [tayrax.github.io](https://tayrax.github.io).

> Named after the tayra — a fast and precise wild predator native to South America.

## Notes

### Data freshness

Prices are streamed in real time from the CoinCap WebSocket feed. To avoid
flooding the store, a tick is processed at most once every **5 seconds per
asset** — so the displayed price can lag up to 5 seconds behind the live market.
This interval is tunable via `PRICE_TICK_MIN_INTERVAL_MS` in `src/lib/config.ts`.

Volume data comes from the Binance 1-minute kline stream and updates once per
minute per asset, on closed-candle events.

A **cached** badge appears on a price card when no tick has been received for
more than 30 seconds, indicating a stale or disconnected feed.

### Volume-spike alerts

Volume-spike detection requires ≥10 closed 1-minute candles (≈10 minutes of
runtime) before a rule can fire. The baseline is the median of the previous
closed candles; firing earlier would produce false positives from a cold
history. If you just reloaded the app, expect a warm-up period before these
alerts become active.

### Charts and technical indicators

On startup, up to 200 recent 1-minute candles are fetched from the Binance
REST API (`/api/v3/klines`) for each monitored asset. This seeds the chart
and technical indicators (SMA20, SMA50, Bollinger Bands, RSI(14),
MACD(12,26,9)) immediately. If the backfill fetch fails (network error, rate
limit), these indicators become available as live candles arrive via the
WebSocket stream instead.

Indicator-based alert rules (RSI, MACD crossover, Bollinger Band breakout)
require a minimum candle history to compute:

- **RSI(14)**: needs 15+ candles
- **MACD(12,26,9)**: needs 34+ candles (26 + 9 signal periods − 1)
- **Bollinger Bands(20)**: needs 20+ candles

With a successful backfill these thresholds are met at load time. Without
backfill, expect a warm-up period before indicator alerts can fire.
