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
