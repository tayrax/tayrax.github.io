<!-- Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com> -->
<!-- See LICENSE file. -->
<script lang="ts">
  import { onDestroy } from 'svelte';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  export let startTime: number = Date.now();

  // ---------------------------------------------------------------------------
  // Uptime
  // ---------------------------------------------------------------------------
  let uptimeLabel = '';

  function formatUptime(ms: number): string {
    const totalMin = Math.floor(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return '< 1m';
  }

  function tick(): void {
    uptimeLabel = formatUptime(Date.now() - startTime);
  }
  tick();
  const uptimeInterval = setInterval(tick, 60_000);
  onDestroy(() => clearInterval(uptimeInterval));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  type WsTestState = {
    status: 'idle' | 'running' | 'done';
    opened: boolean;
    closeCode: number | null;
    closeReason: string;
    messagesReceived: number;
    errorFired: boolean;
    durationMs: number | null;
    wasOurClose: boolean;
  };

  type Outcome = 'pass' | 'warn' | 'fail';

  type CodeInfo = { label: string; severity: Outcome };

  // ---------------------------------------------------------------------------
  // WS test logic
  // ---------------------------------------------------------------------------
  const TEST_TIMEOUT_MS = 10_000;
  const SETTLE_AFTER_MSG_MS = 3_000;

  const COINCAP_URL = 'wss://ws.coincap.io/prices?assets=bitcoin';
  const BINANCE_TICKER_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@miniTicker';
  const BINANCE_KLINE_URL = 'wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m';

  const makeIdle = (): WsTestState => ({
    status: 'idle',
    opened: false,
    closeCode: null,
    closeReason: '',
    messagesReceived: 0,
    errorFired: false,
    durationMs: null,
    wasOurClose: false,
  });

  let coincap: WsTestState = makeIdle();
  let binanceTicker: WsTestState = makeIdle();
  let binanceKline: WsTestState = makeIdle();

  type RestTestState = {
    status: 'idle' | 'running' | 'done';
    statusCode: number | null;
    messagesReceived: number;
    errorFired: boolean;
    durationMs: number | null;
    success: boolean;
  };

  const makeRestIdle = (): RestTestState => ({
    status: 'idle',
    statusCode: null,
    messagesReceived: 0,
    errorFired: false,
    durationMs: null,
    success: false,
  });

  let binanceRest: RestTestState = makeRestIdle();

  function runWsTest(url: string, onUpdate: (s: WsTestState) => void): void {
    const state: WsTestState = { ...makeIdle(), status: 'running' };
    onUpdate({ ...state });

    const startMs = Date.now();
    const ws = new WebSocket(url);
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    let ourClose = false;

    const doClose = (): void => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ourClose = true;
        ws.close(1000, 'diagnostic complete');
      }
    };

    const timeout = setTimeout(doClose, TEST_TIMEOUT_MS);

    ws.onopen = (): void => {
      state.opened = true;
      onUpdate({ ...state });
    };

    ws.onmessage = (): void => {
      state.messagesReceived += 1;
      onUpdate({ ...state });
      if (state.messagesReceived === 1 && closeTimer === null) {
        closeTimer = setTimeout(doClose, SETTLE_AFTER_MSG_MS);
      }
    };

    ws.onerror = (): void => {
      state.errorFired = true;
      onUpdate({ ...state });
    };

    ws.onclose = (e: CloseEvent): void => {
      clearTimeout(timeout);
      if (closeTimer) clearTimeout(closeTimer);
      state.status = 'done';
      state.closeCode = e.code;
      state.closeReason = e.reason;
      state.durationMs = Date.now() - startMs;
      state.wasOurClose = ourClose;
      onUpdate({ ...state });
    };
  }

  function testCoincap(): void {
    if (coincap.status === 'running') return;
    runWsTest(COINCAP_URL, (s) => (coincap = s));
  }

  function testBinanceTicker(): void {
    if (binanceTicker.status === 'running') return;
    runWsTest(BINANCE_TICKER_URL, (s) => (binanceTicker = s));
  }

  function testBinanceKline(): void {
    if (binanceKline.status === 'running') return;
    runWsTest(BINANCE_KLINE_URL, (s) => (binanceKline = s));
  }

  function runAll(): void {
    testCoincap();
    testBinanceTicker();
    testBinanceKline();
    testBinanceRest();
  }

  function testBinanceRest(): void {
    if (binanceRest.status === 'running') return;
    const state: RestTestState = { ...makeRestIdle(), status: 'running' };
    binanceRest = { ...state };

    const startMs = Date.now();
    const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=10';

    fetch(url)
      .then(async (res) => {
        state.statusCode = res.status;
        if (!res.ok) {
          state.errorFired = true;
          binanceRest = { ...state, status: 'done', durationMs: Date.now() - startMs, success: false };
          return;
        }
        const rows = await res.json();
        state.messagesReceived = Array.isArray(rows) ? rows.length : 0;
        state.success = state.messagesReceived > 0;
        state.status = 'done';
        state.durationMs = Date.now() - startMs;
        binanceRest = { ...state };
      })
      .catch(() => {
        state.errorFired = true;
        state.status = 'done';
        state.durationMs = Date.now() - startMs;
        binanceRest = { ...state, success: false };
      });
  }

  // ---------------------------------------------------------------------------
  // Close code interpretation
  // ---------------------------------------------------------------------------
  function interpretClose(code: number, wasOurs: boolean): CodeInfo {
    if (wasOurs && code === 1000)
      return { label: 'Normal — diagnostic closed after receiving data', severity: 'pass' };
    switch (code) {
      case 1000: return { label: 'Normal closure', severity: 'pass' };
      case 1001: return { label: 'Going away (server shutting down or navigating)', severity: 'warn' };
      case 1002: return { label: 'Protocol error', severity: 'fail' };
      case 1003: return { label: 'Unsupported data type', severity: 'fail' };
      case 1005: return { label: 'No status code present', severity: 'warn' };
      case 1006:
        return {
          label:
            'Abnormal — no close frame received. Common causes: Origin header blocked by server, network failure, TLS error, or server process crash.',
          severity: 'fail',
        };
      case 1007: return { label: 'Invalid frame payload (encoding)', severity: 'fail' };
      case 1008: return { label: 'Policy violation — server explicitly rejected this connection', severity: 'fail' };
      case 1009: return { label: 'Message too big', severity: 'fail' };
      case 1010: return { label: 'Extension negotiation failed', severity: 'fail' };
      case 1011: return { label: 'Internal server error', severity: 'fail' };
      case 1015: return { label: 'TLS handshake failure', severity: 'fail' };
      default:
        if (code >= 4000 && code <= 4999)
          return { label: `Application-defined close code (${code})`, severity: 'warn' };
        return { label: `Unknown close code ${code}`, severity: 'warn' };
    }
  }

  function testOutcome(s: WsTestState): Outcome {
    if (s.status !== 'done') return 'warn';
    if (s.opened && s.messagesReceived > 0 && s.wasOurClose) return 'pass';
    if (s.opened && s.messagesReceived === 0 && s.wasOurClose) return 'warn'; // connected, no data in time
    return 'fail';
  }

  // ---------------------------------------------------------------------------
  // App version
  // ---------------------------------------------------------------------------
  const appVersion: string = __APP_VERSION__;
  const appBuild: string = __APP_BUILD__;
  const appCdn: string = (() => {
    try {
      return new URL(__APP_CDN__).host || __APP_CDN__;
    } catch {
      return __APP_CDN__;
    }
  })();

  // ---------------------------------------------------------------------------
  // Screen dimensions
  // ---------------------------------------------------------------------------
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;

  function onResize(): void {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
  }
  window.addEventListener('resize', onResize);
  onDestroy(() => window.removeEventListener('resize', onResize));

  // ---------------------------------------------------------------------------
  // Browser capabilities
  // ---------------------------------------------------------------------------
  const wsSupported = typeof WebSocket !== 'undefined';
  const notifSupported = 'Notification' in window;
  const notifPermission = notifSupported ? Notification.permission : 'unsupported';
  const swSupported = 'serviceWorker' in navigator;
  const localStorageOk = (() => {
    try {
      localStorage.setItem('__tayrax_diag', '1');
      localStorage.removeItem('__tayrax_diag');
      return true;
    } catch {
      return false;
    }
  })();

  const indexedDbOk = (() => {
    try {
      const req = indexedDB.open('__tayrax_diag');
      req.onsuccess = () => indexedDB.deleteDatabase('__tayrax_diag');
      return true;
    } catch {
      return false;
    }
  })();

  const CLOSE_CODE_REF: { code: string; meaning: string }[] = [
    { code: '1000', meaning: 'Normal closure — clean shutdown by either side' },
    { code: '1001', meaning: 'Going away — endpoint is leaving (page navigation, server restart)' },
    { code: '1006', meaning: 'Abnormal — connection dropped with no close frame (network failure, Origin block, TLS error)' },
    { code: '1008', meaning: 'Policy violation — server rejected the connection (auth failure, banned Origin)' },
    { code: '1011', meaning: 'Server error — unexpected condition on the server side' },
    { code: '1015', meaning: 'TLS failure — certificate or handshake error' },
    { code: '4xxx', meaning: 'Application-defined — meaning depends on the specific API' },
  ];
