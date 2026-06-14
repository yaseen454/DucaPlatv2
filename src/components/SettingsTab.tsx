/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { PriceRangesConfig, DEFAULT_NARROW_CONFIG, DEFAULT_BROAD_CONFIG } from '../utils/mathUtils';
import { Sliders, RefreshCw, Sparkles, Check, Info } from 'lucide-react';
import platinumIcon from '../data/platinum.png';
import ducatIcon from '../data/480px-OrokinDucats.png';

function DucatValue({ val, size = "w-3.5 h-3.5", className = "" }: { val: string | number; size?: string; className?: string }) {
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

interface SettingsTabProps {
  narrowConfig: PriceRangesConfig;
  setNarrowConfig: (cfg: PriceRangesConfig) => void;
  broadConfig: PriceRangesConfig;
  setBroadConfig: (cfg: PriceRangesConfig) => void;
  onNavigateToCalculator?: () => void;
}

interface CompactInputFieldProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
}

function CompactInputField({ label, value, onChange }: CompactInputFieldProps) {
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <span className="text-[9px] text-[#8e9299] uppercase shrink-0 w-8">{label}:</span>
      <div className="flex-1 flex flex-col min-w-0">
        <input
          type="number"
          min="1"
          max="100"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2 py-0.5 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
        />
        <div className="flex gap-1 mt-1">
          <button
            type="button"
            onClick={() => onChange(Math.max(1, value - 1))}
            className="flex-1 h-5 flex items-center justify-center text-[10px] font-bold bg-[#0c0d10] hover:bg-[#1a1c22] border border-[#2a2c33] text-[#8e9299] hover:text-white rounded transition active:scale-95 cursor-pointer select-none"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            className="flex-1 h-5 flex items-center justify-center text-[10px] font-bold bg-[#0c0d10] hover:bg-[#1a1c22] border border-[#2a2c33] text-[#8e9299] hover:text-white rounded transition active:scale-95 cursor-pointer select-none"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsTab({
  narrowConfig,
  setNarrowConfig,
  broadConfig,
  setBroadConfig,
  onNavigateToCalculator
}: SettingsTabProps) {
  
  // Calculate total combinations pool size for a given PriceRangesConfig
  const calculateCombinations = (cfg: PriceRangesConfig) => {
    const getRangeLength = (min: number, max: number) => {
      const mn = Math.min(min, max);
      const mx = Math.max(min, max);
      return mx - mn + 1;
    };
    const b25Count = getRangeLength(cfg.b25.min, cfg.b25.max);
    const s45Count = getRangeLength(cfg.s45.min, cfg.s45.max);
    const s65Count = getRangeLength(cfg.s65.min, cfg.s65.max);
    const gCount = getRangeLength(cfg.g.min, cfg.g.max);
    
    return b25Count * s45Count * s65Count * gCount;
  };

  const handleResetNarrow = () => {
    setNarrowConfig({ ...DEFAULT_NARROW_CONFIG });
  };

  const handleResetBroad = () => {
    setBroadConfig({ ...DEFAULT_BROAD_CONFIG });
  };

  const updateNarrowField = (field: 'b15' | 'b25' | 's45' | 's65' | 'g', key: 'min' | 'max' | null, val: number) => {
    const newConfig = { ...narrowConfig };
    if (field === 'b15') {
      newConfig.b15 = val;
    } else if (key) {
      newConfig[field] = {
        ...newConfig[field],
        [key]: val
      };
    }
    setNarrowConfig(newConfig);
  };

  const updateBroadField = (field: 'b15' | 'b25' | 's45' | 's65' | 'g', key: 'min' | 'max' | null, val: number) => {
    const newConfig = { ...broadConfig };
    if (field === 'b15') {
      newConfig.b15 = val;
    } else if (key) {
      newConfig[field] = {
        ...newConfig[field],
        [key]: val
      };
    }
    setBroadConfig(newConfig);
  };

  const narrowCombinations = calculateCombinations(narrowConfig);
  const broadCombinations = calculateCombinations(broadConfig);

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-6 rounded-xl bg-[#14161c] border border-[#2a2c33] relative overflow-hidden shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10 flex-1">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#d4af37]" />
            <h2 className="text-xl font-medium tracking-wide text-white uppercase" style={{ fontFamily: "'Georgia', serif" }}>
              Dynamic Market Boundaries Settings
            </h2>
          </div>
          <p className="text-xs text-[#8e9299] max-w-2xl leading-relaxed">
            Customize the lower and upper Platinum boundaries for each prime junk tier.
            Our statistics engine will rebuild the multi-variable cost vectors on-the-fly and compute revised Analysis of Variance tests and profit distributions.
          </p>
        </div>
        
        {onNavigateToCalculator && (
          <button
            type="button"
            onClick={onNavigateToCalculator}
            className="relative z-10 px-5 py-3 bg-[#d4af37]/10 hover:bg-[#d4af37] text-[#d4af37] hover:text-black border border-[#d4af37]/35 hover:border-transparent rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-150 inline-flex items-center gap-2 cursor-pointer shrink-0 shadow-lg active:scale-95"
          >
            Go to Calculator ➔
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NARROW CONFIGURATION */}
        <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a2c33]">
              <div>
                <h3 className="text-sm font-semibold text-[#e0e1e6] uppercase tracking-wider">Narrow Set Boundaries</h3>
                <p className="text-[10px] text-[#8e9299]">Standard, highly targeted premium pricing calculations.</p>
              </div>
              <button
                onClick={handleResetNarrow}
                className="text-[10px] uppercase font-bold text-[#d4af37]/80 hover:text-[#d4af37] border border-[#d4af37]/20 hover:border-[#d4af37]/40 bg-[#d4af37]/5 px-2.5 py-1 rounded transition duration-200 cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Reset Defaults
              </button>
            </div>

            {/* Matrix count status info */}
            <div className="bg-[#0c0d10] border border-[#2a2c33]/80 rounded-lg px-4 py-3 text-xs flex items-center justify-between gap-2">
              <span className="text-[#8e9299] flex items-center gap-1.5 font-sans">
                <Sparkles className="w-4 h-4 text-[#d4af37]" /> Grid Density Complexity:
              </span>
              <strong className="text-white font-mono text-sm bg-[#14161c] px-2 py-0.5 rounded border border-[#2a2c33]">
                {narrowCombinations} Vector Permutations
              </strong>
            </div>

            {/* Inputs list */}
            <div className="space-y-4 pt-1">
              {/* Bronze 15 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Bronze (<DucatValue val={15} size="w-3 h-3" />)</span>
                <div className="col-span-2 flex items-center gap-2">
                  <CompactInputField 
                    label="Cost" 
                    value={narrowConfig.b15} 
                    onChange={(val) => updateNarrowField('b15', null, val)} 
                  />
                  <img src={platinumIcon} className="w-4 h-4 shrink-0 object-contain ml-1" alt="Pt" referrerPolicy="no-referrer" />
                </div>
              </div>

              {/* Bronze 25 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Bronze (<DucatValue val={25} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <CompactInputField 
                    label="Min" 
                    value={narrowConfig.b25.min} 
                    onChange={(val) => updateNarrowField('b25', 'min', val)} 
                  />
                  <CompactInputField 
                    label="Max" 
                    value={narrowConfig.b25.max} 
                    onChange={(val) => updateNarrowField('b25', 'max', val)} 
                  />
                </div>
              </div>

              {/* Silver 45 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Silver (<DucatValue val={45} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <CompactInputField 
                    label="Min" 
                    value={narrowConfig.s45.min} 
                    onChange={(val) => updateNarrowField('s45', 'min', val)} 
                  />
                  <CompactInputField 
                    label="Max" 
                    value={narrowConfig.s45.max} 
                    onChange={(val) => updateNarrowField('s45', 'max', val)} 
                  />
                </div>
              </div>

              {/* Silver 65 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Silver (<DucatValue val={65} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <CompactInputField 
                    label="Min" 
                    value={narrowConfig.s65.min} 
                    onChange={(val) => updateNarrowField('s65', 'min', val)} 
                  />
                  <CompactInputField 
                    label="Max" 
                    value={narrowConfig.s65.max} 
                    onChange={(val) => updateNarrowField('s65', 'max', val)} 
                  />
                </div>
              </div>

              {/* Gold 100 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Gold (<DucatValue val={100} size="w-3 h-3" className="text-[#ffd700]" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <CompactInputField 
                    label="Min" 
                    value={narrowConfig.g.min} 
                    onChange={(val) => updateNarrowField('g', 'min', val)} 
                  />
                  <CompactInputField 
                    label="Max" 
                    value={narrowConfig.g.max} 
                    onChange={(val) => updateNarrowField('g', 'max', val)} 
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-[#2a2c33]/40 text-[10px] text-[#8e9299] flex items-center gap-1.5 leading-relaxed">
            <Info className="w-4 h-4 text-[#d4af37] shrink-0" />
            <span>Updates take effect immediately on the calculator and statistical suites.</span>
          </div>
        </div>

        {/* BROAD CONFIGURATION */}
        <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a2c33]">
              <div>
                <h3 className="text-sm font-semibold text-[#e0e1e6] uppercase tracking-wider">Broad Set Boundaries</h3>
                <p className="text-[10px] text-[#8e9299]">Explorative pricing settings covering broader variances.</p>
              </div>
              <button
                onClick={handleResetBroad}
                className="text-[10px] uppercase font-bold text-[#d4af37]/80 hover:text-[#d4af37] border border-[#d4af37]/20 hover:border-[#d4af37]/40 bg-[#d4af37]/5 px-2.5 py-1 rounded transition duration-200 cursor-pointer inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Reset Defaults
              </button>
            </div>

            {/* Matrix count status info */}
            <div className="bg-[#0c0d10] border border-[#2a2c33]/80 rounded-lg px-4 py-3 text-xs flex items-center justify-between gap-2">
              <span className="text-[#8e9299] flex items-center gap-1.5 font-sans">
                <Sparkles className="w-4 h-4 text-[#d4af37]" /> Grid Density Complexity:
              </span>
              <strong className="text-white font-mono text-sm bg-[#14161c] px-2 py-0.5 rounded border border-[#2a2c33]">
                {broadCombinations} Vector Permutations
              </strong>
            </div>

            {/* Inputs list */}
            <div className="space-y-4 pt-1">
              {/* Bronze 15 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Bronze (<DucatValue val={15} size="w-3 h-3" />)</span>
                <div className="col-span-2 flex items-center gap-2">
                  <CompactInputField 
                    label="Cost" 
                    value={broadConfig.b15} 
                    onChange={(val) => updateBroadField('b15', null, val)} 
                  />
                  <img src={platinumIcon} className="w-4 h-4 shrink-0 object-contain ml-1" alt="Pt" referrerPolicy="no-referrer" />
                </div>
              </div>

              {/* Bronze 25 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Bronze (<DucatValue val={25} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <CompactInputField 
                    label="Min" 
                    value={broadConfig.b25.min} 
                    onChange={(val) => updateBroadField('b25', 'min', val)} 
                  />
                  <CompactInputField 
                    label="Max" 
                    value={broadConfig.b25.max} 
                    onChange={(val) => updateBroadField('b25', 'max', val)} 
                  />
                </div>
              </div>

              {/* Silver 45 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Silver (<DucatValue val={45} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <CompactInputField 
                    label="Min" 
                    value={broadConfig.s45.min} 
                    onChange={(val) => updateBroadField('s45', 'min', val)} 
                  />
                  <CompactInputField 
                    label="Max" 
                    value={broadConfig.s45.max} 
                    onChange={(val) => updateBroadField('s45', 'max', val)} 
                  />
                </div>
              </div>

              {/* Silver 65 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Silver (<DucatValue val={65} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <CompactInputField 
                    label="Min" 
                    value={broadConfig.s65.min} 
                    onChange={(val) => updateBroadField('s65', 'min', val)} 
                  />
                  <CompactInputField 
                    label="Max" 
                    value={broadConfig.s65.max} 
                    onChange={(val) => updateBroadField('s65', 'max', val)} 
                  />
                </div>
              </div>

              {/* Gold 100 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2.5 border border-zinc-800/40 rounded-xl hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Gold (<DucatValue val={100} size="w-3 h-3" className="text-[#ffd700]" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <CompactInputField 
                    label="Min" 
                    value={broadConfig.g.min} 
                    onChange={(val) => updateBroadField('g', 'min', val)} 
                  />
                  <CompactInputField 
                    label="Max" 
                    value={broadConfig.g.max} 
                    onChange={(val) => updateBroadField('g', 'max', val)} 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#2a2c33]/40 text-[10px] text-[#8e9299] flex items-center gap-1.5 leading-relaxed">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Vite is compiling layout metrics. Changes are retained automatically during your browser session.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
