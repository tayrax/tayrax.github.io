<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { PRICE_PROVIDER } from './lib/config';
</script>

<section>
  <h2>How it works</h2>
  <dl>
    <dt>Prices</dt>
    <dd>Prices update every few seconds from a live {PRICE_PROVIDER === 'binance' ? 'Binance' : 'CoinCap'} feed. What you see is never more than 5 seconds old.</dd>
    <dt>Volume</dt>
    <dd>Volume figures reflect the most recently completed 1-minute window. They update once per minute.</dd>
    <dt>Cached badge</dt>
    <dd>The <em>cached</em> label on a price card means the live feed has gone quiet for more than 30 seconds. Your internet connection may be intermittent, or the data source is temporarily unavailable.</dd>
    <dt>Volume-spike alerts</dt>
    <dd>These alerts need about 10 minutes of data after the app loads before they can fire. This warm-up period is intentional — it prevents false alarms on a cold start.</dd>
    <dt>Charts and indicators</dt>
    <dd>When you open the app, recent price history is loaded automatically so charts and indicators (RSI, MACD, Bollinger Bands) are ready immediately. If that initial load fails, everything still works — it just takes a few minutes of live data to catch up.</dd>
    <dt>Indicator alerts</dt>
    <dd>RSI, MACD, and Bollinger Band alerts need a short warm-up period to gather enough history before they can fire. With a normal internet connection this is invisible — the data loads in the background before you notice anything.</dd>
    <dt>Trade proposals</dt>
    <dd>When the indicators suggest a potential trade opportunity, the app logs a proposal on the <em>Logs</em> page. These are suggestions only — no orders are placed and no exchange account is needed. Each type of signal is rate-limited to one proposal per 30 minutes per coin to keep the log readable.</dd>
    <dt>App updates</dt>
    <dd>The app silently checks for updates every 30 minutes. When a new version is ready, an <em>update</em> badge appears in the top-right corner. Click it to reload — otherwise the current version keeps running until you close the tab.</dd>
  </dl>
</section>

<style>
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
