import { writable, type Readable } from 'svelte/store';

const MAX_SAMPLES = 20;
const MIN_SAMPLES_FOR_EVAL = 10;

export type VolumeState = {
  recent: number[];
  latest: number;
  updatedAt: number;
};

export type VolumeMap = Record<string, VolumeState>;

const store = writable<VolumeMap>({});

export const volumes: Readable<VolumeMap> = { subscribe: store.subscribe };

export const applyCandle = (asset: string, baseVolume: number, at: number): void => {
  store.update((map) => {
    const existing = map[asset];
    const recent = existing ? [...existing.recent, baseVolume] : [baseVolume];
    if (recent.length > MAX_SAMPLES) recent.splice(0, recent.length - MAX_SAMPLES);
    return {
      ...map,
      [asset]: { recent, latest: baseVolume, updatedAt: at }
    };
  });
};

export const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const volumeSpikeRatio = (state: VolumeState): number | null => {
  if (state.recent.length < MIN_SAMPLES_FOR_EVAL) return null;
  const baseline = state.recent.slice(0, -1);
  const base = median(baseline);
  if (base === null || base === 0) return null;
  return state.latest / base;
};
