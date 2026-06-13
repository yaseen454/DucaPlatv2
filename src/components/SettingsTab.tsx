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
}

export default function SettingsTab({
  narrowConfig,
  setNarrowConfig,
  broadConfig,
  setBroadConfig
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
      <div className="p-6 rounded-xl bg-[#14161c] border border-[#2a2c33] relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#d4af37]" />
            <h2 className="text-xl font-medium tracking-wide text-white uppercase" style={{ fontFamily: "'Georgia', serif" }}>
              Dynamic Market Boundaries Settings
            </h2>
          </div>
          <p className="text-xs text-[#8e9299] max-w-3xl leading-relaxed">
            Customize the lower and upper Platinum boundaries for each prime junk tier.
            Our statistics engine will rebuild the multi-variable cost vectors on-the-fly and compute revised Analysis of Variance tests and profit distributions.
          </p>
        </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Bronze (<DucatValue val={15} size="w-3 h-3" />)</span>
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-[10px] text-[#8e9299] uppercase pr-2">Fixed Cost:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={narrowConfig.b15}
                    onChange={(e) => updateNarrowField('b15', null, parseInt(e.target.value) || 1)}
                    className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                  />
                  <img src={platinumIcon} className="w-4 h-4 shrink-0 object-contain" alt="Pt" referrerPolicy="no-referrer" />
                </div>
              </div>

              {/* Bronze 25 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Bronze (<DucatValue val={25} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Min:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={narrowConfig.b25.min}
                      onChange={(e) => updateNarrowField('b25', 'min', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Max:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={narrowConfig.b25.max}
                      onChange={(e) => updateNarrowField('b25', 'max', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              </div>

              {/* Silver 45 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Silver (<DucatValue val={45} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Min:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={narrowConfig.s45.min}
                      onChange={(e) => updateNarrowField('s45', 'min', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Max:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={narrowConfig.s45.max}
                      onChange={(e) => updateNarrowField('s45', 'max', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              </div>

              {/* Silver 65 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Silver (<DucatValue val={65} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Min:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={narrowConfig.s65.min}
                      onChange={(e) => updateNarrowField('s65', 'min', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Max:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={narrowConfig.s65.max}
                      onChange={(e) => updateNarrowField('s65', 'max', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              </div>

              {/* Gold 100 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Gold (<DucatValue val={100} size="w-3 h-3" className="text-[#ffd700]" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Min:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={narrowConfig.g.min}
                      onChange={(e) => updateNarrowField('g', 'min', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Max:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={narrowConfig.g.max}
                      onChange={(e) => updateNarrowField('g', 'max', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Bronze (<DucatValue val={15} size="w-3 h-3" />)</span>
                <div className="col-span-2 flex items-center gap-2">
                  <span className="text-[10px] text-[#8e9299] uppercase pr-2">Fixed Cost:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={broadConfig.b15}
                    onChange={(e) => updateBroadField('b15', null, parseInt(e.target.value) || 1)}
                    className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                  />
                  <img src={platinumIcon} className="w-4 h-4 shrink-0 object-contain" alt="Pt" referrerPolicy="no-referrer" />
                </div>
              </div>

              {/* Bronze 25 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Bronze (<DucatValue val={25} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Min:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={broadConfig.b25.min}
                      onChange={(e) => updateBroadField('b25', 'min', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Max:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={broadConfig.b25.max}
                      onChange={(e) => updateBroadField('b25', 'max', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              </div>

              {/* Silver 45 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Silver (<DucatValue val={45} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Min:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={broadConfig.s45.min}
                      onChange={(e) => updateBroadField('s45', 'min', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Max:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={broadConfig.s45.max}
                      onChange={(e) => updateBroadField('s45', 'max', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              </div>

              {/* Silver 65 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Silver (<DucatValue val={65} size="w-3 h-3" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Min:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={broadConfig.s65.min}
                      onChange={(e) => updateBroadField('s65', 'min', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Max:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={broadConfig.s65.max}
                      onChange={(e) => updateBroadField('s65', 'max', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                </div>
              </div>

              {/* Gold 100 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-2 p-2 border border-zinc-800/40 rounded-lg hover:border-zinc-800 transition">
                <span className="text-xs text-[#c4c5cc] font-medium font-sans flex items-center gap-1">Gold (<DucatValue val={100} size="w-3 h-3" className="text-[#ffd700]" />)</span>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Min:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={broadConfig.g.min}
                      onChange={(e) => updateBroadField('g', 'min', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8e9299] uppercase">Max:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={broadConfig.g.max}
                      onChange={(e) => updateBroadField('g', 'max', parseInt(e.target.value) || 1)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded px-2.5 py-1 text-center text-xs font-mono text-white focus:ring-[#d4af37] focus:border-[#d4af37]"
                    />
                  </div>
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
