/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { InventoryCount, CostTuple, ProfitStats, GroupSummary, AnovaStats, TukeyPair } from '../types';

export interface TierConfig {
  min: number;
  max: number;
}

export interface PriceRangesConfig {
  b15: number;
  b25: TierConfig;
  s45: TierConfig;
  s65: TierConfig;
  g: TierConfig;
}

export const DEFAULT_NARROW_CONFIG: PriceRangesConfig = {
  b15: 1,
  b25: { min: 1, max: 2 },
  s45: { min: 2, max: 4 },
  s65: { min: 4, max: 7 },
  g: { min: 7, max: 10 }
};

export const DEFAULT_BROAD_CONFIG: PriceRangesConfig = {
  b15: 1,
  b25: { min: 1, max: 2 },
  s45: { min: 2, max: 4 },
  s65: { min: 2, max: 7 },
  g: { min: 5, max: 10 }
};

export function generateCostsCustom(config: PriceRangesConfig): CostTuple[] {
  const list: CostTuple[] = [];
  const b15 = config.b15;
  
  const getRange = (tier: TierConfig) => {
    const arr: number[] = [];
    const min = Math.min(tier.min, tier.max);
    const max = Math.max(tier.min, tier.max);
    for (let i = min; i <= max; i++) {
      arr.push(i);
    }
    return arr.length > 0 ? arr : [min];
  };

  const b25Range = getRange(config.b25);
  const s45Range = getRange(config.s45);
  const s65Range = getRange(config.s65);
  const gRange = getRange(config.g);

  for (const b25 of b25Range) {
    for (const s45 of s45Range) {
      for (const s65 of s65Range) {
        for (const g of gRange) {
          list.push([b15, b25, s45, s65, g]);
        }
      }
    }
  }
  return list;
}

export function generateCosts(): CostTuple[] {
  return generateCostsCustom(DEFAULT_NARROW_CONFIG);
}

export function generateCosts2(): CostTuple[] {
  return generateCostsCustom(DEFAULT_BROAD_CONFIG);
}

export function filterCosts(list: CostTuple[], filterValues: number[]): CostTuple[] {
  if (filterValues.length === 0) return list;
  return list.filter(t => !t.some(x => filterValues.includes(x)));
}

export function getDynamicExclusions(
  baseCosts: CostTuple[], 
  calcType: 1 | 2, 
  counts?: InventoryCount
): { sets: number[][]; names: string[]; focusLabels: string[] } {
  const sets: number[][] = [[]];
  const names: string[] = ['All Costs'];

  const hasCounts = counts && (counts.bronze25 > 0 || counts.silver45 > 0 || counts.silver65 > 0 || counts.gold > 0);
  
  if (!hasCounts || !counts) {
    const focusLabels = calcType === 1 ? ['Gold'] : ['S65', 'Gold'];
    if (calcType === 1) {
      const gVals = Array.from(new Set(baseCosts.map(c => c[4]))).sort((a, b) => a - b);
      const cands = gVals.slice(-3);
      for (const val of cands) {
        sets.push([val]);
        names.push(`Costs Without ${val}s`);
      }
      if (cands.length >= 2) {
        for (let i = 0; i < cands.length; i++) {
          for (let j = i + 1; j < cands.length; j++) {
            sets.push([cands[i], cands[j]]);
            names.push(`Costs Without ${cands[i]}s & ${cands[j]}s`);
          }
        }
      }
    } else {
      const allVals = Array.from(new Set([
        ...baseCosts.map(c => c[3]),
        ...baseCosts.map(c => c[4])
      ])).sort((a, b) => a - b);
      const cands = allVals.slice(-5);
      for (const val of cands) {
        sets.push([val]);
        names.push(`Costs Without ${val}s`);
      }
      if (cands.length >= 2) {
        for (let i = 0; i < cands.length; i++) {
          for (let j = i + 1; j < cands.length; j++) {
            sets.push([cands[i], cands[j]]);
            names.push(`Costs Without ${cands[i]}s & ${cands[j]}s`);
          }
        }
      }
    }
    return { sets, names, focusLabels };
  }

  // Determine top 1 or 2 highest-density tiers that are physically owned
  const rankedTiers = [
    { index: 4, count: counts.gold, label: 'Gold (100d)' },
    { index: 3, count: counts.silver65, label: 'Silver 65d' },
    { index: 2, count: counts.silver45, label: 'Silver 45d' },
    { index: 1, count: counts.bronze25, label: 'Bronze 25d' }
  ].filter(t => t.count > 0);

  // Sort primarily by item count, secondarily by value tier descending
  rankedTiers.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.index - a.index;
  });

  // For calcType 1, focus on the single highest representation tier. For calcType 2, focus on the top 2.
  const activeFocus = calcType === 1 ? rankedTiers.slice(0, 1) : rankedTiers.slice(0, 2);
  const focusLabels = activeFocus.map(t => t.label);

  const focusValsSet = new Set<number>();
  for (const t of activeFocus) {
    const tierVals = baseCosts.map(c => c[t.index]);
    for (const val of tierVals) {
      focusValsSet.add(val);
    }
  }

  const allVals = Array.from(focusValsSet).sort((a, b) => a - b);
  // Get slice of candidate pricing adjustments
  const maxCands = calcType === 1 ? 3 : 5;
  const cands = allVals.slice(-maxCands);

  // Singles
  for (const val of cands) {
    sets.push([val]);
    names.push(`Costs Without ${val}s`);
  }
  // Doubles
  if (cands.length >= 2) {
    for (let i = 0; i < cands.length; i++) {
      for (let j = i + 1; j < cands.length; j++) {
        sets.push([cands[i], cands[j]]);
        names.push(`Costs Without ${cands[i]}s & ${cands[j]}s`);
      }
    }
  }

  return { sets, names, focusLabels };
}