</script>

<main>

  <!-- ======================================================================
       App identity
  ======================================================================= -->
  <section>
    <div class="info-grid">
      <div class="info-row">
        <span class="info-name">App version</span>
        <span class="val">{appVersion}</span>
      </div>
      <div class="info-row">
        <span class="info-name">App build</span>
        <span class="val">{appBuild}</span>
      </div>
      <div class="info-row">
        <span class="info-name">CDN</span>
        <span class="val">{appCdn}</span>
      </div>
      <div class="info-row">
        <span class="info-name">Uptime</span>
        <span class="val">{uptimeLabel}</span>
      </div>
    </div>
  </section>

  <!-- ======================================================================
       Browser capabilities
  ======================================================================= -->
  <section>
    <h2>Browser capabilities</h2>
    <div class="info-grid">
      <div class="info-row">
        <span class="info-name">WebSocket API</span>
        <span class="badge" class:ok={wsSupported} class:fail={!wsSupported}>
          {wsSupported ? 'supported' : 'not supported'}
        </span>
      </div>
      <div class="info-row">
        <span class="info-name">Notifications API</span>
        <span class="badge" class:ok={notifSupported} class:fail={!notifSupported}>
          {notifSupported ? 'supported' : 'not supported'}
        </span>
      </div>
      {#if notifSupported}
        <div class="info-row">
          <span class="info-name">Notification permission</span>
          <span
            class="badge"
            class:ok={notifPermission === 'granted'}
            class:warn={notifPermission === 'default'}
            class:fail={notifPermission === 'denied'}
          >
            {notifPermission}
          </span>
        </div>
      {/if}
      <div class="info-row">
        <span class="info-name">Service Worker API</span>
        <span class="badge" class:ok={swSupported} class:warn={!swSupported}>
          {swSupported ? 'supported' : 'not supported'}
        </span>
      </div>
      <div class="info-row">
        <span class="info-name">localStorage</span>
        <span class="badge" class:ok={localStorageOk} class:fail={!localStorageOk}>
          {localStorageOk ? 'available' : 'unavailable'}
        </span>
      </div>
      <div class="info-row">
        <span class="info-name">IndexedDB</span>
        <span class="badge" class:ok={indexedDbOk} class:fail={!indexedDbOk}>
          {indexedDbOk ? 'available' : 'unavailable'}
        </span>
      </div>
    </div>
  </section>

  <!-- ======================================================================
       Screen dimensions
  ======================================================================= -->
  <section>
    <h2>Screen dimensions</h2>
    <div class="info-grid">
      <div class="info-row">
        <span class="info-name">Viewport width</span>
        <span class="val">{viewportWidth} px</span>
      </div>
      <div class="info-row">
        <span class="info-name">Viewport height</span>
        <span class="val">{viewportHeight} px</span>
      </div>
    </div>
  </section>

  <!-- ======================================================================
       API diagnostics
  ======================================================================= -->
  <section>
    <div class="section-header">
      <button type="button" class="btn-run-all" on:click={runAll}
        disabled={coincap.status === 'running' || binanceTicker.status === 'running' || binanceKline.status === 'running' || binanceRest.status === 'running'}>
        Run all tests
      </button>
    </div>
  </section>

  <!-- ======================================================================
       REST diagnostics
  ======================================================================= -->
  <section>
    <h2>REST diagnostics</h2>
    <p class="hint">
      Verifies REST API endpoints used for data fetching (e.g., historical candles for the History view).
    </p>

    <!-- Binance REST klines (history) -->
    <div class="ws-card">
      <div class="ws-card-header">
        <div>
          <div class="ws-name">Binance klines <span class="ws-role">(history)</span></div>
          <code class="ws-url">https://api.binance.com/api/v3/klines</code>
        </div>
        <button
          type="button"
          class="btn-test"
          on:click={testBinanceRest}
          disabled={binanceRest.status === 'running'}
        >
          {binanceRest.status === 'running' ? 'testing…' : 'Test'}
        </button>
      </div>

      {#if binanceRest.status !== 'idle'}
        <div class="ws-results">
          <div class="result-row">
            <span class="rl">Status code</span>
            <span class="badge" class:ok={binanceRest.statusCode === 200} class:fail={binanceRest.statusCode !== null && binanceRest.statusCode !== 200} class:neutral={binanceRest.statusCode === null && binanceRest.status === 'running'}>
              {binanceRest.statusCode === null ? (binanceRest.status === 'running' ? '…' : 'no response') : binanceRest.statusCode}
            </span>
          </div>
          <div class="result-row">
            <span class="rl">Candles received</span>
            <span class="val">{binanceRest.messagesReceived}</span>
          </div>
          {#if binanceRest.status === 'done'}
            <div class="result-row">
              <span class="rl">Duration</span>
              <span class="val">{binanceRest.durationMs} ms</span>
            </div>
            <div class="result-row">
              <span class="rl">Outcome</span>
              <span class="badge outcome" class:ok={binanceRest.success} class:fail={!binanceRest.success}>
                {binanceRest.success ? 'pass — API works' : 'fail — no data received or network error'}
              </span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </section>

  <!-- ======================================================================
       WebSocket diagnostics
  ======================================================================= -->
  <section>
    <h2>WebSocket diagnostics</h2>
    <p class="hint">
      Each test opens a live connection, waits up to 10 s for data, then closes and reports results.
    </p>

    <!-- CoinCap -->
    <div class="ws-card">
      <div class="ws-card-header">
        <div>
          <div class="ws-name">CoinCap prices</div>
          <code class="ws-url">{COINCAP_URL}</code>
        </div>
        <button
          type="button"
          class="btn-test"
          on:click={testCoincap}
          disabled={coincap.status === 'running'}
        >
          {coincap.status === 'running' ? 'testing…' : 'Test'}
        </button>
      </div>

      {#if coincap.status !== 'idle'}
        <div class="ws-results">
          <div class="result-row">
            <span class="rl">Handshake (101)</span>
            <span class="badge" class:ok={coincap.opened} class:fail={!coincap.opened && coincap.status === 'done'} class:neutral={!coincap.opened && coincap.status === 'running'}>
              {coincap.opened ? 'opened' : coincap.status === 'running' ? '…' : 'never opened'}
            </span>
          </div>
          <div class="result-row">
            <span class="rl">Messages received</span>
            <span class="val">{coincap.messagesReceived}</span>
          </div>
          {#if coincap.status === 'done' && coincap.closeCode !== null}
            {@const info = interpretClose(coincap.closeCode, coincap.wasOurClose)}
            {@const oc = testOutcome(coincap)}
            <div class="result-row">
              <span class="rl">Close code</span>
              <span class="val">{coincap.closeCode}{coincap.closeReason ? ` "${coincap.closeReason}"` : ''}</span>
            </div>
            <div class="result-row">
              <span class="rl">Interpretation</span>
              <span class="badge" class:ok={info.severity === 'pass'} class:warn={info.severity === 'warn'} class:fail={info.severity === 'fail'}>
                {info.label}
              </span>
            </div>
            <div class="result-row">
              <span class="rl">Duration</span>
              <span class="val">{coincap.durationMs} ms</span>
            </div>
            <div class="result-row">
              <span class="rl">Outcome</span>
              <span class="badge outcome" class:ok={oc === 'pass'} class:warn={oc === 'warn'} class:fail={oc === 'fail'}>
                {oc === 'pass' ? 'pass — connection works' : oc === 'warn' ? 'warn — connected but no data received in time' : 'fail — connection rejected or dropped'}
              </span>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Binance miniTicker (live prices) -->
    <div class="ws-card">
      <div class="ws-card-header">
        <div>
          <div class="ws-name">Binance miniTicker <span class="ws-role">(live prices)</span></div>
          <code class="ws-url">{BINANCE_TICKER_URL}</code>
        </div>
        <button
          type="button"
          class="btn-test"
          on:click={testBinanceTicker}
          disabled={binanceTicker.status === 'running'}
        >
          {binanceTicker.status === 'running' ? 'testing…' : 'Test'}
        </button>
      </div>

      {#if binanceTicker.status !== 'idle'}
        <div class="ws-results">
          <div class="result-row">
            <span class="rl">Handshake (101)</span>
            <span class="badge" class:ok={binanceTicker.opened} class:fail={!binanceTicker.opened && binanceTicker.status === 'done'} class:neutral={!binanceTicker.opened && binanceTicker.status === 'running'}>
              {binanceTicker.opened ? 'opened' : binanceTicker.status === 'running' ? '…' : 'never opened'}
            </span>
          </div>
          <div class="result-row">
            <span class="rl">Messages received</span>
            <span class="val">{binanceTicker.messagesReceived}</span>
          </div>
          {#if binanceTicker.status === 'done' && binanceTicker.closeCode !== null}
            {@const info = interpretClose(binanceTicker.closeCode, binanceTicker.wasOurClose)}
            {@const oc = testOutcome(binanceTicker)}
            <div class="result-row">
              <span class="rl">Close code</span>
              <span class="val">{binanceTicker.closeCode}{binanceTicker.closeReason ? ` "${binanceTicker.closeReason}"` : ''}</span>
            </div>
            <div class="result-row">
              <span class="rl">Interpretation</span>
              <span class="badge" class:ok={info.severity === 'pass'} class:warn={info.severity === 'warn'} class:fail={info.severity === 'fail'}>
                {info.label}
              </span>
            </div>
            <div class="result-row">
              <span class="rl">Duration</span>
              <span class="val">{binanceTicker.durationMs} ms</span>
            </div>
            <div class="result-row">
              <span class="rl">Outcome</span>
              <span class="badge outcome" class:ok={oc === 'pass'} class:warn={oc === 'warn'} class:fail={oc === 'fail'}>
                {oc === 'pass' ? 'pass — connection works' : oc === 'warn' ? 'warn — connected but no data received in time' : 'fail — connection rejected or dropped'}
              </span>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Binance kline (volume) -->
    <div class="ws-card">
      <div class="ws-card-header">
        <div>
          <div class="ws-name">Binance kline <span class="ws-role">(volume)</span></div>
          <code class="ws-url">{BINANCE_KLINE_URL}</code>
        </div>
        <button
          type="button"
          class="btn-test"
          on:click={testBinanceKline}
          disabled={binanceKline.status === 'running'}
        >
          {binanceKline.status === 'running' ? 'testing…' : 'Test'}
        </button>
      </div>

      {#if binanceKline.status !== 'idle'}
        <div class="ws-results">
          <div class="result-row">
            <span class="rl">Handshake (101)</span>
            <span class="badge" class:ok={binanceKline.opened} class:fail={!binanceKline.opened && binanceKline.status === 'done'} class:neutral={!binanceKline.opened && binanceKline.status === 'running'}>
              {binanceKline.opened ? 'opened' : binanceKline.status === 'running' ? '…' : 'never opened'}
            </span>
          </div>
          <div class="result-row">
            <span class="rl">Messages received</span>
            <span class="val">{binanceKline.messagesReceived}
              {#if binanceKline.status !== 'done'}<span class="hint-inline">(fires once per closed minute candle — may be 0 if no candle closes during the test)</span>{/if}
            </span>
          </div>
          {#if binanceKline.status === 'done' && binanceKline.closeCode !== null}
            {@const info = interpretClose(binanceKline.closeCode, binanceKline.wasOurClose)}
            {@const oc = testOutcome(binanceKline)}
            <div class="result-row">
              <span class="rl">Close code</span>
              <span class="val">{binanceKline.closeCode}{binanceKline.closeReason ? ` "${binanceKline.closeReason}"` : ''}</span>
            </div>
            <div class="result-row">
              <span class="rl">Interpretation</span>
              <span class="badge" class:ok={info.severity === 'pass'} class:warn={info.severity === 'warn'} class:fail={info.severity === 'fail'}>
                {info.label}
              </span>
            </div>
            <div class="result-row">
              <span class="rl">Duration</span>
              <span class="val">{binanceKline.durationMs} ms</span>
            </div>
            <div class="result-row">
              <span class="rl">Outcome</span>
              <span class="badge outcome" class:ok={oc === 'pass'} class:warn={oc === 'warn'} class:fail={oc === 'fail'}>
                {#if oc === 'pass'}
                  pass — connection works
                {:else if oc === 'warn'}
                  warn — connected but no candle fired in the test window (normal if &lt;1 min elapsed)
                {:else}
                  fail — connection rejected or dropped
                {/if}
              </span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </section>

  <!-- ======================================================================
       WebSocket close code reference
  ======================================================================= -->
  <section>
    <h2>WebSocket close code reference</h2>
    <table class="ref-table">
      <thead>
        <tr><th>Code</th><th>Meaning</th></tr>
      </thead>
      <tbody>
        {#each CLOSE_CODE_REF as row}
          <tr>
            <td class="code-cell">{row.code}</td>
            <td>{row.meaning}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="hint">
      Code <strong>1006</strong> is the most common failure when deploying to a new domain — the
      server drops the connection without a proper close frame, often because the
      <code>Origin</code> header is not on its allowlist.
    </p>
  </section>

</main>

<style>
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

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* --- Badges --- */
  .badge {
    display: inline-block;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.78rem;
    background: #2a2a2a;
    color: #888;
  }
  .badge.ok      { background: #0f2e1d; color: #4ade80; }
  .badge.warn    { background: #2d2310; color: #fbbf24; }
  .badge.fail    { background: #3a1f1f; color: #f87171; }
  .badge.neutral { background: #2a2a2a; color: #888; }
  .badge.outcome { border-radius: 4px; }

  /* --- Browser capabilities --- */
  .info-grid { display: flex; flex-direction: column; gap: 0.4rem; }
  .info-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.75rem;
    background: #161616;
    border-radius: 5px;
    border: 1px solid #222;
  }
  .info-name { font-size: 0.85rem; color: #bbb; flex: 1; }

  /* --- Buttons --- */
  .btn-run-all {
    background: #1e3a5f;
    color: #93c5fd;
    border: 1px solid #2563eb44;
    border-radius: 5px;
    padding: 0.35rem 0.85rem;
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .btn-run-all:hover:not(:disabled) { background: #1d4ed8; color: #fff; }
  .btn-run-all:disabled { opacity: 0.45; cursor: default; }

  .btn-test {
    background: #222;
    color: #aaa;
    border: 1px solid #333;
    border-radius: 5px;
    padding: 0.3rem 0.75rem;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .btn-test:hover:not(:disabled) { background: #2a2a2a; color: #eee; }
  .btn-test:disabled { opacity: 0.45; cursor: default; }

  /* --- WS cards --- */
  .ws-card {
    background: #161616;
    border: 1px solid #222;
    border-radius: 6px;
    overflow: hidden;
  }
  .ws-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #1e1e1e;
  }
  .ws-name { font-size: 0.88rem; color: #ccc; font-weight: 600; margin-bottom: 0.2rem; }
  .ws-role { font-weight: 400; color: #555; font-size: 0.8rem; }
  .ws-url  { font-size: 0.72rem; color: #555; word-break: break-all; }

  .ws-results {
    padding: 0.6rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .result-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.82rem;
  }
  .rl { color: #666; width: 10rem; flex-shrink: 0; padding-top: 0.15rem; }
  .val { color: #aaa; }
  .hint-inline { color: #555; font-size: 0.75rem; margin-left: 0.4rem; }

  /* --- Reference table --- */
  .ref-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }
  .ref-table th {
    text-align: left;
    padding: 0.4rem 0.75rem;
    color: #555;
    font-weight: 500;
    border-bottom: 1px solid #222;
  }
  .ref-table td {
    padding: 0.4rem 0.75rem;
    color: #999;
    border-bottom: 1px solid #1a1a1a;
    vertical-align: top;
  }
  .code-cell { color: #7dd3fc; font-family: monospace; white-space: nowrap; }
  .ref-table tr:last-child td { border-bottom: none; }

  .hint { font-size: 0.82rem; color: #555; margin: 0; line-height: 1.6; }
</style>
