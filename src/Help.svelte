<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { PRICE_PROVIDER } from './lib/config';
</script>

<section>
  <h2>How it works</h2>
  <dl>
    <details>
      <summary>Prices</summary>
      <p>Prices update every few seconds from a live {PRICE_PROVIDER === 'binance' ? 'Binance' : 'CoinCap'} feed. What you see is never more than 5 seconds old.</p>
    </details>
    <details>
      <summary>Volume</summary>
      <p>Volume figures reflect the most recently completed 1-minute window. They update once per minute.</p>
    </details>
    <details>
      <summary>Cached badge</summary>
      <p>The <em>cached</em> label on a price card means the live feed has gone quiet for more than 30 seconds. Your internet connection may be intermittent, or the data source is temporarily unavailable.</p>
    </details>
    <details>
      <summary>Volume-spike alerts</summary>
      <p>These alerts need about 10 minutes of data after the app loads before they can fire. This warm-up period is intentional — it prevents false alarms on a cold start.</p>
    </details>
    <details>
      <summary>Charts and indicators</summary>
      <p>When you open the app, recent price history is loaded automatically so charts and indicators (SMA, EMA, Bollinger Bands, RSI, MACD) are ready immediately. If that initial load fails, everything still works — it just takes a few minutes of live data to catch up. Use the ⚙ button on any chart to adjust indicator periods to your preference.</p>
    </details>
    <details>
      <summary>Indicator alerts</summary>
      <p>RSI, MACD, and Bollinger Band alerts need a short warm-up period to gather enough history before they can fire. With a normal internet connection this is invisible — the data loads in the background before you notice anything.</p>
    </details>
    <details>
      <summary>Trade proposals</summary>
      <p>When the indicators suggest a potential trade opportunity, the app logs a proposal on the <em>Logs</em> page. These are suggestions only — no orders are placed and no exchange account is needed. Each type of signal is rate-limited to one proposal per 30 minutes per coin to keep the log readable.</p>
    </details>
    <details>
      <summary>History</summary>
      <p>The History page shows a full candlestick chart with indicators for any enabled coin. Choose a time range and the chart loads the right level of detail automatically — 5-minute bars for 1D and 3D, hourly for 1W, 4-hour for 1M, daily for 6M and 1Y, weekly for 3Y and 5Y, and monthly bars for the ALL preset. The ALL preset shows the complete monthly history available on the exchange; for most coins this goes back to 2017–2018. Data is fetched once and cached, so switching back to a recently viewed preset is instant. Use ↻ to force a fresh fetch.</p>
    </details>
    <details>
      <summary>App updates</summary>
      <p>The app silently checks for updates every 30 minutes. When a new version is ready, an <em>update</em> badge appears in the top-right corner. Click it to reload — otherwise the current version keeps running until you close the tab.</p>
    </details>
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
    gap: 0.5rem;
  }
  details {
    border-bottom: 1px solid #1e2a3a;
    padding-bottom: 0.5rem;
  }
  details:last-child { border-bottom: none; }

  summary {
    color: #eee;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    user-select: none;
  }
  summary::-webkit-details-marker { display: none; }
  summary::before {
    content: '▶';
    font-size: 0.55rem;
    color: #555;
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }
  details[open] > summary::before { transform: rotate(90deg); }

  details > p {
    margin: 0.35rem 0 0 1rem;
    color: #888;
    line-height: 1.6;
    font-size: 0.88rem;
  }
</style>
