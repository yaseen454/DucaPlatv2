/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { InventoryCount, CostRecord, CostTuple } from '../types';
import { getProfitStats, runAnova, calculateProfit } from '../utils/mathUtils';
import { Sparkles, BarChart, Table, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, Check, X, TrendingUp, Copy } from 'lucide-react';
import platinumIcon from '../data/platinum.png';
import ducatIcon from '../data/480px-OrokinDucats.png';

function PlatValue({ val, size = "w-3 h-3", className = "" }: { val: string | number; size?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono ${className}`}>
      <span>{val}</span>
      <img 
        src={platinumIcon} 
        className={`${size} object-contain inline-block ml-0.5`} 
        alt="Pt" 
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

function DucatValue({ val, size = "w-3 h-3", className = "" }: { val: string | number; size?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono ${className}`}>
      <span>{val}</span>
      <img 
        src={ducatIcon} 
        className={`${size} object-contain inline-block ml-0.5`} 
        alt="Ducats" 
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

interface AnalysisResultsProps {
  counts: InventoryCount;
  calcType: 1 | 2;
  baseCosts: CostTuple[];
  enablePlot?: boolean;
  displayAnova?: boolean;
  showDecision?: boolean;
}

export default function AnalysisResults({ 
  counts, 
  calcType, 
  baseCosts,
  enablePlot = true,
  displayAnova = true,
  showDecision = true
}: AnalysisResultsProps) {
  const [showAllRates, setShowAllRates] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [hoveredMetric, setHoveredMetric] = useState<{
    name: string;
    value: number;
    desc: string;
    x: number;
    color: string;
  } | null>(null);
  const [hoveredPerm, setHoveredPerm] = useState<any | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const handleCopyTradeChat = (type: string, prices: number[]) => {
    const chatText = `WTS Prime Junk 15 :ducats: = ${prices[0]} :platinum: , ` +
      `25 :ducats: = ${prices[1]} :platinum: , ` +
      `45 :ducats: = ${prices[2]} :platinum: , ` +
      `65 :ducats: = ${prices[3]} :platinum: , ` +
      `100 :ducats: = ${prices[4]} :platinum:`;
    navigator.clipboard.writeText(chatText).then(() => {
      setCopiedType(type);
      setTimeout(() => {
        setCopiedType(null);
      }, 2000);
    }).catch((err) => {
      console.error("Failed to copy trade chat text:", err);
    });
  };

  // Compute base statistical reports
  const stats = useMemo(() => {
    return getProfitStats(counts, baseCosts);
  }, [counts, baseCosts]);

  // Run full ANOVA + Tukey
  const statSuite = useMemo(() => {
    return runAnova(counts, calcType, baseCosts);
  }, [counts, calcType, baseCosts]);

  // Sort cost records for individual combinations list
  const costRecords: CostRecord[] = useMemo(() => {
    return baseCosts.map((cost, i) => {
      const profit = calculateProfit(counts, cost);
      return {
        key: `Price Pattern ${i + 1}`,
        profit,
        prices: cost,
        category: 'Below Average'
      };
    }).sort((a, b) => b.profit - a.profit);
  }, [counts, baseCosts]);

  // Assign percentile-based category ratings to represent Zones dynamically
  const adjustedRecords = useMemo(() => {
    const list = [...costRecords];
    const N = list.length;
    if (N === 0) return list;

    return list.map((record, index) => {
      let category: CostRecord['category'] = 'Below Average';
      
      // Since list is sorted descending by profit:
      // index 0 has the highest profit, index N-1 has the lowest profit.
      const pct = (index / N) * 100;
      
      if (pct < 30) {
        // Top 30% yield outcomes
        category = 'Above Average';
      } else if (pct >= 75) {
        // Bottom 25% yield outcomes
        category = 'Below Expectation';
      } else {
        // Middle outcomes representing nominal value
        category = 'Below Average';
      }

      return {
        ...record,
        category
      };
    });
  }, [costRecords]);

  // Compute boundaries for pricing tiers to estimate trade realism relative to inventory density
  const dynamicRanges = useMemo(() => {
    if (baseCosts.length === 0) return [];
    return Array.from({ length: 5 }, (_, i) => {
      const vals = baseCosts.map(c => c[i]);
      return {
        min: Math.min(...vals),
        max: Math.max(...vals)
      };
    });
  }, [baseCosts]);

  // Strategic recommendations calculated via density & pricing ranges
  const recommendations = useMemo(() => {
    if (adjustedRecords.length === 0 || dynamicRanges.length === 0) return null;

    const totalCount = stats.totalCount || 1;
    const densities = [
      { key: 'bronze15', label: 'Bronze 15d', count: counts.bronze15, weight: 15, index: 0 },
      { key: 'bronze25', label: 'Bronze 25d', count: counts.bronze25, weight: 25, index: 1 },
      { key: 'silver45', label: 'Silver 45d', count: counts.silver45, weight: 45, index: 2 },
      { key: 'silver65', label: 'Silver 65d', count: counts.silver65, weight: 65, index: 3 },
      { key: 'gold',     label: 'Gold 100d',   count: counts.gold,     weight: 100, index: 4 }
    ];

    const validDensities = densities
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);

    // Compute metrics for all vectors
    const scoredVectors = adjustedRecords.map((record) => {
      const prices = record.prices;
      
      // Calculate realism score (percentage)
      let weightedRealismSum = 0;
      let dividingSum = 0;
      
      const countsArray = [
        counts.bronze15,
        counts.bronze25,
        counts.silver45,
        counts.silver65,
        counts.gold
      ];

      for (let i = 0; i < 5; i++) {
        const count = countsArray[i];
        if (count > 0) {
          const r = dynamicRanges[i];
          const span = r.max - r.min;
          // If pricing is single-valued (min === max), ease of selling is 100%
          const easeOfSelling = span === 0 ? 1 : (r.max - prices[i]) / span;
          weightedRealismSum += count * easeOfSelling;
          dividingSum += count;
        }
      }

      const realismPercentage = dividingSum === 0 ? 100 : Math.round((weightedRealismSum / dividingSum) * 100);

      return {
        ...record,
        realism: realismPercentage
      };
    });

    // Strategy 1: The Patient Max Profit Strategy (Optimistic Maximum)
    const maxProfitVector = scoredVectors[0];

    // Strategy 2: High trade liquidity / Realism-Value sweet spot (Optimistic balanced representation)
    // Filter vectors that have realism >= 60% and sort by profit descending
    const balancedCandidates = scoredVectors.filter(v => v.realism >= 60).sort((a, b) => b.profit - a.profit);
    const balancedVector = balancedCandidates[0] || scoredVectors[Math.floor(scoredVectors.length / 2)];

    // Strategy 3: Ultra fast bulk sellout (Fast Turnover)
    // High realism/ease of selling. Realism >= 80%, highest profit in that range
    const budgetCandidates = scoredVectors.filter(v => v.realism >= 80).sort((a, b) => b.profit - a.profit);
    const rapidVector = budgetCandidates[0] || scoredVectors[scoredVectors.length - 1];

    return {
      items: [
        {
          type: 'Maximalist Strategy',
          title: 'Patient Max Profit (Optimistic Cap)',
          vector: maxProfitVector,
          icon: 'TrendingUp',
          description: 'Aim for the highest possible platinum rate on all rarity tiers. Requires high listing patience or multiple trade window negotiations.',
          badge: 'Optimistic Peak',
          badgeColor: 'bg-amber-950/40 text-amber-400 border-amber-900/30'
        },
        {
          type: 'Balanced Strategy',
          title: 'Pragmatic Turn Rate (Density Optimized)',
          vector: balancedVector,
          icon: 'Sparkles',
          description: 'Optimized pricing centered primarily around your high-density assets, maintaining nominal/lower pricing on sparse items to ensure quick sales.',
          badge: 'Sweet Spot',
          badgeColor: 'bg-blue-950/40 text-blue-400 border-blue-900/30'
        },
        {
          type: 'Liquidity Strategy',
          title: 'Ultra Fast Turnaround (Bulk Clearing)',
          vector: rapidVector,
          icon: 'BarChart',
          description: 'Extremely realistic low-friction prices. Ensures parts are cleared in seconds. Ideal if you want rapid platinum now or are low on trade windows.',
          badge: 'Maximum Velocity',
          badgeColor: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
        }
      ],
      validDensities
    };
  }, [adjustedRecords, dynamicRanges, counts, stats.totalCount]);

  // Helper to calculate Q1 and Q3 for boxplot from raw numerical array
  const calculateQuartiles = (arr: number[]) => {
    if (arr.length === 0) return { q1: 0, q3: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    
    const getMedianOfSubRange = (sub: number[]) => {
      const mid = Math.floor(sub.length / 2);
      return sub.length % 2 !== 0 ? sub[mid] : (sub[mid - 1] + sub[mid]) / 2;
    };

    const midIdx = Math.floor(sorted.length / 2);
    const lowerHalf = sorted.slice(0, midIdx);
    const upperHalf = sorted.length % 2 === 0 ? sorted.slice(midIdx) : sorted.slice(midIdx + 1);

    return {
      q1: Number(getMedianOfSubRange(lowerHalf).toFixed(2)),
      q3: Number(getMedianOfSubRange(upperHalf).toFixed(2))
    };
  };

  // Pre-calculate visual coordinates for our SVG Box plot based on All Costs values
  const activeDataset = statSuite.groups[0].values;
  const limits = useMemo(() => {
    const minVal = Math.min(...activeDataset);
    const maxVal = Math.max(...activeDataset);
    const margin = (maxVal - minVal) * 0.1 || 5;
    return {
      minLimit: Math.max(0, minVal - margin),
      maxLimit: maxVal + margin
    };
  }, [activeDataset]);

  const boxPlotCoords = useMemo(() => {
    if (activeDataset.length === 0) return null;
    const minVal = Math.min(...activeDataset);
    const maxVal = Math.max(...activeDataset);
    const meanVal = stats.average;
    const medianVal = stats.median;
    const { q1, q3 } = calculateQuartiles(activeDataset);

    // function to map value to 0-100% SVG coordinates
    const scale = (val: number) => {
      const range = limits.maxLimit - limits.minLimit;
      if (range === 0) return 50;
      return ((val - limits.minLimit) / range) * 100;
    };

    return {
      minX: scale(minVal),
      maxX: scale(maxVal),
      q1X: scale(q1),
      q3X: scale(q3),
      medianX: scale(medianVal),
      meanX: scale(meanVal),
      q1,
      q3,
      minVal,
      maxVal,
      meanVal,
      medianVal
    };
  }, [activeDataset, stats, limits]);

  const lineChartCoords = useMemo(() => {
    if (adjustedRecords.length === 0) return null;
    const N = adjustedRecords.length;
    const profits = adjustedRecords.map(r => r.profit);
    const minProfit = Math.min(...profits);
    const maxProfit = Math.max(...profits);
    const profitRange = maxProfit - minProfit || 10;
    
    const yBoundMin = Math.max(0, minProfit - profitRange * 0.1);
    const yBoundMax = maxProfit + profitRange * 0.1;
    
    const width = 650;
    const height = 180;
    const paddingLeft = 55;
    const paddingRight = 30;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    
    const mapX = (idx: number) => paddingLeft + (idx / (N - 1)) * plotWidth;
    const mapY = (val: number) => paddingTop + plotHeight - ((val - yBoundMin) / (yBoundMax - yBoundMin)) * plotHeight;
    
    const points = adjustedRecords.map((r, idx) => ({
      x: mapX(idx),
      y: mapY(r.profit),
      record: r,
      index: idx
    }));
    
    let pathD = '';
    points.forEach((p, idx) => {
      if (idx === 0) {
        pathD += `M ${p.x} ${p.y}`;
      } else {
        pathD += ` L ${p.x} ${p.y}`;
      }
    });

    const fillD = `${pathD} L ${mapX(N - 1)} ${paddingTop + plotHeight} L ${mapX(0)} ${paddingTop + plotHeight} Z`;

    const gridCount = 4;
    const yGrids = Array.from({ length: gridCount + 1 }, (_, i) => {
      const val = yBoundMin + (i * (yBoundMax - yBoundMin)) / gridCount;
      return {
        val: Math.round(val),
        y: mapY(val)
      };
    });

    const meanY = mapY(stats.average);

    return {
      width,
      height,
      points,
      pathD,
      fillD,
      yGrids,
      meanY,
      yBoundMin,
      yBoundMax,
      plotWidth,
      plotHeight,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      mapX,
      mapY
    };
  }, [adjustedRecords, stats.average]);

  return (
    <div className="space-y-6">
      
      {/* 1. Dashboard summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-1 shadow-md">
          <div className="text-[10px] font-bold text-[#8e9299] uppercase tracking-wider">Total Items</div>
          <div className="text-xl font-bold text-[#e0e1e6]">{stats.totalCount}</div>
        </div>
        <div className="p-4 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-1 shadow-md">
          <div className="text-[10px] font-bold text-[#8e9299] uppercase tracking-wider">Trades Needed</div>
          <div className="text-xl font-bold text-[#e0e1e6]">{stats.tradesRequired}</div>
        </div>
        <div className="p-4 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-1 shadow-md">
          <div className="text-[10px] font-bold text-[#8e9299] uppercase tracking-wider">Ducat Pool</div>
          <div className="text-xl font-bold text-[#d4af37] flex items-center gap-1">
            <DucatValue val={stats.totalDucats} size="w-4.5 h-4.5" className="text-[#d4af37]" />
          </div>
        </div>
        <div className="p-4 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-1 shadow-md">
          <div className="text-[10px] font-bold text-[#8e9299] uppercase tracking-wider">Expected Plat</div>
          <div className="text-xl font-bold text-[#d4af37] flex items-center gap-1">
            <PlatValue val={`~${stats.average}`} size="w-4 h-4" className="text-[#d4af37]" />
          </div>
        </div>
        <div className="p-4 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-1 shadow-md">
          <div className="text-[10px] font-bold text-[#8e9299] uppercase tracking-wider">Std Deviation</div>
          <div className="text-xl font-bold text-[#c4c5cc] flex items-center gap-1">
            <PlatValue val={`±${stats.stdDev}`} size="w-3.5 h-3.5" className="text-[#c4c5cc]" />
          </div>
        </div>
        <div className="p-4 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-1 shadow-md">
          <div className="text-[10px] font-bold text-[#8e9299] uppercase tracking-wider">Ducats per Plat</div>
          <div className="text-xl font-bold text-[#c4c5cc] flex items-center gap-1">
            <DucatValue val={stats.onePlatPerDucatRatio} size="w-3.5 h-3.5" className="text-zinc-300" /> <span className="text-xs text-zinc-500 font-normal">/ Pt</span>
          </div>
        </div>
      </div>

      {/* 2. Graphical Box Plot Visualization */}
      {enablePlot && (
        <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
              <BarChart className="w-5 h-5 text-[#d4af37]" />
              Interactive Platinum Yield Distribution Plot
            </h3>
            <p className="text-xs text-[#8e9299] max-w-2xl mt-1">
              Provides deep insight into income predictability. Hover over different segments of the box plot below to inspect statistical quartiles, medians, averages, and scenario counts.
            </p>
          </div>
          <span className="text-[10px] bg-slate-850 text-[#8e9299] border border-[#2a2c33] px-2 py-1 rounded font-mono">
            N = 32 Matrices
          </span>
        </div>

        {boxPlotCoords && (() => {
          const gridSteps = [];
          if (activeDataset.length > 0) {
            const minVal = limits.minLimit;
            const maxVal = limits.maxLimit;
            const step = (maxVal - minVal) / 5;
            for (let i = 0; i <= 5; i++) {
              const val = minVal + step * i;
              gridSteps.push({
                val: Math.round(val),
                x: ((val - minVal) / (maxVal - minVal)) * 100
              });
            }
          }

          const metrics = [
            { name: 'Minimum Scenario (Lowest Yield)', value: boxPlotCoords.minVal, x: boxPlotCoords.minX, desc: 'The absolute lowest expected yield from the pricing matrices. Occurs under extremely conservative settings.', color: '#cd7f32' },
            { name: 'First Quartile (Q1)', value: boxPlotCoords.q1, x: boxPlotCoords.q1X, desc: '25% of all potential pricing configurations result in a yield at or below this level.', color: '#3182ce' },
            { name: 'Median (Q2 Midpoint)', value: boxPlotCoords.medianVal, x: boxPlotCoords.medianX, desc: 'The exact center of potential earnings. 50% of scenarios are higher, and 50% are lower.', color: '#d4af37' },
            { name: 'Mathematical Mean (Average)', value: Number(boxPlotCoords.meanVal.toFixed(2)), x: boxPlotCoords.meanX, desc: 'The weight-center of all expected outcomes. Often represents the most probable outcome over many trades.', color: '#ffffff' },
            { name: 'Third Quartile (Q3)', value: boxPlotCoords.q3, x: boxPlotCoords.q3X, desc: '75% of potential pricing configurations result in a yield at or below this level.', color: '#3182ce' },
            { name: 'Maximum Scenario (Peak Profit)', value: boxPlotCoords.maxVal, x: boxPlotCoords.maxX, desc: 'The absolute highest expected yield from the pricing matrices. Achievable under aggressive seller markets.', color: '#a855f7' },
          ];

          const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100; // 0 to 100%
            
            let closest = metrics[0];
            let minDiff = Math.abs(x - metrics[0].x);
            for (let i = 1; i < metrics.length; i++) {
              const diff = Math.abs(x - metrics[i].x);
              if (diff < minDiff) {
                minDiff = diff;
                closest = metrics[i];
              }
            }
            setHoveredMetric(closest);
          };

          const handleTouchInteract = (clientX: number, target: HTMLDivElement) => {
            const rect = target.getBoundingClientRect();
            const x = ((clientX - rect.left) / rect.width) * 100; // 0 to 100%
            let closest = metrics[0];
            let minDiff = Math.abs(x - metrics[0].x);
            for (let i = 1; i < metrics.length; i++) {
              const diff = Math.abs(x - metrics[i].x);
              if (diff < minDiff) {
                minDiff = diff;
                closest = metrics[i];
              }
            }
            setHoveredMetric(closest);
          };

          return (
            <div className="space-y-4">
              {/* Active Highlight Status Bar */}
              <div className="min-h-[64px] flex items-center justify-between px-4 py-3 bg-[#0c0d10] border border-[#2a2c33]/70 rounded-xl transition duration-200">
                {hoveredMetric ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 w-full animate-fade-in">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#8e9299] uppercase tracking-wider font-mono">Statistical Milestone</span>
                      <span className="text-xs font-bold text-white flex items-center gap-2 mt-0.5">
                        <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: hoveredMetric.color }}></span>
                        {hoveredMetric.name}
                      </span>
                    </div>
                    <div className="hidden sm:block h-8 w-px bg-[#2a2c33]"></div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-[#8e9299] uppercase tracking-wider font-mono">Scenario Value</span>
                      <span className="text-sm font-bold text-[#d4af37] font-mono mt-0.5 flex items-center">
                        <PlatValue val={hoveredMetric.value} size="w-3.5 h-3.5" className="text-[#d4af37]" />
                      </span>
                    </div>
                    <div className="hidden md:block h-8 w-px bg-[#2a2c33]"></div>
                    <div className="hidden md:flex flex-col flex-1">
                      <span className="text-[9px] text-[#8e9299] uppercase tracking-wider font-mono">Statistical Definition & Significance</span>
                      <span className="text-xs text-[#c4c5cc] mt-0.5 leading-relaxed">{hoveredMetric.desc}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full text-xs text-[#8e9299]/85 font-sans gap-2.5 py-2">
                    <span className="w-1.5 h-1.5 bg-[#d4af37] rounded-full animate-ping"></span>
                    <span>Move cursor across the chart or tick zones below to inspect milestones & value boundaries!</span>
                  </div>
                )}
              </div>

              {/* Main SVG Plot Track Area */}
              <div 
                className="relative h-24 bg-[#07080a] rounded-xl border border-[#2a2c33] p-4 cursor-crosshair select-none overflow-hidden group/track"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredMetric(null)}
                onTouchStart={(e) => {
                  if (e.touches.length > 0) {
                    handleTouchInteract(e.touches[0].clientX, e.currentTarget);
                  }
                }}
                onTouchMove={(e) => {
                  if (e.touches.length > 0) {
                    handleTouchInteract(e.touches[0].clientX, e.currentTarget);
                  }
                }}
              >
                {/* Visual guidelines when hovering anywhere on coordinates */}
                <div className="absolute inset-0 pointer-events-none opacity-20 bg-radial-gradient from-transparent to-[#07080a]" />

                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                  
                  {/* Background Grid Ticks */}
                  {gridSteps.map((step, idx) => (
                    <line
                      key={idx}
                      x1={step.x}
                      y1="0"
                      x2={step.x}
                      y2="40"
                      stroke="#1a1c22"
                      strokeWidth="0.4"
                    />
                  ))}

                  {/* Horizontal range whiskers line */}
                  <line 
                    x1={boxPlotCoords.minX} 
                    y1="20" 
                    x2={boxPlotCoords.maxX} 
                    y2="20" 
                    stroke="#475569" 
                    strokeWidth="0.8" 
                    className="opacity-80"
                  />

                  {/* Interquartile Range Box (Q1 to Q3) */}
                  <rect 
                    x={boxPlotCoords.q1X} 
                    y="8" 
                    width={boxPlotCoords.q3X - boxPlotCoords.q1X} 
                    height="24" 
                    fill="#d4af37" 
                    fillOpacity="0.08" 
                    stroke="#d4af37" 
                    strokeWidth="0.85"
                    className="transition-all duration-300 group-hover/track:fill-opacity-15"
                  />

                  {/* Left whisker cap (Min) */}
                  <line 
                    x1={boxPlotCoords.minX} 
                    y1="12" 
                    x2={boxPlotCoords.minX} 
                    y2="28" 
                    stroke="#cd7f32" 
                    strokeWidth="1.5"
                  />

                  {/* Right whisker cap (Max) */}
                  <line 
                    x1={boxPlotCoords.maxX} 
                    y1="12" 
                    x2={boxPlotCoords.maxX} 
                    y2="28" 
                    stroke="#cd7f32" 
                    strokeWidth="1.5"
                  />

                  {/* Median Line (Q2) */}
                  <line 
                    x1={boxPlotCoords.medianX} 
                    y1="8" 
                    x2={boxPlotCoords.medianX} 
                    y2="32" 
                    stroke="#d4af37" 
                    strokeWidth="2"
                  />

                  {/* Mean Diamond Indicator */}
                  <polygon 
                    points={`${boxPlotCoords.meanX},17.5 ${boxPlotCoords.meanX + 1},20 ${boxPlotCoords.meanX},22.5 ${boxPlotCoords.meanX - 1,20}`}
                    fill="#ffffff" 
                    stroke="#14161c" 
                    strokeWidth="0.4"
                  />

                  {/* Active Interactive Hover Guide Line */}
                  {hoveredMetric && (
                    <g>
                      <line 
                        x1={hoveredMetric.x} 
                        y1="0" 
                        x2={hoveredMetric.x} 
                        y2="40" 
                        stroke={hoveredMetric.color} 
                        strokeWidth="0.75" 
                        strokeDasharray="1.5,1.5"
                      />
                      <circle 
                        cx={hoveredMetric.x} 
                        cy="20" 
                        r="3" 
                        fill={hoveredMetric.color} 
                        stroke="#07080a" 
                        strokeWidth="1"
                      />
                    </g>
                  )}
                </svg>
              </div>

              {/* Precise Horizontal Axis Ruler */}
              <div className="relative h-7 font-mono text-[10px] text-[#8e9299] border-t border-[#2a2c33]/40 pt-1.5 select-none">
                {gridSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${step.x}%` }}
                  >
                    <span className="w-px h-1.5 bg-[#2a2c33] mb-1"></span>
                    <span className="text-zinc-400 font-bold flex items-center gap-0.5"><PlatValue val={step.val} size="w-2.5 h-2.5" /></span>
                  </div>
                ))}
              </div>

              {/* Mobile Swipe Cursor Slider */}
              <div className="bg-[#0c0d10] border border-[#2a2c33]/60 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 select-none font-sans">
                    <span>📱 Swipe Cursor Slider</span>
                    <span className="text-[8px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 px-1 py-0.5 rounded font-sans font-bold hidden sm:inline-block col-span-1">Recommended for Mobile</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#d4af37] font-semibold text-right max-w-[200px] truncate select-none">
                    {hoveredMetric ? hoveredMetric.name.split(' (')[0] : "Adjust Slider"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={hoveredMetric ? hoveredMetric.x : 50}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    let closest = metrics[0];
                    let minDiff = Math.abs(val - metrics[0].x);
                    for (let i = 1; i < metrics.length; i++) {
                      const diff = Math.abs(val - metrics[i].x);
                      if (diff < minDiff) {
                        minDiff = diff;
                        closest = metrics[i];
                      }
                    }
                    setHoveredMetric(closest);
                  }}
                  className="w-full h-1.5 bg-[#14161c] rounded-lg appearance-none cursor-pointer accent-[#d4af37] border border-[#2a2c33]/50 focus:outline-none"
                />
              </div>

              {/* Descriptive Legend Indicators */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
                <div key="legend-min" className="bg-[#0c0d10]/50 border border-[#2a2c33]/50 p-2.5 rounded-lg flex flex-col cursor-pointer hover:border-[#cd7f32]/40 transition" onClick={() => setHoveredMetric({ name: 'Minimum Scenario (Lowest Yield)', value: boxPlotCoords.minVal, x: boxPlotCoords.minX, desc: 'The absolute lowest expected yield from the pricing matrices. Occurs under extremely conservative settings.', color: '#cd7f32' })}>
                  <span className="text-[10px] text-[#8e9299]">Minimum</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 font-mono flex items-center gap-0.5"><PlatValue val={boxPlotCoords.minVal} size="w-3 h-3" className="text-slate-200" /></span>
                </div>
                <div key="legend-q1" className="bg-[#0c0d10]/50 border border-[#2a2c33]/50 p-2.5 rounded-lg flex flex-col cursor-pointer hover:border-[#3182ce]/40 transition" onClick={() => setHoveredMetric({ name: 'First Quartile (Q1)', value: boxPlotCoords.q1, x: boxPlotCoords.q1X, desc: '25% of all potential pricing configurations result in a yield at or below this level.', color: '#3182ce' })}>
                  <span className="text-[10px] text-[#8e9299]">Quartile 1 (Q1)</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 font-mono flex items-center gap-0.5"><PlatValue val={boxPlotCoords.q1} size="w-3 h-3" className="text-slate-200" /></span>
                </div>
                <div key="legend-med" className="bg-[#d4af37]/5 border border-[#d4af37]/20 p-2.5 rounded-lg flex flex-col cursor-pointer hover:border-[#d4af37]/50 transition" onClick={() => setHoveredMetric({ name: 'Median (Q2 Midpoint)', value: boxPlotCoords.medianVal, x: boxPlotCoords.medianX, desc: 'The exact center of potential earnings. 50% of scenarios are higher, and 50% are lower.', color: '#d4af37' })}>
                  <span className="text-[10px] text-[#d4af37]">Median</span>
                  <span className="text-xs font-bold text-[#d4af37] mt-0.5 font-mono flex items-center gap-0.5"><PlatValue val={boxPlotCoords.medianVal} size="w-3 h-3" className="text-[#d4af37]" /></span>
                </div>
                <div key="legend-mean" className="bg-white/5 border border-white/10 p-2.5 rounded-lg flex flex-col cursor-pointer hover:border-white/30 transition" onClick={() => setHoveredMetric({ name: 'Mathematical Mean (Average)', value: Number(boxPlotCoords.meanVal.toFixed(2)), x: boxPlotCoords.meanX, desc: 'The weight-center of all expected outcomes. Often represents the most probable outcome over many trades.', color: '#ffffff' })}>
                  <span className="text-[10px] text-white">Mean Average</span>
                  <span className="text-xs font-bold text-white mt-0.5 font-mono flex items-center gap-0.5"><PlatValue val={boxPlotCoords.meanVal.toFixed(1)} size="w-3 h-3" className="text-white" /></span>
                </div>
                <div key="legend-q3" className="bg-[#0c0d10]/50 border border-[#2a2c33]/50 p-2.5 rounded-lg flex flex-col cursor-pointer hover:border-[#3182ce]/40 transition" onClick={() => setHoveredMetric({ name: 'Third Quartile (Q3)', value: boxPlotCoords.q3, x: boxPlotCoords.q3X, desc: '75% of potential pricing configurations result in a yield at or below this level.', color: '#3182ce' })}>
                  <span className="text-[10px] text-[#8e9299]">Quartile 3 (Q3)</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 font-mono flex items-center gap-0.5"><PlatValue val={boxPlotCoords.q3} size="w-3 h-3" className="text-slate-200" /></span>
                </div>
                <div key="legend-max" className="bg-[#0c0d10]/50 border border-[#2a2c33]/50 p-2.5 rounded-lg flex flex-col cursor-pointer hover:border-[#a855f7]/40 transition" onClick={() => setHoveredMetric({ name: 'Maximum Scenario (Peak Profit)', value: boxPlotCoords.maxVal, x: boxPlotCoords.maxX, desc: 'The absolute highest expected yield from the pricing matrices. Achievable under aggressive seller markets.', color: '#a855f7' })}>
                  <span className="text-[10px] text-[#8e9299]">Maximum</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 font-mono flex items-center gap-0.5"><PlatValue val={boxPlotCoords.maxVal} size="w-3 h-3" className="text-slate-200" /></span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      )}

      {/* Strategic Recommendation Decision Advisor powered by ANOVA & Density of Items */}
      {showDecision && recommendations && recommendations.items && (
        <div className="bg-[#14161c] border border-[#d4af37]/30 rounded-xl p-6 shadow-xl space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2a2c33]/60 pb-3">
            <div>
              <h3 className="text-base font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
                <Sparkles className="w-5 h-5 text-[#d4af37]" />
                ANOVA & Density-Powered Decisions Advisor
              </h3>
              <p className="text-xs text-[#8e9299] max-w-2xl mt-1">
                Utilizes item density correlations combined with ANOVA variance to suggest the top 3 optimal seller strategies tailored to your exact inventory weight.
              </p>
            </div>
            {recommendations.validDensities.length > 0 && (
              <span className="text-[10px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-2 py-1 rounded font-mono uppercase">
                Primacy: {recommendations.validDensities[0].label}
              </span>
            )}
          </div>

          {/* 1. Inventory Density Stacked Visual Representation */}
          <div className="space-y-2 bg-[#0c0d10] border border-[#2a2c33]/50 p-4 rounded-xl">
            <div className="flex justify-between items-center text-[10px] font-mono text-[#8e9299] select-none uppercase">
              <span>Inventory Density Ratio Bar</span>
              <span className="font-semibold text-zinc-300">Total Represented: {stats.totalCount} Parts</span>
            </div>
            <div className="h-3 w-full bg-[#14161c] rounded-full overflow-hidden flex border border-[#1a1c22]">
              {recommendations.validDensities.map((d) => {
                const pct = (d.count / stats.totalCount) * 100;
                const color = d.index === 0 ? 'bg-amber-800' :
                             d.index === 1 ? 'bg-amber-600' :
                             d.index === 2 ? 'bg-[#94a3b8]' :
                             d.index === 3 ? 'bg-[#cbd5e1]' :
                             'bg-[#d4af37]';
                return (
                  <div 
                    key={d.key} 
                    className={`${color} h-full transition-all`} 
                    style={{ width: `${pct}%` }}
                    title={`${d.label}: ${d.count} parts (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-zinc-400 font-mono mt-1 select-none">
              {recommendations.validDensities.map((d) => {
                const pct = (d.count / stats.totalCount) * 100;
                const dotColor = d.index === 0 ? 'bg-amber-800' :
                                 d.index === 1 ? 'bg-amber-600' :
                                 d.index === 2 ? 'bg-[#94a3b8]' :
                                 d.index === 3 ? 'bg-[#cbd5e1]' :
                                 'bg-[#d4af37]';
                return (
                  <span key={d.key} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-zinc-300">{d.label}</span>
                    <span className="text-zinc-500 font-bold">{pct.toFixed(1)}%</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* 2. ANOVA Actionable Recommendations Banner */}
          <div className={`p-4 rounded-xl border text-xs flex gap-3.5 ${
            statSuite.anova.pValue <= 0.05 
              ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300' 
              : 'bg-[#1a1515] border-[#442222]/30 text-rose-300'
          }`}>
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${statSuite.anova.pValue <= 0.05 ? 'text-emerald-400' : 'text-rose-450'}`} />
            <div className="space-y-1">
              <span className="font-semibold block text-slate-200 text-xs uppercase font-mono tracking-wider">
                {statSuite.anova.pValue <= 0.05 
                  ? 'Strategic Verdict: High Variance Leveraged' 
                  : 'Strategic Verdict: Constant Performance Horizon'}
              </span>
              <p className="leading-relaxed font-sans text-zinc-400 text-[11px]">
                {statSuite.anova.pValue <= 0.05 ? (
                  <>
                    ANOVA rejects the null hypothesis (p = {statSuite.anova.pValue}). Because you have high volume in <strong className="text-white">{statSuite.focusLabels?.join(' & ') || 'Gold rarity'}</strong> assets, minor price shifts generate statistically overwhelming variance in returns. <strong>Decision:</strong> We recommend selecting the <strong className="text-[#d4af37]">Patient Max Profit</strong> strategy. Do not settle for low offers on your gold assets.
                  </>
                ) : (
                  <>
                    ANOVA accepts the null hypothesis (p = {statSuite.anova.pValue}). Expected average margins are statistically uniform compared to overall market volatility. <strong>Decision:</strong> We recommend utilizing the <strong className="text-emerald-400">Ultra Fast Turnaround</strong> strategy to clear items instantly. Squeezing for high pricing vectors yields negligible extra return over trade waiting.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* 3. Top N (3) Strategy Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.items.map((rec) => {
              if (!rec.vector) return null;
              
              const isSelectedByAnova = 
                (statSuite.anova.pValue <= 0.05 && rec.type === 'Maximalist Strategy') ||
                (statSuite.anova.pValue > 0.05 && rec.type === 'Liquidity Strategy');

              return (
                <div 
                  key={rec.type} 
                  className={`bg-[#0c0d10] border rounded-xl p-4 flex flex-col justify-between space-y-4 transition-all duration-300 ${
                    isSelectedByAnova 
                      ? 'border-[#d4af37]/40 ring-1 ring-[#d4af37]/25 shadow-[0_0_12px_rgba(212,175,55,0.06)]' 
                      : 'border-[#2a2c33]/70 opacity-80 hover:opacity-100 hover:border-[#2a2c33]'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border font-mono uppercase tracking-wider ${rec.badgeColor}`}>
                        {rec.badge}
                      </span>
                      {isSelectedByAnova && (
                        <span className="text-[8px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">
                          🔥 RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        {rec.icon === 'TrendingUp' && <TrendingUp className="w-4 h-4 text-[#d4af37]" />}
                        {rec.icon === 'Sparkles' && <Sparkles className="w-4 h-4 text-blue-400" />}
                        {rec.icon === 'BarChart' && <BarChart className="w-4 h-4 text-emerald-400" />}
                        {rec.title}
                      </h4>
                      <p className="text-[10.5px] text-zinc-400 leading-relaxed font-sans mt-1.5">
                        {rec.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#2a2c33]/40 space-y-2.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-[10px] text-[#8e9299]">Expected Yield:</span>
                      <strong className="text-base text-white flex items-center gap-0.5 font-bold">
                        <PlatValue val={rec.vector.profit} size="w-4 h-4" className="text-white" />
                      </strong>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-[#8e9299]">Trade Realism:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1 bg-[#14161c] rounded-full overflow-hidden border border-[#2a2c33]/50">
                          <div 
                            className={`h-full ${
                              rec.vector.realism >= 80 ? 'bg-emerald-500' :
                              rec.vector.realism >= 60 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${rec.vector.realism}%` }}
                          />
                        </div>
                        <span className={`font-mono text-[10px] font-bold ${
                          rec.vector.realism >= 80 ? 'text-emerald-400' :
                          rec.vector.realism >= 60 ? 'text-blue-400' : 'text-[#d4af37]'
                        }`}>{rec.vector.realism}%</span>
                      </div>
                    </div>

                    <div className="pt-1 select-none">
                      <span className="text-[8px] text-[#8e9299] uppercase tracking-wider font-mono block mb-1">Vector Combination:</span>
                      <span className="text-[9.5px] font-mono text-zinc-300 bg-[#14161c] px-1.5 py-1 rounded border border-[#2a2c33]/60 block text-center">
                        B({rec.vector.prices[0]},{rec.vector.prices[1]}) S({rec.vector.prices[2]},{rec.vector.prices[3]}) G({rec.vector.prices[4]})
                      </span>
                    </div>

                    {/* Copy Trade Chat Template Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyTradeChat(rec.type, rec.vector.prices)}
                        className={`w-full py-1.5 px-3 rounded-lg border text-[10.5px] font-mono flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer ${
                          copiedType === rec.type
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 font-bold shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                            : 'bg-[#181a20]/80 border-[#2a2c33]/80 text-zinc-300 hover:text-[#d4af37] hover:border-[#d4af37]/40 hover:bg-[#1a1d24]'
                        }`}
                      >
                        {copiedType === rec.type ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Trade Chat Tag Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-zinc-400" />
                            <span>Copy Trade Chat Tag</span>
                          </>
                        )}
                      </button>
                      <span className="text-[8px] text-zinc-500 text-center block mt-1 select-none uppercase tracking-wide font-mono">
                        Formats trade chat symbols instantly
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2.5 Pricing Permutations Line Plot */}
      <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-xl space-y-4 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
              <TrendingUp className="w-5 h-5 text-[#d4af37]" />
              Permutations Yield Curve & Performance Zones
            </h3>
            <p className="text-xs text-[#8e9299] max-w-2xl mt-1">
              Displays how returns decline from optimal gold-pricing combinations down to conservative buyer-favored models. Hover/touch to inspect precise simulated trade outcomes!
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>
              <span className="text-zinc-400">Above Average</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]"></span>
              <span className="text-zinc-400">Below Average</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></span>
              <span className="text-zinc-300">Below Expectation</span>
            </span>
          </div>
        </div>

        {/* Simulated Permutation Details scorecard */}
        <div className="min-h-[72px] flex items-center justify-between px-4 py-3.5 bg-[#0c0d10] border border-[#2a2c33]/70 rounded-xl transition duration-200">
          {hoveredPerm ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 w-full text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#8e9299] uppercase tracking-wider font-mono">Configuration</span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                  {hoveredPerm.key}
                </span>
              </div>
              <div className="hidden sm:block h-8 w-px bg-[#2a2c33]"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#8e9299] uppercase tracking-wider font-mono">Simulated Yield</span>
                <span className="text-sm font-bold mt-0.5 font-mono text-[#d4af37] flex items-center">
                  <PlatValue val={hoveredPerm.profit} size="w-3.5 h-3.5" className="text-[#d4af37]" />
                </span>
              </div>
              <div className="hidden sm:block h-8 w-px bg-[#2a2c33]"></div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#8e9299] uppercase tracking-wider font-mono">Zone Rating</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border mt-1 select-none text-center max-w-[140px] font-mono uppercase ${
                  hoveredPerm.category === 'Above Average' 
                    ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/30' 
                    : hoveredPerm.category === 'Below Expectation'
                    ? 'bg-red-950/40 text-red-400 border-red-900/40'
                    : 'bg-[#0c0d10] text-[#c4c5cc] border-zinc-800'
                }`}>
                  {hoveredPerm.category}
                </span>
              </div>
              <div className="hidden md:block h-8 w-px bg-[#2a2c33]"></div>
              <div className="hidden md:flex flex-col flex-1">
                <span className="text-[10px] text-[#8e9299] uppercase tracking-wider font-mono">Simulated Prices Vector</span>
                <span className="text-xs text-white font-mono mt-0.5">
                  B({hoveredPerm.prices[0]},{hoveredPerm.prices[1]}) S({hoveredPerm.prices[2]},{hoveredPerm.prices[3]}) G({hoveredPerm.prices[4]})
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full text-xs text-[#8e9299]/85 font-sans gap-2 py-2">
              <span className="w-1.5 h-1.5 bg-[#d4af37] rounded-full animate-ping"></span>
              <span>Slide your mouse/cursor horizontally over the line chart to easily inspect different pricing scenarios & zones!</span>
            </div>
          )}
        </div>

        {/* The SVG Line Plot */}
        {lineChartCoords && (
          <div className="space-y-4">
            <div 
              className="w-full h-48 sm:h-56 bg-[#07080a] rounded-xl border border-[#2a2c33] p-4 relative select-none cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const xInPixels = e.clientX - rect.left;
                const svgX = (xInPixels / rect.width) * lineChartCoords.width;

                let closest = lineChartCoords.points[0];
                let minDiff = Math.abs(svgX - lineChartCoords.points[0].x);
                for (let i = 1; i < lineChartCoords.points.length; i++) {
                  const diff = Math.abs(svgX - lineChartCoords.points[i].x);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closest = lineChartCoords.points[i];
                  }
                }
                setHoveredPerm(closest.record);
              }}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const xInPixels = e.touches[0].clientX - rect.left;
                  const svgX = (xInPixels / rect.width) * lineChartCoords.width;

                  let closest = lineChartCoords.points[0];
                  let minDiff = Math.abs(svgX - lineChartCoords.points[0].x);
                  for (let i = 1; i < lineChartCoords.points.length; i++) {
                    const diff = Math.abs(svgX - lineChartCoords.points[i].x);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closest = lineChartCoords.points[i];
                    }
                  }
                  setHoveredPerm(closest.record);
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const xInPixels = e.touches[0].clientX - rect.left;
                  const svgX = (xInPixels / rect.width) * lineChartCoords.width;

                  let closest = lineChartCoords.points[0];
                  let minDiff = Math.abs(svgX - lineChartCoords.points[0].x);
                  for (let i = 1; i < lineChartCoords.points.length; i++) {
                    const diff = Math.abs(svgX - lineChartCoords.points[i].x);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closest = lineChartCoords.points[i];
                    }
                  }
                  setHoveredPerm(closest.record);
                }
              }}
              onMouseLeave={() => setHoveredPerm(null)}
            >
              <svg 
                className="w-full h-full overflow-visible" 
                viewBox={`0 0 ${lineChartCoords.width} ${lineChartCoords.height}`}
                preserveAspectRatio="none"
              >
                {/* Horizontal reference grid lines */}
                {lineChartCoords.yGrids.map((grid, idx) => (
                  <g key={idx}>
                    <line 
                      x1={lineChartCoords.paddingLeft} 
                      y1={grid.y} 
                      x2={lineChartCoords.width - lineChartCoords.paddingRight} 
                      y2={grid.y} 
                      stroke="#1e2026" 
                      strokeWidth="0.5" 
                    />
                    <text 
                      x={lineChartCoords.paddingLeft - 8} 
                      y={grid.y + 4} 
                      fill="#8e9299" 
                      fontSize="9" 
                      fontFamily="monospace" 
                      textAnchor="end"
                    >
                      {grid.val} Pt
                    </text>
                  </g>
                ))}

                {/* Mean reference dashed line */}
                <line 
                  x1={lineChartCoords.paddingLeft} 
                  y1={lineChartCoords.meanY} 
                  x2={lineChartCoords.width - lineChartCoords.paddingRight} 
                  y2={lineChartCoords.meanY} 
                  stroke="#8e9299" 
                  strokeWidth="0.8" 
                  strokeDasharray="4,4" 
                  className="opacity-75"
                />
                <text 
                  x={lineChartCoords.width - lineChartCoords.paddingRight - 10} 
                  y={lineChartCoords.meanY - 5} 
                  fill="#c4c5cc" 
                  fontSize="8" 
                  fontFamily="monospace" 
                  textAnchor="end"
                  className="font-semibold select-none"
                >
                  Mean Average: {stats.average} Pt
                </text>

                {/* Shaded filling under the line */}
                <path 
                  d={lineChartCoords.fillD}
                  fill="url(#line-curve-gradient)" 
                  className="opacity-15"
                />

                <defs>
                  <linearGradient id="line-curve-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4af37" stopOpacity="0.35" />
                    <stop offset="60%" stopColor="#3182ce" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#07080a" stopOpacity="0" />
                  </linearGradient>
                  
                  <linearGradient id="line-color-gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#d4af37" />
                    <stop offset="55%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>

                {/* Core curve line */}
                <path 
                  d={lineChartCoords.pathD}
                  fill="none"
                  stroke="url(#line-color-gradient)"
                  strokeWidth="2.2"
                />

                {/* Active Vertical Guided Highlight Pointer */}
                {hoveredPerm && (() => {
                  const hoveredPt = lineChartCoords.points.find(p => p.record.key === hoveredPerm.key);
                  if (!hoveredPt) return null;
                  const nodeColor = 
                    hoveredPerm.category === 'Above Average' 
                      ? '#d4af37' 
                      : hoveredPerm.category === 'Below Expectation' 
                      ? '#ef4444' 
                      : '#38bdf8';
                  return (
                    <g>
                      <line 
                        x1={hoveredPt.x} 
                        y1={lineChartCoords.paddingTop} 
                        x2={hoveredPt.x} 
                        y2={lineChartCoords.height - lineChartCoords.paddingBottom} 
                        stroke={nodeColor} 
                        strokeWidth="1" 
                        strokeDasharray="2,2" 
                        className="opacity-75"
                      />
                      <circle
                        cx={hoveredPt.x}
                        cy={hoveredPt.y}
                        r="7"
                        fill="none"
                        stroke={nodeColor}
                        strokeWidth="1.2"
                        className="animate-pulse"
                      />
                    </g>
                  );
                })()}

                {/* Node Interactive Circles */}
                {lineChartCoords.points.map((pt, idx) => {
                  const nodeColor = 
                    pt.record.category === 'Above Average' 
                      ? '#d4af37' 
                      : pt.record.category === 'Below Expectation' 
                      ? '#ef4444' 
                      : '#38bdf8';

                  const isHovered = hoveredPerm?.key === pt.record.key;

                  return (
                    <circle 
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 6 : 3.2}
                      fill={nodeColor}
                      stroke={isHovered ? '#ffffff' : '#07080a'}
                      strokeWidth={isHovered ? 1.5 : 0.8}
                      className="transition-all duration-150"
                    />
                  );
                })}
              </svg>
            </div>
            
            {/* Axis Labels */}
            <div className="flex justify-between items-center text-[9px] text-[#8e9299] px-2 font-mono uppercase tracking-wider select-none">
              <span>Optimized Combinations (Max Gold Weight)</span>
              <span>Conservative Combinations (Min Gold Weight)</span>
            </div>

            {/* Mobile Playhead Curve Slider */}
            <div className="bg-[#0c0d10] border border-[#2a2c33]/60 rounded-xl p-3.5 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 select-none font-sans">
                  <span>📱 Curve Playhead Slider</span>
                  <span className="text-[8px] bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30 px-1 py-0.5 rounded font-sans font-bold hidden sm:inline-block">Recommended for Mobile</span>
                </span>
                {hoveredPerm ? (
                  <span className="text-[10px] font-mono text-[#d4af37] font-semibold select-none flex items-center gap-1">
                    {hoveredPerm.key}: <PlatValue val={hoveredPerm.profit} size="w-3 h-3" className="text-[#d4af37]" />
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[#8e9299] select-none">
                    Slide playhead to sweep points
                  </span>
                )}
              </div>
              <input
                type="range"
                min="0"
                max={lineChartCoords.points.length - 1}
                step="1"
                value={hoveredPerm ? Math.max(0, lineChartCoords.points.findIndex(p => p.record.key === hoveredPerm.key)) : 0}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  const pt = lineChartCoords.points[idx];
                  if (pt) {
                    setHoveredPerm(pt.record);
                  }
                }}
                className="w-full h-1.5 bg-[#14161c] rounded-lg appearance-none cursor-pointer accent-[#d4af37] border border-[#2a2c33]/50 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. ANOVA Group Comparison Table */}
      {displayAnova && (
        <>
          <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
                  <Table className="w-5 h-5 text-[#d4af37]" />
                  Variance Summary across Pricing Groupings
                </h3>
                <p className="text-xs text-[#8e9299] mt-1">
                  This table simulates hypothetical worst-case pricing trends for your highest-density assets to test yield stability.
                </p>
              </div>

              {/* Dynamic Focus Badge */}
              <div className="flex items-center gap-2 bg-[#0c0d10] border border-[#d4af37]/25 rounded-lg p-2 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse shadow-[0_0_6px_#d4af37]" />
                <div className="text-left font-sans">
                  <div className="text-[9px] text-[#8e9299] uppercase font-bold tracking-wider leading-none">Weight-Based Focus</div>
                  <div className="text-[11px] font-mono text-white font-semibold mt-0.5">
                    {statSuite.focusLabels && statSuite.focusLabels.length > 0 ? statSuite.focusLabels.join(' & ') : 'Gold Rarity'}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-[#8e9299] leading-relaxed">
              Based on your inventory composition, we dynamically prioritize checking price fluctuations for <span className="text-[#d4af37] font-semibold">{statSuite.focusLabels?.join(' and ') || 'Gold rarity'}</span> items, which hold the highest volume or revenue potential in your stock.
            </p>

        <div className="overflow-x-auto rounded-lg border border-[#2a2c33]">
          <table className="w-full text-xs text-left text-[#c4c5cc]">
            <thead className="text-[10px] font-bold text-[#8e9299] uppercase bg-[#0c0d10] tracking-wider">
              <tr>
                <th className="px-4 py-3">Pricing Strategy Group</th>
                <th className="px-4 py-3">Min</th>
                <th className="px-4 py-3">Median</th>
                <th className="px-4 py-3">Mean Average</th>
                <th className="px-[#d4af37] px-4 py-3">Max</th>
                <th className="px-4 py-3">Combinations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2c33] bg-[#14161c]/45">
              {statSuite.groups.map((group, idx) => (
                <tr 
                  key={group.name} 
                  className={`hover:bg-[#1a1c22] transition-colors cursor-pointer ${activeGroupIndex === idx ? 'bg-[#d4af37]/5 text-[#d4af37]' : ''}`}
                  onClick={() => setActiveGroupIndex(activeGroupIndex === idx ? null : idx)}
                >
                  <td className="px-4 py-3 font-semibold">{group.name}</td>
                  <td className="px-4 py-3 text-[#c4c5cc] flex-wrap gap-1"><PlatValue val={group.min} size="w-3 h-3" /></td>
                  <td className="px-4 py-3 text-[#c4c5cc] flex-wrap gap-1"><PlatValue val={group.median} size="w-3 h-3" /></td>
                  <td className="px-4 py-3 font-bold text-[#d4af37] flex-wrap gap-1"><PlatValue val={group.mean.toFixed(2)} size="w-3 h-3" className="text-[#d4af37]" /></td>
                  <td className="px-4 py-3 text-[#c4c5cc] flex-wrap gap-1"><PlatValue val={group.max} size="w-3 h-3" /></td>
                  <td className="px-4 py-3 text-[#8e9299]">{group.count} matrixes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. One-Way ANOVA Hypothesis results */}
      <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#e0e1e6] uppercase tracking-widest flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
            <Sparkles className="w-4 h-4 text-[#d4af37]" />
            One-Way ANOVA Outcome
          </h3>
          <p className="text-xs text-[#8e9299] leading-relaxed">
            By running analysis of variance across all groupings, we calculate the F-statistic to confirm if altering the allowed pricing tiers for <span className="text-white font-medium">{statSuite.focusLabels?.join(' & ') || 'Gold'}</span> parts translates into statistically significant variance in expected revenues.
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-[#0c0d10] border border-[#2a2c33] rounded">
              <span className="text-[10px] text-[#8e9299] block uppercase">F-Statistic</span>
              <strong className="text-sm text-[#e0e1e6]">{statSuite.anova.fStat}</strong>
            </div>
            <div className="p-3 bg-[#0c0d10] border border-[#2a2c33] rounded">
              <span className="text-[10px] text-[#8e9299] block uppercase">p-Value</span>
              <strong className={`text-sm ${statSuite.anova.pValue <= 0.05 ? 'text-emerald-400' : 'text-red-400'}`}>
                {statSuite.anova.pValue}
              </strong>
            </div>
          </div>

          <div className={`p-3.5 border rounded-lg text-xs leading-relaxed ${
            statSuite.anova.pValue <= 0.05 
              ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-350' 
              : 'bg-red-950/20 border-red-900/40 text-red-350'
          }`}>
            {statSuite.anova.pValue <= 0.05 ? (
              <span className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>H0 Rejected:</strong> pricing options have statistically different portfolios. Selecting a specific rarity price vector will result in a notable gain variation.
                </span>
              </span>
            ) : (
              <span className="flex items-start gap-2">
                <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>H0 Accepted:</strong> variance between averages is negligible compared to internal variance. Custom adjustments to {statSuite.focusLabels?.join('/') || 'Gold'} parts show zero distinct leverage.
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Tukey HSD summary */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#e0e1e6] uppercase tracking-widest flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
            <Sparkles className="w-4 h-4 text-[#d4af37]" />
            Tukey's Post-Hoc Pairwise Comparisons
          </h3>
          <p className="text-xs text-[#8e9299] leading-relaxed">
            The Tukey HSD comparison assesses every possible group pairing. Click any row in the variance table above to filter pairings for that specific group!
          </p>

          <div className="overflow-y-auto max-h-[220px] border border-[#2a2c33] rounded-lg p-2 bg-[#0c0d10] space-y-1">
            {statSuite.tukey
              .filter(p => activeGroupIndex === null || p.group1 === statSuite.groups[activeGroupIndex].name || p.group2 === statSuite.groups[activeGroupIndex].name)
              .map((pair, idx) => (
                <div key={idx} className="p-2 border border-[#2a2c33]/40 bg-[#14161c]/50 hover:border-[#d4af37]/40 rounded text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-350 truncate block">
                      {pair.group1} <span className="text-[#8e9299] px-1">vs</span> {pair.group2}
                    </span>
                    <span className="text-[10px] text-[#8e9299] mt-0.5 flex gap-3">
                      <span className="flex items-center gap-1">Diff: <strong className="text-[#d4af37] flex items-center gap-0.5"><PlatValue val={pair.meanDiff > 0 ? `+${pair.meanDiff}` : pair.meanDiff} size="w-2.5 h-2.5" className="text-[#d4af37]" /></strong></span>
                      <span>p: {pair.pValue}</span>
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                    pair.reject 
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' 
                      : 'bg-[#0c0d10] text-[#8e9299] border border-[#2a2c33]'
                  }`}>
                    {pair.reject ? 'Significant' : 'Equal Mean'}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
        </>
      )}

      {/* 5. Pricing patterns checklist lists dropdown */}
      <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-xl space-y-4">
        <div className={`flex items-center justify-between ${showAllRates ? 'pb-3 border-b border-[#2a2c33]' : ''}`}>
          <div>
            <h3 className="text-base font-semibold text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
              <Sparkles className="w-5 h-5 text-[#d4af37]" />
              Pricing Permutations & Individual Profits
            </h3>
            <p className="text-xs text-[#8e9299] mt-0.5">
              Inspect exactly how the different pricing matrices change your potential earnings.
            </p>
          </div>
          <button 
            onClick={() => setShowAllRates(!showAllRates)}
            className="text-xs text-[#d4af37] hover:underline inline-flex items-center gap-1 select-none cursor-pointer font-medium ml-4 shrink-0"
          >
            {showAllRates ? 'Hide Pricing Variations' : 'Show Pricing Variations'}
            {showAllRates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showAllRates && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 animate-fade-in">
            {adjustedRecords.map((record) => (
              <div 
                key={record.key} 
                className={`p-3 border rounded-lg text-xs space-y-2 relative transition ${
                  record.category === 'Above Average' 
                    ? 'border-[#d4af37]/35 bg-[#d4af37]/5' 
                    : record.category === 'Below Expectation' 
                    ? 'border-red-900/30 bg-red-950/5 text-[#8e9299]' 
                    : 'border-[#2a2c33] bg-[#0c0d10]/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{record.key}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    record.category === 'Above Average' 
                      ? 'bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20' 
                      : record.category === 'Below Expectation' 
                      ? 'bg-red-950 text-red-400 border border-red-900/40' 
                      : 'bg-[#0c0d10] text-[#c4c5cc] border border-[#2a2c33]'
                  }`}>
                    {record.category}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-[10px] text-[#8e9299]">Expected Profit:</span>
                  <strong className="text-base text-white flex items-center gap-1">
                    <PlatValue val={record.profit} size="w-3.5 h-3.5" className="text-white" />
                  </strong>
                </div>

                <div className="text-[10px] text-[#8e9299] pt-1.5 border-t border-[#2a2c33]/80 flex items-center justify-between flex-wrap gap-1">
                  <span>Vector:</span>
                  <span className="font-mono text-slate-350 bg-[#0c0d10] px-1 py-0.5 rounded border border-[#2a2c33]/40">
                    B({record.prices[0]},{record.prices[1]}) S({record.prices[2]},{record.prices[3]}) G({record.prices[4]})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
