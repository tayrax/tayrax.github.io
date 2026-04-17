// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { STORAGE_KEYS, SUPPORTED_ASSETS } from './config';
import type { TabToWorker, WorkerToTab } from './bot-types';
import { BotEngine } from './bot-engine';

// ---------------------------------------------------------------------------
// Port management
// ---------------------------------------------------------------------------
const allPorts = new Set<MessagePort>();
const botStatePorts = new Set<MessagePort>();

function broadcast(msg: WorkerToTab): void {
  for (const port of allPorts) {
    try {
      port.postMessage(msg);
    } catch {
      allPorts.delete(port);
      botStatePorts.delete(port);
    }
  }
}

function broadcastBotState(): void {
  if (botStatePorts.size === 0) return;
  const msg: WorkerToTab = { type: 'botState', state: engine.getState() };
  for (const port of botStatePorts) {
    try {
      port.postMessage(msg);
    } catch {
      botStatePorts.delete(port);
      allPorts.delete(port);
    }
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
const engine = new BotEngine({
  broadcast,
  broadcastBotState,
  getConnectedTabCount: () => allPorts.size
});

// ---------------------------------------------------------------------------
// Boot: load enabled assets from localStorage and start feeds
// ---------------------------------------------------------------------------
function loadBootAssets(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.enabledAssets);
    if (!raw) return ['bitcoin'];
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((a) => (SUPPORTED_ASSETS as readonly string[]).includes(a));
    return valid.length > 0 ? valid : ['bitcoin'];
  } catch {
    return ['bitcoin'];
  }
}

// Periodic botState refresh keeps lastTickAt current on the bot page.
setInterval(() => {
  broadcastBotState();
}, 5_000);

// ---------------------------------------------------------------------------
// SharedWorker connect handler
// ---------------------------------------------------------------------------
(self as EventTarget).addEventListener('connect', (ev: Event) => {
  const port = (ev as MessageEvent).ports[0];
  if (!port) return;

  allPorts.add(port);
  broadcastBotState();

  port.addEventListener('message', (me: MessageEvent<TabToWorker>) => {
    const msg = me.data;
    switch (msg.type) {
      case 'setEnabledAssets':
        engine.setEnabledAssets(msg.assets);
        break;
      case 'reconnect':
        engine.reconnect(msg.feed);
        break;
      case 'subscribeBotState':
        botStatePorts.add(port);
        try {
          port.postMessage({ type: 'botState', state: engine.getState() } satisfies WorkerToTab);
        } catch {
          botStatePorts.delete(port);
          allPorts.delete(port);
        }
        break;
      case 'alertsChanged':
        engine.refreshAlerts();
        break;
    }
  });

  port.addEventListener('messageerror', () => {
    allPorts.delete(port);
    botStatePorts.delete(port);
    broadcastBotState();
  });

  port.start();
});

// Boot
engine.setEnabledAssets(loadBootAssets());
