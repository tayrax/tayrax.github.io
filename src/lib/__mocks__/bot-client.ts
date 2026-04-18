// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

// Manual mock of bot-client for tests. Echoes post() messages back as
// worker broadcasts so tab-side mirror stores update synchronously, without
// a real SharedWorker. Activated by `vi.mock('../lib/bot-client')` (or
// `./lib/bot-client` depending on the test file's location).

import type { TabToWorker, WorkerToTab } from '../bot-types';
import type { BotClient, MessageHandler } from '../bot-client';
import type { StoredAlert } from '../alert-core';
import { makeAlertId } from '../alert-core';
import type { AssetId } from '../config';
import {
  DEFAULT_ENABLED_ASSETS,
  MANDATORY_ASSET,
  MAX_ENABLED_ASSETS
} from '../config';

let alertsList: StoredAlert[] = [];
let enabledList: AssetId[] = [...DEFAULT_ENABLED_ASSETS];
const handlers = new Set<MessageHandler>();

const broadcast = (msg: WorkerToTab): void => {
  for (const h of handlers) h(msg);
};

const mockClient: BotClient = {
  post(msg: TabToWorker): void {
    switch (msg.type) {
      case 'addAlert': {
        const next = { ...msg.rule, id: makeAlertId(), lastFiredAt: null } as StoredAlert;
        alertsList = [...alertsList, next];
        broadcast({ type: 'alertList', alerts: alertsList });
        break;
      }
      case 'removeAlert': {
        const before = alertsList;
        alertsList = alertsList.filter((a) => a.id !== msg.id);
        if (before !== alertsList) broadcast({ type: 'alertList', alerts: alertsList });
        break;
      }
      case 'toggleAsset': {
        if (msg.asset === MANDATORY_ASSET) return;
        if (enabledList.includes(msg.asset)) {
          enabledList = enabledList.filter((a) => a !== msg.asset);
        } else if (enabledList.length < MAX_ENABLED_ASSETS) {
          enabledList = [...enabledList, msg.asset];
        } else {
          return;
        }
        broadcast({ type: 'enabledAssetsList', assets: enabledList });
        break;
      }
      case 'reconnect':
      case 'subscribeBotState':
        break;
    }
  },
  subscribe(handler: MessageHandler): () => void {
    handlers.add(handler);
    handler({ type: 'alertList', alerts: alertsList });
    handler({ type: 'enabledAssetsList', assets: enabledList });
    return () => { handlers.delete(handler); };
  },
  destroy(): void {
    handlers.clear();
  }
};

export const getBotClient = (): BotClient => mockClient;
export const createBotClient = (): BotClient => mockClient;

export const _resetMockBotClient = (): void => {
  alertsList = [];
  enabledList = [...DEFAULT_ENABLED_ASSETS];
  // Keep handlers — modules set them up at load time and don't re-subscribe.
  // Broadcast the reset state so mirror stores sync back to defaults.
  broadcast({ type: 'alertList', alerts: alertsList });
  broadcast({ type: 'enabledAssetsList', assets: enabledList });
};
