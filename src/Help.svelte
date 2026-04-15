<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import NavMenu from './components/NavMenu.svelte';
  import { PRICE_PROVIDER } from './lib/config';
</script>

<header class="top">
  <div class="brand">
    <NavMenu />
    <span>tayrax</span>
    <span class="sep">/</span>
    <span class="page">help</span>
  </div>
</header>

<main>
  <section>
    <h2>How it works</h2>
    <dl>
      <dt>Price updates</dt>
      <dd>Prices are streamed live from {PRICE_PROVIDER === 'binance' ? "Binance's miniTicker" : "CoinCap's"} WebSocket feed and refreshed at most every 5 seconds per asset. The displayed price may lag up to 5 seconds behind the live market.</dd>
      <dt>Volume updates</dt>
      <dd>Volume data comes from Binance's 1-minute kline stream and updates once per minute, on closed-candle events.</dd>
      <dt>Cached badge</dt>
      <dd>A <em>cached</em> label appears on a price card when no update has been received for more than 30 seconds, indicating a stale or disconnected feed.</dd>
      <dt>Volume-spike alerts</dt>
      <dd>Volume-spike detection requires ≥10 closed 1-minute candles (≈10 minutes of runtime) before a rule can fire. Expect a warm-up period after the app loads.</dd>
      <dt>Charts and indicators</dt>
      <dd>On startup, up to 200 recent 1-minute candles are fetched from Binance REST to seed the chart. SMA(20), SMA(50), Bollinger Bands, RSI(14), and MACD(12,26,9) are computed from this history. If the backfill fetch fails, indicators become available as live candles arrive.</dd>
      <dt>Indicator alerts</dt>
      <dd>RSI, MACD crossover, and Bollinger Band breakout alerts require at least 26–34 candles of history before they can fire (MACD needs 26 + 9 signal periods). A warm-up period applies if the REST backfill is unavailable.</dd>
    </dl>
  </section>
</main>

<style>
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid #222;
    font-size: 0.9rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: #ccc;
  }
  .sep { color: #444; }
  .page { color: #888; font-weight: 400; }

  main {
    max-width: 860px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  section { display: flex; flex-direction: column; gap: 0.75rem; }

  h2 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #666;
    margin: 0;
  }

  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  dt {
    color: #eee;
    font-weight: 600;
    font-size: 0.9rem;
  }
  dd {
    margin: 0.2rem 0 0 0;
    color: #888;
    line-height: 1.6;
    font-size: 0.88rem;
  }
</style>
