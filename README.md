# tayrax

A personalized crypto trading bot and monitoring dashboard.
Hosted at [tayrax.github.io](https://tayrax.github.io).

> Named after the tayra — a fast and precise wild predator native to South America.

## Notes

### Volume-spike alerts

Volume-spike detection requires ≥10 closed 1-minute candles (≈10 minutes of
runtime) before a rule can fire. The baseline is the median of the previous
closed candles; firing earlier would produce false positives from a cold
history. If you just reloaded the app, expect a warm-up period before these
alerts become active.
