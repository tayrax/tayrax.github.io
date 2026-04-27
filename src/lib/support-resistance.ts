// Copyright (c) Jeremías Casteglione <jrmsdev@gmail.com>
// See LICENSE file.

import type { OHLCVCandle } from './candles';

export type SRLevel = {
  price: number;
  touchCount: number;
  confidence: number;
};

function confidenceFromTouches(touches: number): number {
  if (touches >= 5) return 85;
  if (touches === 4) return 75;
  if (touches === 3) return 60;
  return 40;
}

export const findSupportResistance = (
  candles: OHLCVCandle[],
  pivotNeighbours = 2,
  clusterTolerancePct = 0.5
): SRLevel[] => {
  if (candles.length < pivotNeighbours * 2 + 1) return [];

  const pivotPrices: number[] = [];
  const n = pivotNeighbours;

  for (let i = n; i < candles.length - n; i++) {
    const c = candles[i];
    // Pivot high
    let isHigh = true;
    let isLow = true;
    for (let j = i - n; j <= i + n; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isHigh = false;
      if (candles[j].low <= c.low) isLow = false;
    }
    if (isHigh) pivotPrices.push(c.high);
    if (isLow) pivotPrices.push(c.low);
  }

  if (pivotPrices.length === 0) return [];

  // Median price for tolerance band
  const sorted = [...pivotPrices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const tolerance = median * (clusterTolerancePct / 100);

  // Cluster pivots
  const clusters: number[][] = [];
  for (const price of pivotPrices) {
    let placed = false;
    for (const cluster of clusters) {
      const clusterMean = cluster.reduce((s, v) => s + v, 0) / cluster.length;
      if (Math.abs(price - clusterMean) <= tolerance) {
        cluster.push(price);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([price]);
  }

  const levels: SRLevel[] = [];
  for (const cluster of clusters) {
    if (cluster.length < 2) continue;
    const price = cluster.reduce((s, v) => s + v, 0) / cluster.length;
    levels.push({
      price,
      touchCount: cluster.length,
      confidence: confidenceFromTouches(cluster.length),
    });
  }

  return levels.sort((a, b) => a.price - b.price);
};
