/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { InventoryCount } from '../types';
import { Sparkles, Coins, TrendingUp, Bookmark } from 'lucide-react';
import { PriceRangesConfig } from '../utils/mathUtils';
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

interface ManualInputProps {
  counts: InventoryCount;
  onChange: (counts: InventoryCount) => void;
  onCalculate: () => void;
  activeConfig: PriceRangesConfig;
  onSaveToItems?: (counts: InventoryCount, name?: string) => void;
  onNavigateToSettings?: () => void;
  calcType: 1 | 2;
  onChangeCalcType: (type: 1 | 2) => void;
}

export default function ManualInput({ 
  counts, 
  onChange, 
  onCalculate, 
  activeConfig, 
  onSaveToItems,
  onNavigateToSettings,
  calcType,
  onChangeCalcType
}: ManualInputProps) {
  const [saveName, setSaveName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateField = (key: keyof InventoryCount, val: number) => {
    const clamped = Math.max(0, val);
    onChange({ ...counts, [key]: clamped });
  };

  const increment = (key: keyof InventoryCount) => {
    onChange({ ...counts, [key]: counts[key] + 1 });
  };

  const decrement = (key: keyof InventoryCount) => {
    onChange({ ...counts, [key]: Math.max(0, counts[key] - 1) });
  };

  const getPricingValue = (key: keyof InventoryCount) => {
    if (!activeConfig) return '';
    if (key === 'bronze15') return `${activeConfig.b15}`;
    if (key === 'bronze25') return `${activeConfig.b25.min}–${activeConfig.b25.max}`;
    if (key === 'silver45') return `${activeConfig.s45.min}–${activeConfig.s45.max}`;
    if (key === 'silver65') return `${activeConfig.s65.min}–${activeConfig.s65.max}`;
    if (key === 'gold') return `${activeConfig.g.min}–${activeConfig.g.max}`;
    return '';
  };

  const categories = [
    { key: 'bronze15' as const, label: 'Bronze 15s (Common)', desc: 'Lowest tier junk parts (e.g. Braton/Burston stocks)', color: 'border-[#cd7f32]/40 bg-[#cd7f32]/5 text-[#cd7f32]' },
    { key: 'bronze25' as const, label: 'Bronze 25s (Common Plus)', desc: 'Uncommon outcomes for common items (e.g. Fang handles)', color: 'border-[#cd7f32]/60 bg-[#cd7f32]/10 text-[#cd7f32]' },
    { key: 'silver45' as const, label: 'Silver 45s (Uncommon)', desc: 'Standard mid-tier items (e.g. Cernos blueprints)', color: 'border-[#c0c0c0]/40 bg-[#c0c0c0]/5 text-[#c0c0c0]' },
    { key: 'silver65' as const, label: 'Silver 65s (Uncommon Plus)', desc: 'Higher value silver parts (e.g. Ash systems)', color: 'border-[#c0c0c0]/60 bg-[#c0c0c0]/10 text-[#c0c0c0]' },
    { key: 'gold' as const, label: 'Gold 100s (Rare)', desc: 'Premium rare outcomes across all relics (e.g. Caliban systems)', color: 'border-[#d4af37]/40 bg-[#d4af37]/5 text-[#d4af37]' }
  ];

  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-2xl space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-[#2a2c33]">
        <div>
          <h2 className="text-xl font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
            <Coins className="w-5 h-5 text-[#d4af37]" />
            Manual Junk Quantities
          </h2>
          <p className="text-xs text-[#8e9299] mt-1">Specify how many items of each ducat tier you possess inside your inventory.</p>
        </div>
        <div className="text-right font-sans">
          <div className="text-xs font-semibold text-[#8e9299]">Total Counted</div>
          <div className="text-lg font-bold text-[#d4af37]">{totalItems}</div>
        </div>
      </div>

      {/* Active Matrix compact visualizer */}
      {activeConfig && (
        <div className="space-y-2.5">
          <div className="bg-[#0c0d10] border border-[#2a2c33]/60 rounded-xl px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-sans shadow-inner">
            <div className="flex flex-col gap-0.5 shrink-0 select-none">
              <span className="text-[#8e9299] font-medium flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" /> Active Rates Matrix:
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-zinc-500">
                <span>Edit plat ranges inside</span>
                <button 
                  type="button" 
                  onClick={onNavigateToSettings}
                  className="px-1.5 text-[8.5px] font-semibold bg-[#2a2c33]/40 border border-[#2a2c33]/80 hover:border-[#d4af37]/45 rounded text-[#d4af37] hover:text-[#d4af37] transition cursor-pointer select-none uppercase tracking-wide leading-none py-0.5"
                >
                  Settings ⚙️
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#c4c5cc] font-mono leading-none">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#cd7f32]/60"></span>
                <DucatValue val="15" size="w-2.5 h-2.5" className="text-zinc-400 font-bold" />:&nbsp;<strong className="text-white flex items-center gap-0.5"><PlatValue val={activeConfig.b15} size="w-2.5 h-2.5" className="text-white" /></strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#cd7f32]"></span>
                <DucatValue val="25" size="w-2.5 h-2.5" className="text-zinc-400 font-bold" />:&nbsp;<strong className="text-white flex items-center gap-0.5"><PlatValue val={`${activeConfig.b25.min}–${activeConfig.b25.max}`} size="w-2.5 h-2.5" className="text-white" /></strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c0c0c0]/60"></span>
                <DucatValue val="45" size="w-2.5 h-2.5" className="text-zinc-400 font-bold" />:&nbsp;<strong className="text-white flex items-center gap-0.5"><PlatValue val={`${activeConfig.s45.min}–${activeConfig.s45.max}`} size="w-2.5 h-2.5" className="text-white" /></strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c0c0c0]"></span>
                <DucatValue val="65" size="w-2.5 h-2.5" className="text-zinc-400 font-bold" />:&nbsp;<strong className="text-white flex items-center gap-0.5"><PlatValue val={`${activeConfig.s65.min}–${activeConfig.s65.max}`} size="w-2.5 h-2.5" className="text-white" /></strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]"></span>
                <DucatValue val="100" size="w-2.5 h-2.5" className="text-[#d4af37] font-bold" />:&nbsp;<strong className="text-white flex items-center gap-0.5"><PlatValue val={`${activeConfig.g.min}–${activeConfig.g.max}`} size="w-2.5 h-2.5" className="text-[#d4af37]" /></strong>
              </span>
            </div>
          </div>

          <div className="bg-[#0c0d10]/40 border border-[#2a2c33]/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#8e9299] font-bold uppercase tracking-wider">Calculation Vector Toggle</span>
              <span className="text-[9px] text-[#d4af37] font-mono">Current: {calcType === 1 ? 'Narrow Set' : 'Broad Set'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-[#0c0d10] p-1 border border-[#2a2c33] rounded-lg">
              <button
                type="button"
                onClick={() => onChangeCalcType(1)}
                className={`py-1.5 text-xs font-semibold rounded text-center transition cursor-pointer select-none ${
                  calcType === 1 ? 'bg-[#d4af37] text-black font-semibold shadow-inner' : 'text-[#8e9299] hover:text-[#e0e1e6] hover:bg-[#1a1d24]/40'
                }`}
              >
                Narrow Set (96 pts)
              </button>
              <button
                type="button"
                onClick={() => onChangeCalcType(2)}
                className={`py-1.5 text-xs font-semibold rounded text-center transition cursor-pointer select-none ${
                  calcType === 2 ? 'bg-[#d4af37] text-black font-semibold shadow-inner' : 'text-[#8e9299] hover:text-[#e0e1e6] hover:bg-[#1a1d24]/40'
                }`}
              >
                Broad Set (216 pts)
              </button>
            </div>
            <p className="text-[9.5px] text-[#8e9299] leading-normal">
              {calcType === 1 
                ? 'Calculates expected profits over standard premium tiers. Perfect for typical bulk sales.' 
                : 'Explores wider, highly realistic pricing vectors down to lower margins.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        {categories.map((cat) => (
          <div 
            key={cat.key} 
            className="p-4 bg-[#0c0d10] border border-[#2a2c33]/40 rounded-lg hover:border-[#d4af37]/40 transition"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border inline-block whitespace-nowrap ${cat.color}`}>
                    {cat.label}
                  </span>
                  <span className="text-[10px] bg-zinc-900 border border-zinc-800 text-[#d4af37] px-1.5 py-0.5 rounded font-mono font-medium flex items-center">
                    <PlatValue val={getPricingValue(cat.key)} size="w-2.5 h-2.5" className="text-[#d4af37]" />
                  </span>
                </div>
                <p className="text-[11px] text-[#8e9299] mt-2 min-h-[32px]">{cat.desc}</p>
              </div>
              <div className="flex flex-col items-center">
                <input
                  type="number"
                  min="0"
                  value={counts[cat.key]}
                  onChange={(e) => updateField(cat.key, parseInt(e.target.value) || 0)}
                  className="w-16 bg-[#14161c] border border-[#2a2c33] rounded text-center text-sm font-semibold p-1 hover:border-[#d4af37]/60 focus:border-[#d4af37] text-[#e0e1e6] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button 
                onClick={() => decrement(cat.key)}
                className="flex-1 bg-[#14161c] hover:bg-[#1a1c22] text-[#8e9299] hover:text-white text-xs py-1.5 rounded border border-[#2a2c33] hover:border-[#2a2c33]/80 transition active:scale-95 cursor-pointer"
              >
                -1
              </button>
              <button 
                onClick={() => increment(cat.key)}
                className="flex-1 bg-[#14161c] hover:bg-[#1a1c22] text-white text-xs py-1.5 rounded border border-[#2a2c33] hover:border-[#2a2c33]/80 transition active:scale-95 cursor-pointer"
              >
                +1
              </button>
              <button
                onClick={() => updateField(cat.key, 0)}
                className="px-2 text-[10px] text-[#8e9299] hover:text-red-400 transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-[#2a2c33] space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            placeholder="Set name (optional)..."
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            disabled={totalItems === 0}
            className="flex-1 bg-[#0c0d10] border border-[#2a2c33] hover:border-[#2a2c33]/80 focus:border-[#d4af37]/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none placeholder-zinc-600 disabled:opacity-40"
          />
          <button
            onClick={() => {
              if (onSaveToItems) {
                onSaveToItems(counts, saveName.trim() || undefined);
                setSaveName('');
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 2200);
              }
            }}
            disabled={totalItems === 0}
            className="px-3.5 py-1.5 bg-[#161820] hover:bg-[#1f222b] text-[#c4c5cc] hover:text-white border border-[#2a2c33] hover:border-[#2a2c33]/80 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:scale-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#d4af37]" />
            Save to Items
          </button>
        </div>

        {saveSuccess && (
          <div className="text-[11px] text-emerald-400 text-center animate-pulse py-0.5">
            ✓ Set saved successfully in history!
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => onChange({ bronze15: 0, bronze25: 0, silver45: 0, silver65: 0, gold: 0 })}
            className="px-4 py-2.5 text-xs font-semibold text-[#8e9299] hover:text-white border border-[#2a2c33] rounded-lg hover:bg-[#16181f] transition duration-150 cursor-pointer"
          >
            Reset All Counters
          </button>
          <button
            onClick={onCalculate}
            disabled={totalItems === 0}
            className="px-6 py-2.5 bg-[#d4af37] hover:bg-[#b08d26] text-black font-semibold text-xs rounded-lg shadow-lg flex items-center gap-2 transition duration-200 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer uppercase tracking-widest"
          >
            <TrendingUp className="w-4 h-4" />
            Analyze Expected Profits
          </button>
        </div>
      </div>
    </div>
  );
}