// Group definitions
export const EXCLUSION_SETS = [
  [],       // All Costs
  [9],      // Costs Without 9s
  [10],     // Costs Without 10s
  [8],      // Costs Without 8s
  [9, 10],  // Costs With 8s Only (leaves 7, 8 in first costs list)
  [8, 9],   // Costs With 10s Only (leaves 7, 10)
  [8, 10]   // Costs With 9s Only (leaves 7, 9)
];

export const EXCLUSION_SETS_NAMES = [
  'All Costs',
  'Costs Without 9s',
  'Costs Without 10s',
  'Costs Without 8s',
  'Costs With 8s Only',
  'Costs With 10s Only',
  'Costs With 9s Only'
];

export const EXCLUSION_SETS_2 = [
  [],
  [5], [6], [7], [9], [10], [8],
  [5, 6], [5, 7], [5, 8], [5, 9], [5, 10],
  [6, 7], [6, 8], [6, 9], [6, 10],
  [7, 8], [7, 9], [7, 10],
  [9, 10], [8, 9], [8, 10]
];

export const EXCLUSION_SETS_2_NAMES = [
  'All Costs',
  'Costs Without 5s',
  'Costs Without 6s',
  'Costs Without 7s',
  'Costs Without 9s',
  'Costs Without 10s',
  'Costs Without 8s',
  'Costs Without 5s, 6s',
  'Costs Without 5s, 7s',
  'Costs Without 5s, 8s',
  'Costs Without 5s, 9s',
  'Costs Without 5s, 10s',
  'Costs Without 6s, 7s',
  'Costs Without 6s, 8s',
  'Costs Without 6s, 9s',
  'Costs Without 6s, 10s',
  'Costs Without 7s, 8s',
  'Costs Without 7s, 9s',
  'Costs Without 7s, 10s',
  'Costs Without 9s, 10s',
  'Costs Without 8s, 9s',
  'Costs Without 8s, 10s'
];

export function calculateProfit(counts: InventoryCount, cost: CostTuple): number {
  return (
    counts.bronze15 * cost[0] +
    counts.bronze25 * cost[1] +
    counts.silver45 * cost[2] +
    counts.silver65 * cost[3] +
    counts.gold * cost[4]
  );
}

