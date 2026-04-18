// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import { writable, type Readable } from 'svelte/store';
import { getBotClient } from './bot-client';
import { loadEnabledFromStorage } from './enabled-assets-core';
import type { AssetId } from './config';

// Tab-side mirror of the worker's authoritative enabled-assets list.
// Hydrated from localStorage at module load for instant first-render,
// then overwritten by worker broadcasts.
const _store = writable<AssetId[]>(loadEnabledFromStorage());

export const enabledAssets: Readable<AssetId[]> = { subscribe: _store.subscribe };

export const _applyEnabledList = (list: AssetId[]): void => {
  _store.set(list);
};

if (typeof window !== 'undefined') {
  getBotClient().subscribe((msg) => {
    if (msg.type === 'enabledAssetsList') _applyEnabledList(msg.assets);
  });
}

export const toggleAsset = (asset: AssetId): void => {
  getBotClient().post({ type: 'toggleAsset', asset });
};
