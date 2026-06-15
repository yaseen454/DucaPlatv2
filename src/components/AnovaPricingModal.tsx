/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { InventoryCount } from '../types';
import { 
  X, 
  TrendingUp, 
  Sparkles, 
  Zap, 
  ChevronRight, 
  BadgeHelp,
  Calculator,
  Compass,
  ArrowRight,
  Settings as SettingsIcon,
  Sliders
} from 'lucide-react';
import { 
  getProfitStats, 
  generateCostsCustom, 
  DEFAULT_NARROW_CONFIG, 
  DEFAULT_BROAD_CONFIG 
} from '../utils/mathUtils';
import platinumIcon from '../data/platinum.png';
import ducatIcon from '../data/480px-OrokinDucats.png';

interface AnovaPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  counts: InventoryCount;
  initialPrices?: InventoryCount;
  onApplyPrices: (prices: InventoryCount) => void;
  narrowConfig?: any;
  broadConfig?: any;
  onNavigateToSettings?: () => void;
}

export default function AnovaPricingModal({
  isOpen,
  onClose,
  title,
  counts,
  initialPrices,
  onApplyPrices,
  narrowConfig,
  broadConfig,
  onNavigateToSettings
}: AnovaPricingModalProps) {
  const [calcType, setCalcType] = useState<1 | 2>(1); // 1 = Narrow, 2 = Broad
  
  // Local editable price overrides state
  const [prices, setPrices] = useState<InventoryCount>(() => {
    if (initialPrices) return { ...initialPrices };
    return {
      bronze15: 1,
      bronze25: 2,
      silver45: 3,
      silver65: 5,
      gold: 8
    };
  });

  if (!isOpen) return null;

  // Resolve config to use
  const activeNarrow = narrowConfig || DEFAULT_NARROW_CONFIG;
  const activeBroad = broadConfig || DEFAULT_BROAD_CONFIG;
  const activeConfig = calcType === 1 ? activeNarrow : activeBroad;

  // Total items and ducats metrics
  const totalCount = counts.bronze15 + counts.bronze25 + counts.silver45 + counts.silver65 + counts.gold;
  const totalDucats = counts.bronze15 * 15 + counts.bronze25 * 25 + counts.silver45 * 45 + counts.silver65 * 65 + counts.gold * 100;

  // Base ANOVA configs and vectors lists
  const baseCosts = useMemo(() => {
    return generateCostsCustom(activeConfig);
  }, [activeConfig]);

  // Compute boundaries for pricing tiers
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

  // Strategic choices lists
  const recommendations = useMemo(() => {
    if (baseCosts.length === 0 || dynamicRanges.length === 0) return [];

    const scoredVectors = baseCosts.map((cost, idx) => {
      const pricesArr = cost;
      const profit = counts.bronze15 * pricesArr[0] +
                     counts.bronze25 * pricesArr[1] +
                     counts.silver45 * pricesArr[2] +
                     counts.silver65 * pricesArr[3] +
                     counts.gold * pricesArr[4];

      // Calculate realism score
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
          const easeOfSelling = span === 0 ? 1 : (r.max - pricesArr[i]) / span;
          weightedRealismSum += count * easeOfSelling;
          dividingSum += count;
        }
      }

      const realismPercentage = dividingSum === 0 ? 100 : Math.round((weightedRealismSum / dividingSum) * 100);

      return {
        id: `pattern-${idx}`,
        prices: {
          bronze15: pricesArr[0],
          bronze25: pricesArr[1],
          silver45: pricesArr[2],
          silver65: pricesArr[3],
          gold: pricesArr[4]
        },
        profit,
        realism: realismPercentage
      };
    }).sort((a, b) => b.profit - a.profit);

    // 1. Maximalist Strategy (Optimistic Peak)
    const maxProfit = scoredVectors[0];

    // 2. Balanced Strategy (Density Optimized Sweet Spot >= 60% realism)
    const balancedCandidates = scoredVectors.filter(v => v.realism >= 60);
    const balanced = balancedCandidates[0] || scoredVectors[Math.floor(scoredVectors.length / 2)];

    // 3. Liquidity Strategy (Bulk Clearing >= 80% realism)
    const liquidityCandidates = scoredVectors.filter(v => v.realism >= 80);
    const liquidity = liquidityCandidates[0] || scoredVectors[scoredVectors.length - 1];

    return [
      {
        type: 'Maximalist Strategy',
        title: 'Patient Max Profit (Optimistic Cap)',
        vector: maxProfit,
        icon: TrendingUp,
        description: 'Maximize your profit. Best if you have high listing patience or multiple trade windows available.',
        badgeColor: 'bg-amber-950/40 text-amber-400 border-amber-900/30'
      },
      {
        type: 'Balanced Strategy',
        title: 'Pragmatic Turn Rate (Density Optimized)',
        vector: balanced,
        icon: Sparkles,
        description: 'Optimal trade-off between yield and turnover. Fine-tuned around your highest count items.',
        badgeColor: 'bg-blue-950/40 text-blue-400 border-blue-900/30'
      },
      {
        type: 'Liquidity Strategy',
        title: 'Ultra Fast Turnaround (Bulk Clearing)',
        vector: liquidity,
        icon: Zap,
        description: 'Lowest pricing configurations for extreme trade realism. Ensures listings clear almost immediately.',
        badgeColor: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
      }
    ];
  }, [baseCosts, dynamicRanges, counts]);

  // Compute live manual total price state
  const manualTotal = prices.bronze15 * counts.bronze15 +
                      prices.bronze25 * counts.bronze25 +
                      prices.silver45 * counts.silver45 +
                      prices.silver65 * counts.silver65 +
                      prices.gold * counts.gold;

  const handlePriceChange = (tier: keyof InventoryCount, val: number) => {
    setPrices(prev => ({
      ...prev,
      [tier]: val >= 0 ? val : 0
    }));
  };

  const applyStrategyPrices = (strategyPrices: InventoryCount) => {
    setPrices({ ...strategyPrices });
  };

  const handleSave = () => {
    onApplyPrices(prices);
    onClose();
  };

  // Helper string representation of setting limits
  const renderSettingSummary = (cfg: any) => {
    const formatValue = (val: any) => typeof val === 'object' ? `[${val.min}-${val.max}]` : `${val}`;
    return `B15: ${cfg.b15}p | B25: ${formatValue(cfg.b25)}p | S45: ${formatValue(cfg.s45)}p | S65: ${formatValue(cfg.s65)}p | G100: ${formatValue(cfg.g)}p`;
  };

  return (
    <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        className="bg-[#0c0d10] border border-[#d4af37]/45 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header section */}
        <div className="flex justify-between items-start border-b border-[#2a2c33]/70 pb-4 shrink-0">
          <div className="space-y-1">
            <h2 className="text-lg font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: "'Georgia', serif" }}>
              <Calculator className="w-5 h-5 text-[#d4af37]" />
              Rarity Pricing & ANOVA Strategy Hub
            </h2>
            <div className="text-xs text-[#8e9299]">
              Configuration for: <strong className="text-white font-mono">{title}</strong> — total of <strong className="text-zinc-200">{totalCount} items</strong> ({totalDucats} Ducats).
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 px-1.5 bg-[#14161c] hover:bg-zinc-800 border border-zinc-800 rounded transition text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal body (Scrollable content) */}
        <div className="flex-1 overflow-y-auto py-5 pr-1 space-y-5">
          
          {/* Settings Synchronization Banner */}
          <div className="bg-[#14161c]/60 border border-[#2a2c33]/70 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#d4af37] text-[10px] font-bold uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5" />
                <span>Synchronized with Main Settings</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans leading-normal">
                ANOVA regression bounds are loaded directly from your configured ranges:
              </p>
              <div className="text-[10px] text-zinc-500 font-mono bg-[#0c0d10] px-2 py-1 rounded border border-zinc-800/80 mt-1 inline-block">
                {calcType === 1 ? 'Narrow Mode Boundaries: ' : 'Broad Mode Boundaries: '}
                <span className="text-white font-bold">{renderSettingSummary(activeConfig)}</span>
              </div>
            </div>

            {onNavigateToSettings && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToSettings();
                  onClose();
                }}
                className="text-[9px] text-[#d4af37] bg-[#d4af37]/10 hover:bg-[#d4af37]/20 px-3 py-1.5 rounded-lg border border-[#d4af37]/25 font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-all shrink-0 active:scale-95"
              >
                <SettingsIcon className="w-3 h-3 text-[#d4af37]" />
                <span>Adjust in Settings Tab</span>
              </button>
            )}
          </div>

          {/* Toggle switch for Narrow / Broad configs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#14161c]/40 border border-[#2a2c33]/40 p-4 rounded-xl">
            <div>
              <h4 className="text-xs font-bold text-[#e0e1e6] uppercase tracking-wide">ANOVA Calculation Space</h4>
              <p className="text-[10px] text-[#8e9299] mt-0.5">Determine expected pricing variance borders</p>
            </div>
            
            <div className="flex bg-[#0c0d10] border border-[#2a2c33] rounded-lg p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setCalcType(1)}
                className={`px-3 py-1.5 rounded transition font-medium cursor-pointer ${calcType === 1 ? 'bg-[#d4af37]/15 text-[#d4af37] font-bold border border-[#d4af37]/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Narrow Set ({baseCosts.length} pts)
              </button>
              <button
                type="button"
                onClick={() => setCalcType(2)}
                className={`px-3 py-1.5 rounded transition font-medium cursor-pointer ${calcType === 2 ? 'bg-[#d4af37]/15 text-[#d4af37] font-bold border border-[#d4af37]/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Broad Set ({baseCosts.length} pts)
              </button>
            </div>
          </div>

          {/* Strategic Options list */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest pl-1">Strategic Pricing Presets</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recommendations.map((rec) => {
                const SIcon = rec.icon;
                const pricingList = `${rec.vector.prices.bronze15}, ${rec.vector.prices.bronze25}, ${rec.vector.prices.silver45}, ${rec.vector.prices.silver65}, ${rec.vector.prices.gold}`;
                const isApplied = prices.bronze15 === rec.vector.prices.bronze15 &&
                                  prices.bronze25 === rec.vector.prices.bronze25 &&
                                  prices.silver45 === rec.vector.prices.silver45 &&
                                  prices.silver65 === rec.vector.prices.silver65 &&
                                  prices.gold === rec.vector.prices.gold;

                return (
                  <div 
                    key={rec.type}
                    className={`p-4 bg-[#14161c] border rounded-xl flex flex-col justify-between gap-3 transition-all duration-150 ${isApplied ? 'border-[#d4af37]/60 bg-[#d4af37]/3' : 'border-[#2a2c33] hover:border-zinc-700'}`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded border uppercase font-extrabold tracking-wide ${rec.badgeColor}`}>
                          {rec.type}
                        </span>
                      </div>
                      <h5 className="text-sm font-extrabold text-[#e0e1e6] leading-tight">{rec.title}</h5>
                      <p className="text-[11px] text-zinc-300 leading-normal line-clamp-3">{rec.description}</p>
                      
                      <div className="text-[11px] text-zinc-400 font-mono bg-zinc-950/40 px-2 py-1 rounded inline-block">
                        Pattern: <span className="text-zinc-200 font-extrabold">[{pricingList}]p</span>
                      </div>
                    </div>

                    <div className="border-t border-zinc-800/60 pt-2 flex items-center justify-between mt-1">
                      <div>
                        <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block">Expected Yield</span>
                        <div className="font-mono text-emerald-400 text-sm sm:text-base font-black flex items-center gap-1">
                          <span>{rec.vector.profit}</span>
                          <img src={platinumIcon} className="w-4 h-4 object-contain inline" alt="Pt" />
                        </div>
                        <span className="text-[10px] font-mono text-purple-300 font-semibold block mt-0.5">Realism: {rec.vector.realism}%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => applyStrategyPrices(rec.vector.prices)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                          isApplied 
                            ? 'bg-zinc-800 border border-zinc-700 text-[#d4af37] cursor-default' 
                            : 'bg-[#d4af37] hover:bg-[#b08d26] text-black active:scale-95'
                        }`}
                      >
                        <span>{isApplied ? 'Applied' : 'Apply'}</span>
                        {!isApplied && <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ANOVA Permutations Select */}
          <div className="bg-[#14161c]/30 rounded-xl p-4.5 border border-[#2a2c33]/40 space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
              Select Custom ANOVA Price Permutation Set ({baseCosts.length} matrices)
            </label>
            <select
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                if (isNaN(idx)) return;
                const p = baseCosts[idx];
                applyStrategyPrices({
                  bronze15: p[0],
                  bronze25: p[1],
                  silver45: p[2],
                  silver65: p[3],
                  gold: p[4]
                });
              }}
              className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded-lg px-3.5 py-3 text-sm text-[#e0e1e6] font-bold focus:outline-none focus:border-[#d4af37]/60 font-mono"
              defaultValue=""
            >
              <option value="" disabled>--- Choose statistical matrix combination ---</option>
              {baseCosts.map((cost, idx) => {
                const profit = counts.bronze15 * cost[0] +
                               counts.bronze25 * cost[1] +
                               counts.silver45 * cost[2] +
                               counts.silver65 * cost[3] +
                               counts.gold * cost[4];
                return (
                  <option key={idx} value={idx}>
                    Matrix {idx + 1}: [{cost.join(', ')}]p &rarr; Yield: {profit}p
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selected Strategy Price Information */}
          <div className="bg-[#14161c]/50 border border-[#d4af37]/20 rounded-xl p-5 space-y-3.5">
            <h4 className="text-xs font-bold text-[#d4af37] uppercase tracking-wide flex items-center justify-between">
              <span>Applied Rarity Pricing Matrix Overview</span>
              <span className="text-[10px] text-zinc-400 font-mono font-normal">Active Selection</span>
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 pt-1">
              <div className="p-3 bg-[#0c0d10] border border-[#cd7f32]/15 rounded-lg text-center font-mono">
                <span className="text-[#cd7f32] text-[10px] font-black uppercase block">Bronze 15d</span>
                <span className="text-white text-base font-extrabold block mt-1">{prices.bronze15}p</span>
                <span className="text-[10px] text-zinc-500 block">Count: {counts.bronze15}</span>
              </div>
              <div className="p-3 bg-[#0c0d10] border border-[#cd7f32]/15 rounded-lg text-center font-mono">
                <span className="text-[#cd7f32] text-[10px] font-black uppercase block">Bronze 25d</span>
                <span className="text-white text-base font-extrabold block mt-1">{prices.bronze25}p</span>
                <span className="text-[10px] text-zinc-500 block">Count: {counts.bronze25}</span>
              </div>
              <div className="p-3 bg-[#0c0d10] border border-zinc-800 rounded-lg text-center font-mono">
                <span className="text-zinc-400 text-[10px] font-black uppercase block">Silver 45d</span>
                <span className="text-white text-base font-extrabold block mt-1">{prices.silver45}p</span>
                <span className="text-[10px] text-zinc-400 block">Count: {counts.silver45}</span>
              </div>
              <div className="p-3 bg-[#0c0d10] border border-zinc-800 rounded-lg text-center font-mono">
                <span className="text-zinc-400 text-[10px] font-black uppercase block">Silver 65d</span>
                <span className="text-white text-base font-extrabold block mt-1">{prices.silver65}p</span>
                <span className="text-[10px] text-zinc-400 block">Count: {counts.silver65}</span>
              </div>
              <div className="p-3 bg-[#0c0d10] border border-[#d4af37]/15 rounded-lg text-center font-mono">
                <span className="text-[#d4af37] text-[10px] font-black uppercase block">Gold 100d</span>
                <span className="text-white text-base font-extrabold block mt-1">{prices.gold}p</span>
                <span className="text-[10px] text-[#d4af37] block">Count: {counts.gold}</span>
              </div>
            </div>
            
            <div className="bg-[#0c0d10] p-4 rounded-xl border border-[#2a2c33]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">Total Projected Valuation Yield</span>
                <div className="text-2xl font-mono font-black text-emerald-400 flex items-center gap-1">
                  <span>{manualTotal}</span>
                  <img src={platinumIcon} className="w-5 h-5 object-contain inline" alt="Pt" />
                </div>
              </div>
              <div className="text-right text-[10px] text-zinc-500 font-mono">
                Formula yields: <span className="text-zinc-300">({counts.bronze15}×{prices.bronze15}p + {counts.bronze25}×{prices.bronze25}p + {counts.silver45}×{prices.silver45}p + {counts.silver65}×{prices.silver65}p + {counts.gold}×{prices.gold}p) = <strong className="text-emerald-400">{manualTotal}p</strong></span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal footer action buttons */}
        <div className="flex justify-end gap-3.5 border-t border-[#2a2c33]/70 pt-4 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg transition duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave}
            className="px-4.5 py-2 text-xs font-semibold uppercase tracking-wider bg-[#d4af37] hover:bg-[#b08d26] text-black rounded-lg transition duration-150 flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <span>Confirm Pricing & Select</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