export function getMultimode(arr: number[]): number[] {
  const counts: Record<number, number> = {};
  let maxCount = 0;
  for (const val of arr) {
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
    }
  }
  const modes: number[] = [];
  for (const keyStr in counts) {
    const key = parseFloat(keyStr);
    if (counts[key] === maxCount) {
      modes.push(key);
    }
  }
  return modes.sort((a, b) => a - b);
}

export function getMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  } else {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
}

export function getProfitStats(counts: InventoryCount, costsList: CostTuple[]): ProfitStats {
  const profits = costsList.map(c => calculateProfit(counts, c));
  const totalCount = counts.bronze15 + counts.bronze25 + counts.silver45 + counts.silver65 + counts.gold;
  const totalDucats = counts.bronze15 * 15 + counts.bronze25 * 25 + counts.silver45 * 45 + counts.silver65 * 65 + counts.gold * 100;
  
  let tradesRequired = Math.ceil(totalCount / 6);
  if (isNaN(tradesRequired)) tradesRequired = 0;

  if (profits.length === 0) {
    return {
      average: 0, median: 0, min: 0, max: 0, stdDev: 0, midRange: 0, rangeValue: 0,
      modes: [], modeAverage: 0, totalCount, tradesRequired, totalDucats, onePlatPerDucatRatio: 0
    };
  }

  const sum = profits.reduce((a, b) => a + b, 0);
  const average = Number((sum / profits.length).toFixed(2));
  const min = Math.min(...profits);
  const max = Math.max(...profits);
  const median = getMedian(profits);
  const midRange = Number(((min + max) / 2).toFixed(2));
  const rangeValue = max - min;
  
  const modes = getMultimode(profits);
  const modeSum = modes.reduce((a, b) => a + b, 0);
  const modeAverage = modes.length > 0 ? Number((modeSum / modes.length).toFixed(2)) : 0;

  // Std dev
  const sqDiffSum = profits.reduce((a, b) => a + Math.pow(b - average, 2), 0);
  const stdDev = Number(Math.sqrt(sqDiffSum / profits.length).toFixed(2));

  const onePlatPerDucatRatio = average > 0 ? Number((totalDucats / average).toFixed(2)) : 0;

  return {
    average,
    median,
    min,
    max,
    stdDev,
    midRange,
    rangeValue,
    modes,
    modeAverage,
    totalCount,
    tradesRequired,
    totalDucats,
    onePlatPerDucatRatio
  };
}

// Incomplete beta function approximation for ANOVA p-value
function logGamma(x: number): number {
  const coef = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ];
  let sum = 1.000000000190015;
  let xx = x;
  let tmp = xx + 5.5;
  tmp -= (xx + 0.5) * Math.log(tmp);
  for (let j = 0; j <= 5; j++) {
    sum += coef[j] / ++xx;
  }
  return -tmp + Math.log(2.5066282746310005 * sum / x);
}

function betaCF(a: number, b: number, x: number): number {
  const maxIterations = 200;
  const epsilon = 3.0e-7;
  const qab = a + b;
  const qap = a + 1.0;
  const qam = a - 1.0;
  let c = 1.0;
  let d = 1.0 - qab * x / qap;
  if (Math.abs(d) < epsilon) d = epsilon;
  d = 1.0 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1.0 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1.0 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1.0 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1.0 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < epsilon) {
      break;
    }
  }
  return h;
}

export function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x < 0.0 || x > 1.0) return NaN;
  if (x === 0.0) return 0.0;
  if (x === 1.0) return 1.0;

  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1.0 - x));
  if (x < (a + 1.0) / (a + b + 2.0)) {
    return bt * betaCF(a, b, x) / a;
  } else {
    return 1.0 - bt * betaCF(b, a, 1.0 - x) / b;
  }
}

// Compute standard F-distribution p-value
export function fDistributionPValue(f: number, df1: number, df2: number): number {
  if (isNaN(f) || f <= 0 || df1 <= 0 || df2 <= 0) return 1.0;
  const x = (df1 * f) / (df1 * f + df2);
  const p = 1.0 - regularizedIncompleteBeta(df1 / 2, df2 / 2, x);
  return isNaN(p) ? 1.0 : Number(p.toFixed(8));
}

