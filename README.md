# tayrax

A personalized crypto trading bot and monitoring dashboard.
Hosted at [tayrax.github.io](https://tayrax.github.io).

> Named after the tayra — a fast and precise wild predator native to South America.

## Notes

### Data freshness

Prices are streamed in real time from the Binance miniTicker WebSocket feed. To
avoid flooding the store, a tick is processed at most once every **5 seconds per
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

On startup, up to 200 recent candles per interval are fetched from the Binance
REST API (`/api/v3/klines`) for each monitored asset across all chart intervals
(`1m`, `15m`, `1h`, `4h`, `1d`). This seeds the chart and technical indicators
(SMA, EMA, Bollinger Bands, RSI, MACD — using their default periods) immediately.
If the backfill fetch fails (network error, rate limit), these indicators become
available as live candles arrive via the WebSocket stream instead.

Chart indicator periods are user-configurable per chart via the ⚙ button
(defaults: SMA 20/50, EMA 12/26, BB 20/2σ, RSI 14, MACD 12/26/9). These
settings are per-session and reset on page reload. Alert and proposal logic
always uses the fixed canonical defaults regardless of chart settings.

Indicator-based alert rules (RSI, MACD crossover, Bollinger Band breakout)
require a minimum candle history to compute:

- **RSI(14)**: needs 15+ candles
- **MACD(12,26,9)**: needs 34+ candles (26 + 9 signal periods − 1)
- **Bollinger Bands(20)**: needs 20+ candles

With a successful backfill these thresholds are met at load time. Without
backfill, expect a warm-up period before indicator alerts can fire.

### Trade proposals

When indicator conditions are met on a closed candle, the app emits a trade
proposal and records it in the action log (Logs page). Triggers: RSI oversold
(<30) or overbought (>70), MACD bullish or bearish crossover, Bollinger Band
breakout above or below. Each signal is subject to a **30-minute cooldown per
asset per interval** to avoid flooding the log. No exchange account is required
— proposals are informational only.

### History view

The History page shows a candlestick chart with full technical indicators for a
chosen asset and time range. Available presets:

| Preset | Interval | Covers |
|--------|----------|--------|
| 1D | 5m | Last 24 hours |
| 3D | 5m | Last 3 days |
| 1W | 1h | Last 7 days |
| 1M | 4h | Last 30 days |
| 6M | 1d | Last 6 months |
| 1Y | 1d | Last year |
| 3Y | 1w | Last 3 years |
| 5Y | 1w | Last 5 years |
| ALL | 1M | All available monthly history |

Each preset fetches extra candles before the visible window (200 for 1D/1W/1M/6M/1Y,
100 for 3D/3Y/5Y, 50 for ALL) so that RSI, MACD, and EMA values are fully warmed-up
from the very first bar. All data is fetched in a single Binance REST call and
cached in IndexedDB. The ↻ button forces a refresh, bypassing the cache. The ALL
preset shows the complete monthly history available on Binance; for most assets
this goes back to 2017–2018 rather than a full 10 years.

### App updates

The app checks for a new version every **30 minutes** by polling the service
worker registration. When an update is ready (the new service worker is
installed and waiting), an **update** badge appears in the top-right corner of
the header. Click it to apply the update and reload. If you never click it, the
old version continues running until the next full page reload.
