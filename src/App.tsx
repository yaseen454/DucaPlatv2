/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryCount, OcrResultItem, SavedItemEntry } from './types';
import { generateCostsCustom } from './utils/mathUtils';
import ManualInput from './components/ManualInput';
import DataSelection from './components/DataSelection';
import ClipboardOCR from './components/ClipboardOCR';
import AnalysisResults from './components/AnalysisResults';
import AboutInfo from './components/AboutInfo';
import SettingsTab from './components/SettingsTab';
import SavedItemsTab from './components/SavedItemsTab';
import { PRIME_ITEMS } from './data/primeData';
import { 
  Coins, 
  Settings, 
  HelpCircle, 
  Clipboard, 
  Compass, 
  Search, 
  Sparkles, 
  AlertTriangle,
  Github,
  BookOpen,
  ShieldAlert,
  Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './context/AuthContext';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [counts, setCounts] = useState<InventoryCount>({
    bronze15: 0,
    bronze25: 0,
    silver45: 0,
    silver65: 0,
    gold: 0
  });

  // Persistent OCR scanner states to prevent session loss on tab-change
  const [ocrShowGuide, setOcrShowGuide] = useState<boolean>(true);
  const [ocrGuideTab, setOcrGuideTab] = useState<'real' | 'diagram'>('real');
  const [ocrImageFile, setOcrImageFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrItems, setOcrItems] = useState<OcrResultItem[]>([]);
  const [ocrFeedback, setOcrFeedback] = useState<string | null>(null);

  // Persistent Directory Selection cart/filter states to prevent session loss on tab-change
  const [dirCart, setDirCart] = useState<Record<string, number>>({});
  const [dirSearch, setDirSearch] = useState<string>('');
  const [dirRarity, setDirRarity] = useState<string>('All');
  const [dirStatus, setDirStatus] = useState<string>('All');

  // Parameter states
  const [calcType, setCalcType] = useState<1 | 2>(1); // 1 = narrow, 2 = broad
  const [enablePlot, setEnablePlot] = useState<boolean>(true);
  const [displayAnova, setDisplayAnova] = useState<boolean>(false);

  // Directory search states
  const [dbSearch, setSearch] = useState('');
  const [vaultFilter, setVaultFilter] = useState<'All' | 'Vaulted' | 'Available'>('All');

  // Directory items list filtered
  const filteredDbItems = useMemo(() => {
    return PRIME_ITEMS.filter(item => {
      const matchText = item.part.toLowerCase().includes(dbSearch.toLowerCase());
      const matchVault = vaultFilter === 'All' || 
                        (vaultFilter === 'Vaulted' && item.isVaulted) ||
                        (vaultFilter === 'Available' && !item.isVaulted);
      return matchText && matchVault;
    });
  }, [dbSearch, vaultFilter]);

  // Dynamic settings configuration loaded/stored in localStorage
  const [narrowConfig, setNarrowConfigState] = useState(() => {
    try {
      const saved = localStorage.getItem('ducaplat_custom_narrow_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      b15: 1,
      b25: { min: 1, max: 2 },
      s45: { min: 2, max: 4 },
      s65: { min: 4, max: 7 },
      g: { min: 7, max: 10 }
    };
  });

  const [broadConfig, setBroadConfigState] = useState(() => {
    try {
      const saved = localStorage.getItem('ducaplat_custom_broad_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      b15: 1,
      b25: { min: 1, max: 2 },
      s45: { min: 2, max: 4 },
      s65: { min: 2, max: 7 },
      g: { min: 5, max: 10 }
    };
  });

  const setNarrowConfig = (cfg: any) => {
    setNarrowConfigState(cfg);
    try {
      localStorage.setItem('ducaplat_custom_narrow_v2', JSON.stringify(cfg));
    } catch (e) {}
  };

  const setBroadConfig = (cfg: any) => {
    setBroadConfigState(cfg);
    try {
      localStorage.setItem('ducaplat_custom_broad_v2', JSON.stringify(cfg));
    } catch (e) {}
  };

  // Active credentials and escape-hatch states loaded securely from Auth Context
  const {
    user,
    initializing,
    authError,
    setAuthError,
    signInWithGoogle,
    logout,
    isWebView,
    showWebViewOverlay,
    setShowWebViewOverlay
  } = useAuth();

  // State for persistent "Saved Items" tab histories
  const [savedInventories, setSavedInventories] = useState<SavedItemEntry[]>([]);

  // Cloud/Offline Synchronization Engine (Rule 4: Snapshot cleanups dynamically managed)
  useEffect(() => {
    if (initializing) return;

    if (user) {
      let active = true;
      let unsubscribe: (() => void) | null = null;

      const initFirestoreSync = async () => {
        try {
          const { collection, onSnapshot, query, orderBy } = await import("firebase/firestore");
          const savedItemsRef = collection(db, "users", user.uid, "savedItems");
          const q = query(savedItemsRef, orderBy("id", "desc"));

          if (!active) return;

          unsubscribe = onSnapshot(q, (snapshot) => {
            const items: SavedItemEntry[] = [];
            snapshot.forEach((doc) => {
              items.push(doc.data() as SavedItemEntry);
            });
            setSavedInventories(items);
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}/savedItems`);
          });
        } catch (err) {
          console.error("Failed setting up active subcollection sync: ", err);
        }
      };

      initFirestoreSync();

      return () => {
        active = false;
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } else {
      // Offline fallback state hydration
      try {
        const saved = localStorage.getItem('ducaplat_saved_inventories');
        if (saved) {
          setSavedInventories(JSON.parse(saved));
        } else {
          setSavedInventories([]);
        }
      } catch (e) {
        setSavedInventories([]);
      }
    }
  }, [user, initializing]);

  // Synchronous State race safe write operations (Rule 1: auth.currentUser direct lookups)
  const handleSaveToItems = async (countsToSave: InventoryCount, customName?: string, source: 'manual' | 'directory' | 'ocr' = 'manual') => {
    const totalItems = countsToSave.bronze15 + countsToSave.bronze25 + countsToSave.silver45 + countsToSave.silver65 + countsToSave.gold;
    if (totalItems === 0) return;

    const totalDucats = countsToSave.bronze15 * 15 + countsToSave.bronze25 * 25 + countsToSave.silver45 * 45 + countsToSave.silver65 * 65 + countsToSave.gold * 100;

    const dateStr = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const defaultName = `${source === 'manual' ? 'Manual Input' : source === 'directory' ? 'Directory Select' : 'Gemini Scan'} (${totalItems} items) — ${dateStr}`;

    const newId = Date.now().toString();
    const newEntry: SavedItemEntry = {
      id: newId,
      name: customName || defaultName,
      source,
      counts: countsToSave,
      timestamp: dateStr,
      totalDucats,
      totalItems
    };

    const currentAuthUser = auth.currentUser;
    if (currentAuthUser) {
      try {
        const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
        const docRef = doc(db, "users", currentAuthUser.uid, "savedItems", newId);
        await setDoc(docRef, {
          ...newEntry,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentAuthUser.uid}/savedItems/${newId}`);
      }
    } else {
      const updated = [newEntry, ...savedInventories];
      setSavedInventories(updated);
      try {
        localStorage.setItem('ducaplat_saved_inventories', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleUseSavedInventory = (selectedCounts: InventoryCount) => {
    setCounts(selectedCounts);
    setActiveTab('Calculator');
  };

  const handleRenameSavedInventory = async (id: string, newName: string) => {
    const currentAuthUser = auth.currentUser;
    if (currentAuthUser) {
      try {
        const { doc, updateDoc } = await import("firebase/firestore");
        const docRef = doc(db, "users", currentAuthUser.uid, "savedItems", id);
        await updateDoc(docRef, { name: newName });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${currentAuthUser.uid}/savedItems/${id}`);
      }
    } else {
       const updated = savedInventories.map(item => item.id === id ? { ...item, name: newName } : item);
       setSavedInventories(updated);
       try {
         localStorage.setItem('ducaplat_saved_inventories', JSON.stringify(updated));
       } catch (e) {}
    }
  };

  const handleDeleteSavedInventory = async (id: string) => {
    const currentAuthUser = auth.currentUser;
    if (currentAuthUser) {
      try {
        const { doc, deleteDoc } = await import("firebase/firestore");
        const docRef = doc(db, "users", currentAuthUser.uid, "savedItems", id);
        await deleteDoc(docRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${currentAuthUser.uid}/savedItems/${id}`);
      }
    } else {
      const updated = savedInventories.filter(item => item.id !== id);
      setSavedInventories(updated);
      try {
        localStorage.setItem('ducaplat_saved_inventories', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleClearAllSavedInventories = async () => {
    const currentAuthUser = auth.currentUser;
    if (currentAuthUser) {
      try {
        const { doc, deleteDoc } = await import("firebase/firestore");
        for (const item of savedInventories) {
          const docRef = doc(db, "users", currentAuthUser.uid, "savedItems", item.id);
          await deleteDoc(docRef);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${currentAuthUser.uid}/savedItems`);
      }
    } else {
      setSavedInventories([]);
      try {
        localStorage.removeItem('ducaplat_saved_inventories');
      } catch (e) {}
    }
  };


  // Derived price list based on customizable configs
  const baseCosts = useMemo(() => {
    const config = calcType === 1 ? narrowConfig : broadConfig;
    return generateCostsCustom(config);
  }, [calcType, narrowConfig, broadConfig]);

  const totalCount = counts.bronze15 + counts.bronze25 + counts.silver45 + counts.silver65 + counts.gold;

  const handleSyncedCounts = (newCounts: InventoryCount) => {
    setCounts(newCounts);
    setActiveTab('Calculator');
  };

  // Rule 3: Enforce beautiful loading block until auth-sync initializes
  if (initializing) {
    return (
      <div className="min-h-screen bg-[#0c0d10] text-[#e0e1e6] flex flex-col items-center justify-center font-sans antialiased">
        <div className="text-center space-y-6 max-w-sm flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-t-transparent border-[#d4af37] animate-spin"></div>
            <div className="absolute w-10 h-10 rounded-full border border-dashed border-[#d4af37]/30 animate-pulse"></div>
          </div>
          <div className="space-y-1.5 animate-pulse">
            <h1 className="text-2xl font-light tracking-[0.3em] text-[#d4af37] uppercase" style={{ fontFamily: "'Georgia', serif" }}>
              DUCAPLAT
            </h1>
            <p className="text-[9px] uppercase tracking-[0.4em] text-[#8e9299]">Synthesizing Void Flux...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0d10] text-[#e0e1e6] flex flex-col font-sans antialiased text-sm">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-[#0c0d10]/95 backdrop-blur border-b border-[#2a2c33] px-4 md:px-8 py-5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3.5">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl md:text-3xl font-light tracking-widest text-[#d4af37]" style={{ fontFamily: "'Georgia', serif" }}>
                DUCAPLAT
              </h1>
              <span className="text-[9px] md:text-[10px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-1.5 py-0.5 rounded-sm font-semibold tracking-wide uppercase">
                PRO v2.0
              </span>
            </div>
            <p className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-[#8e9299] mt-1.5">Void Market Efficiency Analytics</p>
          </div>
        </div>

        {/* Dynamic metrics widget styled exactly with the design's elegant text-center rows */}
        <div className="flex items-center gap-4 md:gap-8">
          <div className="hidden lg:flex gap-8 items-center border-r border-[#2a2c33]/40 pr-8">
            <div className="text-center">
              <span className="block text-[10px] text-[#8e9299] uppercase tracking-wider mb-1">Market Volatility</span>
              <span className="text-emerald-400 font-mono text-xs font-medium">+2.4% LOW</span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-[#8e9299] uppercase tracking-wider mb-1">Active Inventory</span>
              <span className="text-white font-mono text-xs font-medium">{totalCount} Parts</span>
            </div>
            <div className="text-center">
              <span className="block text-[10px] text-[#8e9299] uppercase tracking-wider mb-1">Total Ducat Pool</span>
              <span className="text-[#d4af37] font-mono text-xs font-medium">
                {counts.bronze15*15 + counts.bronze25*25 + counts.silver45*45 + counts.silver65*65 + counts.gold*100}
              </span>
            </div>
          </div>

          {/* User authentication states block - Premium Orokin styling */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="https://github.com/yaseen454/DucaPlatv2"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 md:p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-[#d4af37] border border-[#2a2c33] hover:border-[#d4af37]/30 rounded-lg transition-all duration-150 flex items-center justify-center"
              title="GitHub Repository"
            >
              <Github className="w-4 h-4" />
            </a>

            {user ? (
              <div className="flex items-center gap-2.5 bg-[#111317] border border-[#d4af37]/20 p-1 pl-2.5 pr-2.5 md:pl-3 md:pr-3.5 rounded-lg">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || "User"} 
                    className="w-6 h-6 md:w-7 md:h-7 rounded-full border border-[#d4af37]/30 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                    {(user.displayName || user.email || "U")[0]}
                  </div>
                )}
                <div className="text-left hidden md:block">
                  <span className="block text-[8px] text-[#8e9299] uppercase tracking-widest leading-none mb-0.5">Cloud Synced</span>
                  <span className="block text-[11px] text-zinc-100 max-w-[100px] truncate leading-none font-medium">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={logout}
                  className="px-2 py-0.5 md:py-1 text-[8px] md:text-[9px] font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 rounded transition-all uppercase tracking-wider select-none shrink-0"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-[#d4af37]/10 hover:bg-[#d4af37] text-[#d4af37] hover:text-black border border-[#d4af37]/30 hover:border-transparent rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider transition duration-150 flex items-center gap-1.5 md:gap-2 select-none"
              >
                <span className="w-4 h-4 bg-white text-black font-extrabold flex items-center justify-center text-[10px] rounded-full shrink-0">G</span>
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main navigation ribbon */}
      <div className="flex justify-center border-b border-[#2a2c33] bg-[#0c0d10] px-2 sm:px-4 py-1">
        <nav className="flex flex-wrap sm:flex-nowrap max-w-7xl w-full justify-center gap-1 sm:gap-1.5 md:gap-2">
          {[
            { id: 'Home', label: 'Welcome', icon: Compass },
            { id: 'Calculator', label: 'Calculator', icon: Coins },
            { id: 'DataSelection', label: 'Directory', icon: Search },
            { id: 'OCR', label: 'Gemini Scan', icon: Clipboard },
            { id: 'SavedItems', label: 'Saved Items', icon: Bookmark },
            { id: 'Settings', label: 'Settings', icon: Settings },
            { id: 'Help', label: 'Guide', icon: HelpCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-2.5 sm:px-3 md:px-4 py-2 sm:py-3 text-[10px] sm:text-[11px] md:text-xs font-semibold flex items-center gap-1.5 border-b-2 transition duration-200 select-none flex-shrink-0 uppercase tracking-wider ${
                  active 
                    ? 'border-[#d4af37] text-[#d4af37] bg-[#d4af37]/5' 
                    : 'border-transparent text-[#8e9299] hover:text-[#e0e1e6] hover:bg-[#1a1c22]/30'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 md:w-3.5 md:h-3.5 ${active ? 'text-[#d4af37]' : 'text-[#8e9299]'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab Workspace Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 transition-all duration-300">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'Home' && (
              <div className="space-y-6">
                {/* Hero Card */}
                <div className="p-8 rounded-xl bg-[#14161c] border border-[#2a2c33] relative overflow-hidden shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="absolute right-0 top-0 w-96 h-96 bg-[#d4af37]/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="space-y-4 max-w-2xl relative z-10">
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 bg-[#d4af37]/10 rounded border border-[#d4af37]/20 text-[#d4af37]">
                      Market Intelligence Tool
                    </span>
                    <h2 className="text-3xl font-light tracking-tight text-white leading-tight" style={{ fontFamily: "'Georgia', serif" }}>
                      Find the absolute maximum profitability from your Prime Junk inventory.
                    </h2>
                    <p className="text-sm text-[#c4c5cc] antialiased leading-relaxed">
                      DucaPlat is a statistics engine built to optimize warframe prime drop trading. We scan, group, and run analysis of variance on your parts across 216 pricing vectors to verify expected yields.
                    </p>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setActiveTab('Calculator')}
                        className="px-5 py-2.5 bg-[#d4af37] hover:bg-[#b08d26] text-black font-semibold text-xs rounded-md shadow-md transition select-none cursor-pointer uppercase tracking-widest"
                      >
                        Launch Calculator
                      </button>
                      <button
                        onClick={() => setActiveTab('OCR')}
                        className="px-5 py-2.5 bg-[#0c0d10] hover:bg-[#1a1c22] text-[#c4c5cc] hover:text-white rounded-md border border-[#2a2c33] font-semibold text-xs transition uppercase tracking-widest"
                      >
                        Try Gemini OCR Scan
                      </button>
                    </div>
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="p-5 bg-[#0c0d10] border border-[#2a2c33] rounded-lg space-y-4 w-full md:w-72 relative z-10 flex flex-col justify-between shadow-inner">
                    <div>
                      <span className="text-[10px] text-[#8e9299] uppercase tracking-widest font-bold block mb-1">Parts Database</span>
                      <div className="text-3xl font-light text-[#d4af37] font-mono">{PRIME_ITEMS.length} ITEMS</div>
                      <p className="text-[11px] text-[#8e9299] mt-1.5 leading-relaxed">Directly sourced, mapped, and updated index including Vaulted status.</p>
                    </div>
                    <div className="pt-3 border-t border-[#2a2c33] flex justify-between items-center text-xs">
                      <span className="text-[#8e9299]">Vaulted Relics Ratio:</span>
                      <strong className="text-red-400 font-bold">
                        {Math.round((PRIME_ITEMS.filter(i => i.isVaulted).length / PRIME_ITEMS.length) * 100)}%
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Quick Info Deck */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-5 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-2.5">
                    <h3 className="font-semibold text-sm text-[#e0e1e6] flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
                      <Sparkles className="w-4 h-4 text-[#d4af37]" />
                      GEMINI VISION OCR SCAN
                    </h3>
                    <p className="text-xs text-[#8e9299] leading-relaxed">
                      Don't waste time looking up each part's tier. Take screenshots of your transaction window, paste them in, and our server-side LLM parses counts and matches names perfectly.
                    </p>
                  </div>
                  <div className="p-5 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-2.5">
                    <h3 className="font-semibold text-sm text-[#d4af37] flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
                      <Coins className="w-4 h-4 text-[#d4af37]" />
                      ANOVA STATISTICAL VARIANCE
                    </h3>
                    <p className="text-xs text-[#8e9299] leading-relaxed">
                      By running Analysis of Variance across different pricing sets, we verify if certain pricing methods have significantly higher yield averages, showing you which strategies actually make a difference.
                    </p>
                  </div>
                  <div className="p-5 bg-[#14161c] border border-[#2a2c33] rounded-xl space-y-2.5">
                    <h3 className="font-semibold text-sm text-[#e0e1e6] flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
                      <BookOpen className="w-4 h-4 text-[#d4af37]" />
                      TUKEY HSD PAIRINGS
                    </h3>
                    <p className="text-xs text-[#8e9299] leading-relaxed">
                      Verify difference yields among separate buyer portfolios using Turkey's Honest Significant Difference post-hoc pairings. We output detailed, mathematically proven confidence limits.
                    </p>
                  </div>
                </div>

                {/* Searchable reference table list */}
                <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-light text-white" style={{ fontFamily: "'Georgia', serif" }}>Item Catalog</h3>
                      <p className="text-xs text-[#8e9299] mt-0.5">Filter and look up items to verify their rarity tiers, relic lists, and prices.</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Search items..." 
                        value={dbSearch}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-[#0c0d10] border border-[#2a2c33] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#d4af37]/60"
                      />
                      <select
                        value={vaultFilter}
                        onChange={(e: any) => setVaultFilter(e.target.value)}
                        className="bg-[#0c0d10] border border-[#2a2c33] rounded px-3 py-1.5 text-xs font-semibold text-[#8e9299] focus:outline-none focus:border-[#d4af37]/60"
                      >
                        <option value="All">All Items</option>
                        <option value="Vaulted">Vaulted Only</option>
                        <option value="Available">Available Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded border border-[#2a2c33] max-h-[300px]">
                    <table className="w-full text-left text-xs bg-[#0c0d10]/40 divide-y divide-[#2a2c33] text-[#c4c5cc]">
                      <thead className="bg-[#0c0d10] font-bold text-[10px] text-[#8e9299] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Prime Part Name</th>
                          <th className="px-4 py-3">Ducat Value</th>
                          <th className="px-4 py-3">Calculated Tier</th>
                          <th className="px-4 py-3">Relic State</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2c33]">
                        {filteredDbItems.map((item) => (
                          <tr key={item.part} className="hover:bg-[#1a1c22]/40 transition">
                            <td className="px-4 py-2.5 font-medium text-white">{item.part}</td>
                            <td className="px-4 py-2.5 text-[#d4af37] font-bold">{item.ducat_value}</td>
                            <td className="px-4 py-2.5 text-[#8e9299]">{item.rarity}</td>
                            <td className="px-4 py-2.5">
                              {item.isVaulted ? (
                                <span className="text-[9px] bg-red-950/40 border border-red-900/60 text-red-500 px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider">Vaulted</span>
                              ) : item.isBaro ? (
                                <span className="text-[9px] bg-teal-950/40 border border-teal-900/60 text-teal-400 px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider">Baro</span>
                              ) : (
                                <span className="text-[9px] bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider">Active</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Calculator' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Parameter & settings panel */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Inventory Rarity Overview Scorecard */}
                  <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#2a2c33]/50 pb-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#8e9299]">
                        Inventory Distribution
                      </h4>
                      <span className="text-[10px] bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-2 py-0.5 rounded font-mono font-bold">
                        {totalCount} Total Parts
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Bronze Common Category */}
                      <div className="bg-[#0c0d10] border border-[#cd7f32]/20 rounded-lg p-3 space-y-2 relative overflow-hidden">
                        <div className="absolute right-3 top-3 w-16 h-16 bg-[#cd7f32]/5 rounded-full blur-xl pointer-events-none" />
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#cd7f32]" />
                            <span className="text-xs font-semibold text-white">Bronze Tiers (Common)</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#cd7f32]">
                            {counts.bronze15 + counts.bronze25} parts
                          </span>
                        </div>
                        {/* Sub values breakdown */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-[#8e9299] pt-1 border-t border-[#2a2c33]/30">
                          <div>
                            <span className="block font-mono text-zinc-400 font-bold">15 Ducats</span>
                            <span className="text-white font-mono">{counts.bronze15} parts</span>
                          </div>
                          <div>
                            <span className="block font-mono text-zinc-400 font-bold">25 Ducats</span>
                            <span className="text-white font-mono">{counts.bronze25} parts</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-[#8e9299]">
                          <span>Ducats Contribution:</span>
                          <span className="font-mono text-zinc-300 font-bold">{counts.bronze15 * 15 + counts.bronze25 * 25} D</span>
                        </div>
                      </div>

                      {/* Silver Uncommon Category */}
                      <div className="bg-[#0c0d10] border border-[#c0c0c0]/20 rounded-lg p-3 space-y-2 relative overflow-hidden">
                        <div className="absolute right-3 top-3 w-16 h-16 bg-[#c0c0c0]/5 rounded-full blur-xl pointer-events-none" />
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#c0c0c0]" />
                            <span className="text-xs font-semibold text-white">Silver Tiers (Uncommon)</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#c0c0c0]">
                            {counts.silver45 + counts.silver65} parts
                          </span>
                        </div>
                        {/* Sub values breakdown */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-[#8e9299] pt-1 border-t border-[#2a2c33]/30">
                          <div>
                            <span className="block font-mono text-zinc-400 font-bold">45 Ducats</span>
                            <span className="text-white font-mono">{counts.silver45} parts</span>
                          </div>
                          <div>
                            <span className="block font-mono text-zinc-400 font-bold">65 Ducats</span>
                            <span className="text-white font-mono">{counts.silver65} parts</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-[#8e9299]">
                          <span>Ducats Contribution:</span>
                          <span className="font-mono text-zinc-300 font-bold">{counts.silver45 * 45 + counts.silver65 * 65} D</span>
                        </div>
                      </div>

                      {/* Gold Rare Category */}
                      <div className="bg-[#0c0d10] border border-[#d4af37]/20 rounded-lg p-3 space-y-2 relative overflow-hidden">
                        <div className="absolute right-3 top-3 w-16 h-16 bg-[#d4af37]/5 rounded-full blur-xl pointer-events-none" />
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
                            <span className="text-xs font-semibold text-white">Gold Tiers (Rare)</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#d4af37]">
                            {counts.gold} parts
                          </span>
                        </div>
                        {/* Sub values breakdown */}
                        <div className="grid grid-cols-1 gap-2 text-[10px] text-[#8e9299] pt-1 border-t border-[#2a2c33]/30">
                          <div>
                            <span className="block font-mono text-[#d4af37] font-bold">100 Ducats</span>
                            <span className="text-white font-mono">{counts.gold} parts (Heavyweight)</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-[#d4af37]">
                          <span>Ducats Contribution:</span>
                          <span className="font-mono text-[#d4af37] font-bold">{counts.gold * 100} D</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parameter sliders and configuration panel */}
                  <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-xl space-y-5">
                    <h3 className="text-sm font-semibold text-[#e0e1e6] uppercase tracking-widest flex items-center gap-1.5" style={{ fontFamily: "'Georgia', serif" }}>
                      <Settings className="w-4 h-4 text-[#d4af37]" />
                      Analytical Configuration
                    </h3>

                    <div className="space-y-4">
                      {/* Cost Vector selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-[#8e9299] font-bold uppercase tracking-wider block">Calculation Vector</label>
                        <div className="grid grid-cols-2 gap-2 bg-[#0c0d10] p-1 border border-[#2a2c33] rounded-lg">
                          <button
                            onClick={() => setCalcType(1)}
                            className={`py-1.5 text-xs font-semibold rounded text-center transition cursor-pointer select-none ${
                              calcType === 1 ? 'bg-[#d4af37] text-black font-semibold shadow-inner' : 'text-[#8e9299] hover:text-[#e0e1e6]'
                            }`}
                          >
                            Narrow Set (96 pts)
                          </button>
                          <button
                            onClick={() => setCalcType(2)}
                            className={`py-1.5 text-xs font-semibold rounded text-center transition cursor-pointer select-none ${
                              calcType === 2 ? 'bg-[#d4af37] text-black font-semibold shadow-inner' : 'text-[#8e9299] hover:text-[#e0e1e6]'
                            }`}
                          >
                            Broad Set (216 pts)
                          </button>
                        </div>
                        <p className="text-[10px] text-[#8e9299] mt-1 leading-relaxed">
                          {calcType === 1 
                            ? 'Calculates expected profits over standard premium tiers. Perfect for typical bulk sales.' 
                            : 'Explores wider, highly realistic pricing vectors down to lower margins.'}
                        </p>
                      </div>

                      {/* Display switches */}
                      <div className="space-y-2.5 pt-3 border-t border-[#2a2c33]/40">
                        <label className="text-[10px] text-[#8e9299] font-bold uppercase tracking-wider block">Analytical Displays</label>
                        <div className="space-y-2">
                          <label className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                            displayAnova 
                              ? 'bg-[#14161c] border-[#d4af37]/30 text-white font-medium' 
                              : 'bg-[#0c0d10]/40 border-transparent text-[#8e9299] hover:bg-[#0c0d10]'
                          }`}>
                            <span className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full transition-all ${displayAnova ? 'bg-[#d4af37] shadow-[0_0_6px_#d4af37]' : 'bg-[#2a2c33]'}`} />
                              ANOVA Significance Check
                            </span>
                            <div className="relative flex items-center">
                              <input 
                                type="checkbox" 
                                checked={displayAnova} 
                                onChange={(e) => setDisplayAnova(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`w-7 h-4 rounded-full transition-colors relative flex items-center ${displayAnova ? 'bg-[#d4af37]' : 'bg-[#2a2c33]'}`}>
                                <div className={`w-3 h-3 rounded-full bg-[#0c0d10] shadow transform transition-transform ${displayAnova ? 'translate-x-3.5' : 'translate-x-[2px]'}`} />
                              </div>
                            </div>
                          </label>

                          <label className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                            enablePlot 
                              ? 'bg-[#14161c] border-[#d4af37]/30 text-white font-medium' 
                              : 'bg-[#0c0d10]/40 border-transparent text-[#8e9299] hover:bg-[#0c0d10]'
                          }`}>
                            <span className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full transition-all ${enablePlot ? 'bg-[#d4af37] shadow-[0_0_6px_#d4af37]' : 'bg-[#2a2c33]'}`} />
                              Yield Distribution Plot
                            </span>
                            <div className="relative flex items-center">
                              <input 
                                type="checkbox" 
                                checked={enablePlot} 
                                onChange={(e) => setEnablePlot(e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`w-7 h-4 rounded-full transition-colors relative flex items-center ${enablePlot ? 'bg-[#d4af37]' : 'bg-[#2a2c33]'}`}>
                                <div className={`w-3 h-3 rounded-full bg-[#0c0d10] shadow transform transition-transform ${enablePlot ? 'translate-x-3.5' : 'translate-x-[2px]'}`} />
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <ManualInput 
                    counts={counts} 
                    onChange={setCounts} 
                    onCalculate={() => alert('Calculated! Results are loaded and updated instantly on the right.')} 
                    activeConfig={calcType === 1 ? narrowConfig : broadConfig}
                    onSaveToItems={(c, n) => handleSaveToItems(c, n, 'manual')}
                  />
                </div>

                {/* Analytical summary on the right side */}
                <div className="lg:col-span-8">
                  {totalCount > 0 ? (
                    <AnalysisResults 
                      counts={counts} 
                      calcType={calcType} 
                      baseCosts={baseCosts} 
                      enablePlot={enablePlot}
                      displayAnova={displayAnova}
                    />
                  ) : (
                    <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-4">
                      <Coins className="w-12 h-12 text-slate-700 animate-pulse" />
                      <div>
                        <h4 className="text-slate-300 font-semibold">Calculator is empty</h4>
                        <p className="text-xs text-slate-500 mt-1">Please enter your item counts inside the manual quantity editor, select items from the directory, or scan screenshots using Gemini OCR.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'DataSelection' && (
              <DataSelection 
                onCountsCalculated={handleSyncedCounts}
                cart={dirCart}
                setCart={setDirCart}
                search={dirSearch}
                setSearch={setDirSearch}
                selectedRarity={dirRarity}
                setSelectedRarity={setDirRarity}
                selectedStatus={dirStatus}
                setSelectedStatus={setDirStatus}
                onSaveToItems={(c, n) => handleSaveToItems(c, n, 'directory')}
              />
            )}

            {activeTab === 'OCR' && (
              <ClipboardOCR 
                onCountsCalculated={handleSyncedCounts} 
                onSetTab={setActiveTab}
                showGuide={ocrShowGuide}
                setShowGuide={setOcrShowGuide}
                guideTab={ocrGuideTab}
                setGuideTab={setOcrGuideTab}
                imageFile={ocrImageFile}
                setImageFile={setOcrImageFile}
                previewUrl={ocrPreviewUrl}
                setPreviewUrl={setOcrPreviewUrl}
                loading={ocrLoading}
                setLoading={setOcrLoading}
                error={ocrError}
                setError={setOcrError}
                ocrItems={ocrItems}
                setOcrItems={setOcrItems}
                feedback={ocrFeedback}
                setFeedback={setOcrFeedback}
                onSaveToItems={(c, n) => handleSaveToItems(c, n, 'ocr')}
              />
            )}

            {activeTab === 'SavedItems' && (
              <SavedItemsTab 
                entries={savedInventories}
                onUseEntry={handleUseSavedInventory}
                onRenameEntry={handleRenameSavedInventory}
                onDeleteEntry={handleDeleteSavedInventory}
                onClearAll={handleClearAllSavedInventories}
              />
            )}

            {activeTab === 'Settings' && (
              <SettingsTab 
                narrowConfig={narrowConfig}
                setNarrowConfig={setNarrowConfig}
                broadConfig={broadConfig}
                setBroadConfig={setBroadConfig}
              />
            )}

            {activeTab === 'Help' && (
              <AboutInfo />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Humble Footer */}
      <footer className="border-t border-[#2a2c33] bg-[#0c0d10] py-6 px-6 text-center text-xs text-[#8e9299] flex items-center justify-between max-w-7xl w-full mx-auto flex-col sm:flex-row gap-4 mt-auto">
        <div className="flex items-center gap-1">
          <span>DucaPlat Trade Optimizer. For educational use within Warframe Free markets.</span>
        </div>
        <div className="flex gap-4">
          <a href="https://drops.warframestat.us/" target="_blank" rel="noreferrer" className="hover:text-white transition">Sourced with warframestat.us</a>
          <span>•</span>
          <span className="text-[#d4af37] font-semibold tracking-wide">Powered by Google Gemini</span>
        </div>
      </footer>

      {/* Dismissible Toast Auth Error banner */}
      {authError && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-[#1c0c0e] border border-red-500/30 text-red-200 px-4 py-3.5 rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-slide-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-xs font-medium">{authError}</span>
          </div>
          <button
            onClick={() => setAuthError(null)}
            className="text-red-400 hover:text-red-200 uppercase font-bold text-[10px] tracking-wide cursor-pointer transition shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* WebView Google Escape Hatch Overlay - Rule 5 */}
      {showWebViewOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="max-w-md w-full bg-[#111317] border border-red-900/50 rounded-2xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-950/40 text-red-400 border border-red-900/40 rounded-xl">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-serif">In-App Browser Sandbox</h3>
                <p className="text-xs text-[#8e9299] leading-relaxed">
                  Google blocks authentication requests inside built-in webviews (Facebook, Reddit, Slack, Discord, Instagram, Telegram) to defend security credentials.
                </p>
              </div>
            </div>
            <div className="p-4 bg-[#0a0b0d] border border-[#2a2c33]/70 rounded-lg space-y-3">
              <p className="text-[10px] uppercase text-[#8e9299] tracking-widest font-mono">To sync saved items:</p>
              <ol className="list-decimal list-inside text-xs text-zinc-300 space-y-1.5">
                <li>Copy the dynamic application URL below:</li>
                <li>Paste it inside your device's native browser app (Google Chrome or Apple Safari).</li>
                <li>Access your saved items and secure real-time syncing safely!</li>
              </ol>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={window.location.href}
                className="w-full bg-[#0a0b0d] border border-[#2a2c33] px-3 py-2 rounded-lg text-xs font-mono text-zinc-300 select-all focus:outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Workspace link copied successfully.");
                }}
                className="px-4 py-2 bg-[#d4af37] text-black hover:bg-[#b59223] rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0"
              >
                Copy Link
              </button>
            </div>
            <button
              onClick={() => setShowWebViewOverlay(false)}
              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition"
            >
              Close & Stay Guest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

