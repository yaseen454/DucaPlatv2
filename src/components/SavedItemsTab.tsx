/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { SavedItemEntry, InventoryCount } from '../types';
import { 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  ArrowRight, 
  Bookmark, 
  Search, 
  Clock, 
  Database,
  RefreshCw,
  SlidersHorizontal,
  BookmarkX,
  TrendingUp
} from 'lucide-react';
import platinumIcon from '../data/platinum.png';
import ducatIcon from '../data/480px-OrokinDucats.png';
import AnovaPricingModal from './AnovaPricingModal';

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

interface SavedItemsTabProps {
  entries: SavedItemEntry[];
  onUseEntry: (counts: InventoryCount) => void;
  onRenameEntry: (id: string, newName: string) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onNavigateToCalculator?: () => void;
  onNavigateToSettings?: () => void;
  onUpdateEntryPrices?: (id: string, prices: InventoryCount) => void;
  narrowConfig?: any;
  broadConfig?: any;
}

export default function SavedItemsTab({
  entries,
  onUseEntry,
  onRenameEntry,
  onDeleteEntry,
  onClearAll,
  onNavigateToCalculator,
  onNavigateToSettings,
  onUpdateEntryPrices,
  narrowConfig,
  broadConfig
}: SavedItemsTabProps) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'directory' | 'ocr' | 'trades'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'parts' | 'ducats'>('newest');
  
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pricing configuration modal state
  const [selectedEntryForPricing, setSelectedEntryForPricing] = useState<SavedItemEntry | null>(null);

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingText(currentName);
  };

  const saveRename = (id: string) => {
    if (editingText.trim()) {
      onRenameEntry(id, editingText.trim());
    }
    setEditingId(null);
  };

  // Filter & sort list
  const processedEntries = React.useMemo(() => {
    let result = [...entries];

    // Filter search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => item.name.toLowerCase().includes(q));
    }

    // Filter source
    if (sourceFilter !== 'all') {
      result = result.filter(item => item.source === sourceFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return Number(b.id) - Number(a.id); // timestamp sorting via ID
      }
      if (sortBy === 'oldest') {
        return Number(a.id) - Number(b.id);
      }
      if (sortBy === 'parts') {
        return b.totalItems - a.totalItems;
      }
      if (sortBy === 'ducats') {
        return b.totalDucats - a.totalDucats;
      }
      return 0;
    });

    return result;
  }, [entries, search, sourceFilter, sortBy]);

  const sourceLabels = {
    manual: { text: "Manual Entry", style: "border-[#cd7f32]/30 bg-[#cd7f32]/10 text-orange-400" },
    directory: { text: "Directory Selection", style: "border-sky-500/30 bg-sky-950/20 text-sky-400" },
    ocr: { text: "Image Scan", style: "border-[#d4af37]/30 bg-[#d4af37]/10 text-[#d4af37]" },
    trades: { text: "Trade Preset", style: "border-emerald-600/30 bg-emerald-950/20 text-emerald-400 font-extrabold" }
  };

  return (
    <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-2xl space-y-6">
      
      {/* Tab Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-[#2a2c33] gap-4">
        <div>
          <h2 className="text-xl font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: "'Georgia', serif" }}>
            <Bookmark className="w-5 h-5 text-[#d4af37]" />
            Saved Inventories History
          </h2>
          <p className="text-xs text-[#8e9299] mt-1">
            Browse and activate previous calculator setups or scanned sessions cached in your local environment.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
          {onNavigateToCalculator && (
            <button
              type="button"
              onClick={onNavigateToCalculator}
              className="px-4 py-2 bg-[#d4af37]/10 hover:bg-[#d4af37]/20 active:bg-[#d4af37]/35 text-[#d4af37] border border-[#d4af37]/30 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer select-none active:scale-95"
            >
              Go To Calculator ➔
            </button>
          )}

          {entries.length > 0 && (
            <div className="flex items-center gap-2">
              {showConfirm ? (
                <div className="flex items-center gap-1.5 bg-[#1c0c0e] border border-red-900/50 rounded-lg p-1.5 transition-all duration-150">
                  <span className="text-[10px] text-red-400 px-2 uppercase font-mono tracking-wider">Are you sure?</span>
                  <button
                    onClick={() => {
                      onClearAll();
                      setShowConfirm(false);
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold uppercase transition cursor-pointer"
                  >
                    Yes, Clear
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-bold uppercase transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowConfirm(true)}
                  className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition duration-150 select-none uppercase tracking-wider cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All History
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        /* Empty History State */
        <div className="py-16 text-center text-zinc-500 flex flex-col items-center justify-center space-y-4 bg-[#0c0d10]/30 rounded-xl border border-dashed border-[#2a2c33]">
          <BookmarkX className="w-14 h-14 text-zinc-700 animate-pulse" />
          <div className="max-w-md">
            <h4 className="text-slate-300 font-semibold text-sm">No saved inventories available</h4>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              When entering components manually, picking them from the search directory, or executing Image scans (powered by Gemini AI & local Native OCR), click the <strong className="text-zinc-400">"Save Set"</strong> indicator to lock down subsets for quick back-and-forth comparison.
            </p>
          </div>
        </div>
      ) : (
        /* List with Filters */
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-[#0c0d10]/70 p-3 rounded-lg border border-[#2a2c33]/60">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Find inventory entries by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#14161c] border border-[#2a2c33] rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#d4af37]/60"
              />
            </div>

            {/* Filter Source dropdown */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-1 bg-[#14161c] px-2 py-1 rounded border border-[#2a2c33]">
                <SlidersHorizontal className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] uppercase text-[#8e9299]">Filter:</span>
              </div>
              <select
                value={sourceFilter}
                onChange={(e: any) => setSourceFilter(e.target.value)}
                className="bg-[#14161c] border border-[#2a2c33] rounded px-2.5 py-1 text-xs text-[#c4c5cc] focus:outline-none focus:border-[#d4af37]/60 cursor-pointer"
              >
                <option value="all">All Sources</option>
                <option value="manual">Manual inputs only</option>
                <option value="directory">Directory selections only</option>
                <option value="ocr">Image scans only</option>
                <option value="trades">Trade presets only</option>
              </select>

              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-[#14161c] border border-[#2a2c33] rounded px-2.5 py-1 text-xs text-[#c4c5cc] focus:outline-none focus:border-[#d4af37]/60"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="parts">Largest part counts</option>
                <option value="ducats">Largest ducat pool</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-[#8e9299] flex justify-between items-center px-1">
            <span>Showing {processedEntries.length} of {entries.length} saves</span>
            <span>Local cached lists</span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-4">
            {processedEntries.map((entry) => {
              const labelConfig = sourceLabels[entry.source] || { text: "Saved State", style: "border-zinc-800 bg-zinc-900" };
              const isEditing = editingId === entry.id;

              return (
                <div 
                  key={entry.id}
                  className="bg-[#0c0d10] border border-[#2a2c33]/70 hover:border-[#d4af37]/40 rounded-xl p-4 sm:p-5 transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
                >
                  {/* Left segment info */}
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-extrabold tracking-wider ${labelConfig.style}`}>
                        {labelConfig.text}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {entry.timestamp}
                      </span>
                    </div>

                    {isEditing ? (
                      /* Editing Input state */
                      <div className="flex items-center gap-1.5 max-w-md pt-1">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveRename(entry.id)}
                          className="bg-[#14161c] border border-[#d4af37]/60 rounded px-2.5 py-1 text-xs text-white focus:outline-none w-full"
                          autoFocus
                        />
                        <button 
                          onClick={() => saveRename(entry.id)}
                          className="p-1 px-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900/40 rounded transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className="p-1 px-1.5 bg-red-950/40 hover:bg-red-aa text-red-400 border border-red-900/40 rounded transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Normal text state */
                      <div className="flex items-center gap-2 pt-1 group">
                        <h3 
                          className="text-base font-medium text-slate-200 truncate cursor-pointer hover:text-white"
                          onClick={() => startRename(entry.id, entry.name)}
                          title="Click to rename"
                        >
                          {entry.name}
                        </h3>
                        <button 
                          onClick={() => startRename(entry.id, entry.name)}
                          className="text-zinc-500 hover:text-[#d4af37] opacity-0 group-hover:opacity-100 transition duration-150 p-1"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Breakdown distribution display */}
                    {(() => {
                      const entryPrices = entry.prices || { bronze15: 1, bronze25: 2, silver45: 3, silver65: 5, gold: 8 };
                      const totalPlatValue = entry.counts.bronze15 * entryPrices.bronze15 +
                                             entry.counts.bronze25 * entryPrices.bronze25 +
                                             entry.counts.silver45 * entryPrices.silver45 +
                                             entry.counts.silver65 * entryPrices.silver65 +
                                             entry.counts.gold * entryPrices.gold;

                      return (
                        <div className="space-y-2 pt-1">
                          <div className="text-[10px] text-zinc-500 font-mono">
                            Assigned Rarity Pricing Distribution:
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-2xl">
                            <div className="bg-[#14161c]/40 border border-[#cd7f32]/25 rounded p-1.5 px-2 text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-[#cd7f32]">B15</span>
                              <strong className="text-zinc-200 font-mono text-xs">{entry.counts.bronze15}</strong>
                              <span className="block text-[8px] text-zinc-500 font-mono mt-0.5">@{entryPrices.bronze15}p</span>
                            </div>
                            <div className="bg-[#14161c]/40 border border-[#cd7f32]/45 rounded p-1.5 px-2 text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-[#cd7f32]">B25</span>
                              <strong className="text-zinc-200 font-mono text-xs">{entry.counts.bronze25}</strong>
                              <span className="block text-[8px] text-zinc-500 font-mono mt-0.5">@{entryPrices.bronze25}p</span>
                            </div>
                            <div className="bg-[#14161c]/40 border border-[#c0c0c0]/25 rounded p-1.5 px-2 text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-[#c0c0c0]">S45</span>
                              <strong className="text-zinc-200 font-mono text-xs">{entry.counts.silver45}</strong>
                              <span className="block text-[8px] text-zinc-500 font-mono mt-0.5">@{entryPrices.silver45}p</span>
                            </div>
                            <div className="bg-[#14161c]/40 border border-[#c0c0c0]/45 rounded p-1.5 px-2 text-center">
                              <span className="block text-[8px] uppercase tracking-wider text-[#c0c0c0]">S65</span>
                              <strong className="text-zinc-200 font-mono text-xs">{entry.counts.silver65}</strong>
                              <span className="block text-[8px] text-zinc-500 font-mono mt-0.5">@{entryPrices.silver65}p</span>
                            </div>
                            <div className="bg-[#14161c]/40 border border-[#d4af37]/35 rounded p-1.5 px-2 text-center col-span-2 sm:col-span-1">
                              <span className="block text-[8px] uppercase tracking-wider text-[#d4af37]">G100</span>
                              <strong className="text-zinc-200 font-mono text-xs">{entry.counts.gold}</strong>
                              <span className="block text-[8px] text-zinc-500 font-mono mt-0.5">@{entryPrices.gold}p</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Quantitative aggregates & buttons right segment */}
                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-[#2a2c33]/40 pt-3 md:pt-0 gap-3 min-w-[210px] shrink-0">
                    <div className="space-y-1 text-left md:text-right">
                      <div className="text-xs text-[#8e9299] flex items-center gap-1.5 md:justify-end">
                        Total items: <strong className="text-white font-mono">{entry.totalItems}</strong>
                      </div>
                      <div className="text-xs text-[#8e9299] flex items-center gap-1.5 md:justify-end">
                        Ducats: <strong className="text-[#d4af37] flex items-center"><DucatValue val={entry.totalDucats} size="w-3.5 h-3.5" className="text-[#d4af37]" /></strong>
                      </div>
                      {(() => {
                        const entryPrices = entry.prices || { bronze15: 1, bronze25: 2, silver45: 3, silver65: 5, gold: 8 };
                        const totalPlatValue = entry.counts.bronze15 * entryPrices.bronze15 +
                                               entry.counts.bronze25 * entryPrices.bronze25 +
                                               entry.counts.silver45 * entryPrices.silver45 +
                                               entry.counts.silver65 * entryPrices.silver65 +
                                               entry.counts.gold * entryPrices.gold;
                        return (
                          <div className="text-xs text-[#8e9299] flex items-center gap-1.5 md:justify-end">
                            Est. Plat Yield: <strong className="text-emerald-400 flex items-center"><PlatValue val={totalPlatValue} size="w-3.5 h-3.5" className="text-emerald-400 font-bold" /></strong>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2">
                      {deletingId === entry.id ? (
                        <div className="flex items-center gap-1.5 bg-[#1c0c0e] border border-red-900/50 rounded-lg p-1.5 transition-all duration-150">
                          <span className="text-[10px] text-red-400 px-1.5 uppercase font-mono tracking-wider font-semibold">Delete?</span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteEntry(entry.id);
                              setDeletingId(null);
                            }}
                            className="px-2 py-1 bg-red-650 hover:bg-red-550 text-white rounded text-[9px] font-bold uppercase transition select-none cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[9px] font-bold uppercase transition select-none cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setDeletingId(entry.id)}
                            className="p-2 text-zinc-500 hover:text-red-400 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-lg transition duration-150 cursor-pointer"
                            title="Delete saved set"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedEntryForPricing(entry)}
                            className="p-2 text-[#d4af37] bg-[#d4af37]/5 hover:bg-[#d4af37]/15 border border-[#d4af37]/25 hover:border-[#d4af37]/45 rounded-lg transition duration-150 cursor-pointer"
                            title="Set individual rarity prices or run ANOVA patterns"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onUseEntry(entry.counts)}
                            className="px-4 py-2 bg-[#d4af37] hover:bg-[#b08d26] text-black font-semibold text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                          >
                            Use in Calculator
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {selectedEntryForPricing && (
        <AnovaPricingModal
          isOpen={true}
          onClose={() => setSelectedEntryForPricing(null)}
          title={selectedEntryForPricing.name}
          counts={selectedEntryForPricing.counts}
          initialPrices={selectedEntryForPricing.prices}
          narrowConfig={narrowConfig}
          broadConfig={broadConfig}
          onNavigateToSettings={onNavigateToSettings}
          onApplyPrices={(prices) => {
            if (onUpdateEntryPrices) {
              onUpdateEntryPrices(selectedEntryForPricing.id, prices);
            }
          }}
        />
      )}

    </div>
  );
}
