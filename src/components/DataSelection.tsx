/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo } from 'react';
import { PRIME_ITEMS } from '../data/primeData';
import { PrimeItem, InventoryCount } from '../types';
import { Search, Plus, Minus, Trash2, Archive, Star, ShoppingCart, RefreshCw, Filter, Bookmark } from 'lucide-react';
import ducatIcon from '../data/480px-OrokinDucats.png';

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

interface DataSelectionProps {
  onCountsCalculated: (counts: InventoryCount) => void;
  cart: Record<string, number>;
  setCart: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  search: string;
  setSearch: (val: string) => void;
  selectedRarity: string;
  setSelectedRarity: (val: string) => void;
  selectedStatus: string;
  setSelectedStatus: (val: string) => void;
  onSaveToItems?: (counts: InventoryCount, name?: string) => void;
}

export default function DataSelection({
  onCountsCalculated,
  cart,
  setCart,
  search,
  setSearch,
  selectedRarity,
  setSelectedRarity,
  selectedStatus,
  setSelectedStatus,
  onSaveToItems
}: DataSelectionProps) {

  const [saveName, setSaveName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Filter items based on criteria
  const filteredItems = useMemo(() => {
    return PRIME_ITEMS.filter(item => {
      const matchesSearch = item.part.toLowerCase().includes(search.toLowerCase());
      
      const matchesRarity = selectedRarity === 'All' || item.rarity === selectedRarity;
      
      let matchesStatus = true;
      if (selectedStatus === 'Vaulted') matchesStatus = item.isVaulted;
      else if (selectedStatus === 'Baro') matchesStatus = item.isBaro;
      else if (selectedStatus === 'Available') matchesStatus = !item.isVaulted && !item.isBaro;

      return matchesSearch && matchesRarity && matchesStatus;
    });
  }, [search, selectedRarity, selectedStatus]);

  const addToCart = (itemName: string) => {
    setCart(prev => ({
      ...prev,
      [itemName]: (prev[itemName] || 0) + 1
    }));
  };

  const removeFromCart = (itemName: string) => {
    setCart(prev => {
      if (!prev[itemName]) return prev;
      const updated = { ...prev };
      if (updated[itemName] <= 1) {
        delete updated[itemName];
      } else {
        updated[itemName]--;
      }
      return updated;
    });
  };

  const deleteFromCart = (itemName: string) => {
    setCart(prev => {
      const updated = { ...prev };
      delete updated[itemName];
      return updated;
    });
  };

  const updateCartAmount = (itemName: string, count: number) => {
    const val = Math.max(0, count);
    setCart(prev => {
      const updated = { ...prev };
      if (val === 0) {
        delete updated[itemName];
      } else {
        updated[itemName] = val;
      }
      return updated;
    });
  };

  const clearCart = () => {
    setCart({});
  };

  // Convert selected items cart into total inventory counts
  const calculatedCounts = useMemo(() => {
    const totals: InventoryCount = {
      bronze15: 0,
      bronze25: 0,
      silver45: 0,
      silver65: 0,
      gold: 0
    };

    Object.entries(cart).forEach(([itemName, qty]) => {
      const item = PRIME_ITEMS.find(p => p.part === itemName);
      if (!item) return;
      const countNum = qty as number;

      if (item.ducat_value === 15) totals.bronze15 += countNum;
      else if (item.ducat_value === 25) totals.bronze25 += countNum;
      else if (item.ducat_value === 45) totals.silver45 += countNum;
      else if (item.ducat_value === 65) totals.silver65 += countNum;
      else if (item.ducat_value === 100) totals.gold += countNum;
    });

    return totals;
  }, [cart]);

  const loadIntoCalculator = () => {
    onCountsCalculated(calculatedCounts);
  };

  const totalCartItems = Object.values(cart).reduce((sum, q) => (sum as number) + (q as number), 0) as number;
  const totalCartDucats = Object.entries(cart).reduce((sum, [itemName, qty]) => {
    const item = PRIME_ITEMS.find(p => p.part === itemName);
    const countNum = qty as number;
    return (sum as number) + (item ? item.ducat_value * countNum : 0);
  }, 0) as number;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Search and item selection panel */}
      <div className="lg:col-span-8 bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-2xl flex flex-col space-y-4">
        <div>
          <h2 className="text-xl font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: "'Georgia', serif" }}>
            <Archive className="w-5 h-5 text-[#d4af37]" />
            Prime Parts Directory
          </h2>
          <p className="text-xs text-[#8e9299] mt-1">
            Browse, filter, and select official Prime blueprints to build your transaction set safely.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#8e9299]" />
            <input
              type="text"
              placeholder="Search e.g. Volt Prime Blueprint..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded-lg pl-9 pr-4 py-2 text-sm text-[#e0e1e6] focus:outline-none focus:border-[#d4af37]/60 placeholder-slate-600"
            />
          </div>

          <div className="flex gap-2">
            {/* Rarity selector */}
            <select
              value={selectedRarity}
              onChange={(e) => setSelectedRarity(e.target.value)}
              className="bg-[#0c0d10] border border-[#2a2c33] rounded-lg px-3 py-2 text-xs font-semibold text-[#8e9299] focus:outline-none focus:border-[#d4af37]/60"
            >
              <option value="All">All Rarities</option>
              <option value="Bronze">Bronze (Common)</option>
              <option value="Silver">Silver (Uncommon)</option>
              <option value="Gold">Gold (Rare)</option>
            </select>

            {/* Shield / Vault status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#0c0d10] border border-[#2a2c33] rounded-lg px-3 py-2 text-xs font-semibold text-[#8e9299] focus:outline-none focus:border-[#d4af37]/60"
            >
              <option value="All">All Relic Statuses</option>
              <option value="Available">Available Primes</option>
              <option value="Vaulted">Vaulted Relics (V)</option>
              <option value="Baro">Baro Exclusive (B)</option>
            </select>
          </div>
        </div>

        {/* Directory Item Grid */}
        <div className="overflow-y-auto max-h-[480px] pr-1 space-y-2 border border-[#2a2c33] bg-[#0c0d10] rounded-lg p-2">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-[#8e9299] text-sm">
              No matching prime parts found. Try adapting your filters.
            </div>
          ) : (
            filteredItems.map((item) => {
              const inCart = cart[item.part] || 0;
              return (
                <div 
                  key={item.part}
                  className="flex items-center justify-between p-3 bg-[#14161c] border border-[#2a2c33]/40 rounded-lg hover:border-[#d4af37]/40 transition gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[#e0e1e6] truncate">{item.part}</span>
                      
                      {item.isVaulted && (
                        <span className="text-[10px] bg-red-950/40 text-red-400 border border-red-900/40 px-1.5 py-0.5 rounded font-bold">
                          Vaulted (V)
                        </span>
                      )}
                      
                      {item.isBaro && (
                        <span className="text-[10px] bg-teal-950/40 text-teal-400 border border-teal-900/40 px-1.5 py-0.5 rounded font-bold">
                          Baro (B)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8e9299] mt-1 flex items-center gap-4 flex-wrap">
                      <span>Rarity: <strong className="text-[#d4af37]">{item.rarity}</strong></span>
                      <span className="flex items-center gap-1">Value: <strong className="text-[#e0e1e6] flex items-center"><DucatValue val={item.ducat_value} size="w-3.5 h-3.5" className="text-[#e0e1e6]" /></strong></span>
                      <span className="text-xs text-[#8e9299] truncate max-w-xs sm:max-w-md">
                        Relics: {item.drop_locations.slice(0, 3).join(', ')}{item.drop_locations.length > 3 ? '...' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {inCart > 0 ? (
                      <div className="flex items-center gap-1.5 bg-[#0c0d10] border border-[#2a2c33] rounded p-1">
                        <button 
                          onClick={() => removeFromCart(item.part)}
                          className="p-1 hover:bg-[#1a1c22] text-[#8e9299] hover:text-[#e0e1e6] rounded transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-[#d4af37]">{inCart}</span>
                        <button 
                          onClick={() => addToCart(item.part)}
                          className="p-1 hover:bg-[#1a1c22] text-[#8e9299] hover:text-[#e0e1e6] rounded transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item.part)}
                        className="p-1.5 bg-[#0c0d10] hover:bg-[#1a1c22] text-[#c4c5cc] hover:text-[#d4af37] rounded border border-[#2a2c33] hover:border-[#d4af37]/40 transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Cart summary side panel */}
      <div className="lg:col-span-4 bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-2xl flex flex-col space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#2a2c33]">
          <h3 className="text-lg font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: "'Georgia', serif" }}>
            <ShoppingCart className="w-5 h-5 text-[#d4af37]" />
            Selection Cart
          </h3>
          {totalCartItems > 0 && (
            <button 
              onClick={clearCart}
              className="text-[10px] text-red-400 hover:underline flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Reset All
            </button>
          )}
        </div>

        {/* Selected List */}
        <div className="flex-1 bg-[#0c0d10] border border-[#2a2c33] rounded-lg p-3 min-h-[160px] max-h-[320px] overflow-y-auto space-y-2">
          {Object.keys(cart).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#8e9299] py-8 text-center">
              <ShoppingCart className="w-8 h-8 opacity-25 mb-2 text-[#8e9299]" />
              <p className="text-xs">Your cart is empty.</p>
              <p className="text-[10px] text-[#8e9299]/70 mt-1">Select items in the directory to add them here.</p>
            </div>
          ) : (
            Object.entries(cart).map(([itemName, qty]) => {
              const item = PRIME_ITEMS.find(p => p.part === itemName);
              return (
                <div 
                  key={itemName} 
                  className="flex items-center justify-between bg-[#14161c] border border-[#2a2c33] rounded p-2 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-200 truncate">{itemName}</div>
                    <div className="text-[10px] text-[#8e9299] mt-0.5 flex items-center">
                      <DucatValue val={item ? item.ducat_value : 0} size="w-2.5 h-2.5" />&nbsp;each
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input 
                      type="number"
                      min="0"
                      value={qty}
                      onChange={(e) => updateCartAmount(itemName, parseInt(e.target.value) || 0)}
                      className="w-10 bg-[#0c0d10] border border-[#2a2c33] rounded text-center font-bold text-[#d4af37] py-0.5 focus:outline-none"
                    />
                    <button 
                      onClick={() => deleteFromCart(itemName)}
                      className="text-[#8e9299] hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart aggregation summaries */}
        <div className="bg-[#0c0d10] border border-[#2a2c33] rounded-lg p-4 space-y-3">
          <h4 className="text-xs font-bold text-[#8e9299] uppercase tracking-widest">Cart Summary</h4>
          <div className="flex justify-between text-xs">
            <span className="text-[#8e9299]">Total Items in Cart:</span>
            <span className="font-bold text-white">{totalCartItems}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#8e9299]">Aggregated Ducat Pool:</span>
            <span className="font-bold text-[#d4af37] flex items-center">
              <DucatValue val={totalCartDucats} size="w-3.5 h-3.5" className="text-[#d4af37]" />
            </span>
          </div>
          
          <div className="pt-2 border-t border-[#2a2c33]">
            <div className="text-[11px] font-bold text-[#8e9299] uppercase mb-2">Quantities split:</div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex justify-between p-1.5 border border-[#cd7f32]/40 bg-[#cd7f32]/5 text-[#8e9299] rounded">
                <span>Bronze 15:</span> <span className="font-bold text-slate-200">{calculatedCounts.bronze15}</span>
              </div>
              <div className="flex justify-between p-1.5 border border-[#cd7f32]/60 bg-[#cd7f32]/10 text-[#8e9299] rounded">
                <span>Bronze 25:</span> <span className="font-bold text-slate-200">{calculatedCounts.bronze25}</span>
              </div>
              <div className="flex justify-between p-1.5 border border-[#c0c0c0]/40 bg-[#c0c0c0]/5 text-[#8e9299] rounded">
                <span>Silver 45:</span> <span className="font-bold text-slate-200">{calculatedCounts.silver45}</span>
              </div>
              <div className="flex justify-between p-1.5 border border-[#c0c0c0]/60 bg-[#c0c0c0]/10 text-[#8e9299] rounded">
                <span>Silver 65:</span> <span className="font-bold text-slate-200">{calculatedCounts.silver65}</span>
              </div>
              <div className="flex justify-between p-1.5 border border-[#d4af37]/40 bg-[#d4af37]/5 text-[#8e9299] rounded col-span-2">
                <span>Gold 100:</span> <span className="font-bold text-slate-200">{calculatedCounts.gold}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-[#2a2c33]/70 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Set name (optional)..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              disabled={totalCartItems === 0}
              className="flex-1 min-w-0 bg-[#0c0d10] border border-[#2a2c33] hover:border-[#2a2c33]/80 focus:border-[#d4af37]/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none placeholder-zinc-600 disabled:opacity-40"
            />
            <button
              onClick={() => {
                if (onSaveToItems) {
                  onSaveToItems(calculatedCounts, saveName.trim() || undefined);
                  setSaveName('');
                  setSaveSuccess(true);
                  setTimeout(() => setSaveSuccess(false), 2200);
                }
              }}
              disabled={totalCartItems === 0}
              className="px-3.5 py-1.5 bg-[#161820] hover:bg-[#1f222b] text-[#c4c5cc] hover:text-white border border-[#2a2c33] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#d4af37]" />
              Save Set
            </button>
          </div>
          {saveSuccess && (
            <div className="text-[10px] text-emerald-400 text-center animate-pulse">
              ✓ Cart items saved to history successfully!
            </div>
          )}
        </div>

        <button
          onClick={loadIntoCalculator}
          disabled={totalCartItems === 0}
          className="w-full py-3 bg-[#d4af37] hover:bg-[#b08d26] text-black font-semibold text-xs uppercase rounded-lg shadow-xl tracking-wider transition flex items-center justify-center gap-2 duration-150 disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <RefreshCw className="w-4 h-4" />
          Sync selections to calculator
        </button>
      </div>

    </div>
  );
}
