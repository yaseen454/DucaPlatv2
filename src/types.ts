/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PrimeItem {
  part: string;
  drop_locations: string[];
  ducat_value: number;
  rarity: 'Bronze' | 'Silver' | 'Gold';
  isVaulted: boolean;
  isBaro: boolean;
}

export interface InventoryCount {
  bronze15: number;
  bronze25: number;
  silver45: number;
  silver65: number;
  gold: number;
}

export type CostTuple = [number, number, number, number, number]; // [b15, b25, s45, s65, g]

export interface ProfitStats {
  average: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  midRange: number;
  rangeValue: number;
  modes: number[];
  modeAverage: number;
  totalCount: number;
  tradesRequired: number;
  totalDucats: number;
  onePlatPerDucatRatio: number;
}

export interface CostRecord {
  key: string;
  profit: number;
  prices: CostTuple;
  category: 'Above Average' | 'Average' | 'Below Average' | 'Below Expectation';
}

export interface GroupSummary {
  name: string;
  count: number;
  min: number;
  max: number;
  median: number;
  mean: number;
  values: number[];
}

export interface AnovaStats {
  ssb: number; // Sum of Squares Between
  ssw: number; // Sum of Squares Within
  sst: number; // Sum of Squares Total
  dfb: number; // df Between (k - 1)
  dfw: number; // df Within (N - k)
  dft: number; // df Total (N - 1)
  msb: number; // Mean Square Between
  msw: number; // Mean Square Within
  fStat: number; // F-statistic
  pValue: number; // p-value
}

export interface TukeyPair {
  group1: string;
  group2: string;
  meanDiff: number;
  qStat: number;
  lowerCI: number;
  upperCI: number;
  pValue: number;
  reject: boolean;
}

export interface OcrResultItem {
  name: string;
  count: number;
  matchedItem?: PrimeItem;
}

export interface SavedItemEntry {
  id: string;
  name: string;
  source: 'manual' | 'directory' | 'ocr' | 'trades';
  counts: InventoryCount;
  prices?: InventoryCount; // optional individual part pricing [b15, b25, s45, s65, g]
  timestamp: string;
  totalDucats: number;
  totalItems: number;
}

