// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

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

function sendTo(port: MessagePort, msg: WorkerToTab): void {
  try {
    port.postMessage(msg);
  } catch {
    allPorts.delete(port);
    botStatePorts.delete(port);
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

  // Hand off initial state to the newly-connected tab: current alerts list,
  // enabled assets, and a one-time prune list if any assets expired on boot.
  sendTo(port, { type: 'alertList', alerts: engine.getAlertsSnapshot() });
  sendTo(port, { type: 'enabledAssetsList', assets: engine.getEnabledAssetsSnapshot() });
  const pending = engine.takePendingPrune();
  if (pending.length > 0) sendTo(port, { type: 'pruneAssets', assets: pending });

  broadcastBotState();

  port.addEventListener('message', (me: MessageEvent<TabToWorker>) => {
    const msg = me.data;
    switch (msg.type) {
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
      case 'addAlert':
        engine.addAlert(msg.rule);
        break;
      case 'removeAlert':
        engine.removeAlert(msg.id);
        break;
      case 'toggleAsset':
        engine.toggleAsset(msg.asset);
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