// Run full One-way ANOVA and Tukey statistical summary
export function runAnova(counts: InventoryCount, calcType: 1 | 2, baseCosts: CostTuple[]): {
  anova: AnovaStats;
  groups: GroupSummary[];
  tukey: TukeyPair[];
  focusLabels: string[];
} {
  const { sets, names, focusLabels } = getDynamicExclusions(baseCosts, calcType, counts);
  
  // Create all profit groups
  const groups: GroupSummary[] = sets.map((excl, i) => {
    const filtered = filterCosts(baseCosts, excl);
    const values = filtered.map(c => calculateProfit(counts, c));
    const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const median = getMedian(values);
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    return {
      name: names[i],
      count: values.length,
      min,
      max,
      median,
      mean: Number(mean.toFixed(4)),
      values
    };
  });

  // Calculate ANOVA statistics
  // total number of items
  const N = groups.reduce((acc, g) => acc + g.count, 0);
  const k = groups.length;
  
  const grandeurSum = groups.reduce((acc, g) => acc + g.values.reduce((sum, v) => sum + v, 0), 0);
  const grandMean = N > 0 ? grandeurSum / N : 0;

  // SSB: Sum of Squares Between
  let ssb = 0;
  for (const g of groups) {
    ssb += g.count * Math.pow(g.mean - grandMean, 2);
  }

  // SSW: Sum of Squares Within
  let ssw = 0;
  for (const g of groups) {
    for (const v of g.values) {
      ssw += Math.pow(v - g.mean, 2);
    }
  }

  const sst = ssb + ssw;
  const dfb = k - 1;
  const dfw = N - k;
  const dft = N - 1;
  
  const msb = dfb > 0 ? ssb / dfb : 0;
  const msw = dfw > 0 ? ssw / dfw : 0;
  const fStat = msw > 0 ? msb / msw : 0;

  const pValue = fDistributionPValue(fStat, dfb, dfw);

  const anova: AnovaStats = {
    ssb: Number(ssb.toFixed(4)),
    ssw: Number(ssw.toFixed(4)),
    sst: Number(sst.toFixed(4)),
    dfb,
    dfw,
    dft,
    msb: Number(msb.toFixed(4)),
    msw: Number(msw.toFixed(4)),
    fStat: Number(fStat.toFixed(4)),
    pValue
  };

  // Tukey pairwise comparisons
  const tukey: TukeyPair[] = [];
  const alpha = 0.05;
  // Critical studentized range q-value approx for k groups and df_within degrees of freedom
  // standard critical q for k=7 or 22 at p=0.05. Let's interpolate or use a robust approximate function
  // We can approximate critical Q-value based on standard tables
  const criticalQ = calcType === 1 ? 4.17 : 5.15; // standard studentized range q critical value for k=7 df=500 and k=22 df=2000

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const g1 = groups[i];
      const g2 = groups[j];
      const meanDiff = Number((g1.mean - g2.mean).toFixed(4));
      
      // Standard Error for pairwise differences
      const se = Math.sqrt((anova.msw / 2) * (1 / g1.count + 1 / g2.count));
      const qStat = se > 0 ? (g1.mean - g2.mean) / se : 0;

      // Approximate 95% Confidence Interval
      const marginOfError = criticalQ * se;
      const lowerCI = Number((meanDiff - marginOfError).toFixed(4));
      const upperCI = Number((meanDiff + marginOfError).toFixed(4));
      
      // Reject Null hypothesis if q_stat exceeds critical Q
      const reject = Math.abs(qStat) > criticalQ;
      
      // Approximate pairwise p-value from qStat
      // Simple logistic approximation of normal for q relative to critical
      const pApprox = 1 / (1 + Math.exp(1.7 * (Math.abs(qStat) - criticalQ)));
      const pValue = Math.min(1.0, Math.max(0.0, Number((pApprox * alpha).toFixed(6))));

      tukey.push({
        group1: g1.name,
        group2: g2.name,
        meanDiff,
        qStat: Number(qStat.toFixed(4)),
        lowerCI,
        upperCI,
        pValue,
        reject
      });
    }
  }

  return {
    anova,
    groups,
    tukey,
    focusLabels
  };
}
