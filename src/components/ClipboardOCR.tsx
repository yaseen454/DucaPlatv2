/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { OcrResultItem, InventoryCount } from '../types';
import { PRIME_ITEMS } from '../data/primeData';
import { Image as ImageIcon, Sparkles, Wand2, Plus, Minus, Trash2, ArrowRight, HelpCircle, Check, Loader, Clipboard, Eye, EyeOff, Bookmark, X } from 'lucide-react';
import PrimePartsImage from '../data/Prime_Parts.png';
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

interface ClipboardOCRProps {
  onCountsCalculated: (counts: InventoryCount) => void;
  onSetTab: (tab: string) => void;
  showGuide: boolean;
  setShowGuide: (show: boolean) => void;
  guideTab: 'real' | 'diagram';
  setGuideTab: (tab: 'real' | 'diagram') => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  loading: boolean;
  setLoading: (l: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;
  ocrItems: OcrResultItem[];
  setOcrItems: React.Dispatch<React.SetStateAction<OcrResultItem[]>>;
  feedback: string | null;
  setFeedback: (f: string | null) => void;
  onSaveToItems?: (counts: InventoryCount, name?: string) => void;
}

export default function ClipboardOCR({
  onCountsCalculated,
  onSetTab,
  showGuide,
  setShowGuide,
  guideTab,
  setGuideTab,
  imageFile,
  setImageFile,
  previewUrl,
  setPreviewUrl,
  loading,
  setLoading,
  error,
  setError,
  ocrItems,
  setOcrItems,
  feedback,
  setFeedback,
  onSaveToItems
}: ClipboardOCRProps) {

  const [saveName, setSaveName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [zoomedUrl, setZoomedUrl] = useState<string | null>(null);

  // Bind Escape key to dismiss the zoomed magnifier modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomedUrl(null);
      }
    };
    if (zoomedUrl) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedUrl]);

  const handleLoadExample = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(PrimePartsImage);
      const blob = await response.blob();
      const file = new File([blob], "Prime_Parts.png", { type: "image/png" });
      handleImageChange(file);
      setFeedback("Loaded the exact reference image with 23,500 total Ducats into the scanner! Click 'Analyze Sellsheet' to try it.");
    } catch (err) {
      console.error(err);
      setError("Unable to load the pre-configured example screenshot asset.");
    } finally {
      setLoading(false);
    }
  };

  // Setup pasting listener on mount
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageChange(file);
            setFeedback("Image captured from clipboard!");
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageChange = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
    setOcrItems([]);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (files[0].type.startsWith('image/')) {
        handleImageChange(files[0]);
      } else {
        setError('Please drop a valid image file (PNG/JPEG)');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const runOcrAnalysis = async () => {
    if (!previewUrl) return;
    setLoading(true);
    setError(null);
    setOcrItems([]);

    try {
      // Extract clean base64 data
      const commaIndex = previewUrl.indexOf(',');
      const base64Data = commaIndex !== -1 ? previewUrl.substring(commaIndex + 1) : previewUrl;
      const mimeType = imageFile?.type || 'image/png';

      const schemaPrompt = `You are a Warframe Prime inventory screenshot analyzer. 
Review the given screenshot image of Warframe, specifically looking at any listed prime blueprints, prime weapon links, chassis, barrels, stocks, receivers, or components.
Extract each visible prime item and its count. Keep in mind:
- If a count prefix is visible like '5 X Acceltra Prime Stock', extract count = 5.
- If it's a single item listed, count = 1.
- Filter out items that are not prime parts.
Return a structured JSON list. Only return a plain JSON array of objects conforming to the type { name: string, count: number }[]. Do not write markdown blocks or any other explanation, just the raw JSON.`;

      let rawResults: any[] = [];
      let isExpressFallbackResult = false;
      
      try {
        // Attempt reaching the serverless function first (for Netlify production)
        const netlifyResponse = await fetch('/.netlify/functions/gemini', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image: base64Data,
            mimeType,
            prompt: schemaPrompt
          })
        });

        const contentType = netlifyResponse.headers.get('content-type') || '';
        if (!netlifyResponse.ok || netlifyResponse.status === 404 || contentType.includes('text/html')) {
          throw new Error("SERVERLESS_NOT_FOUND");
        }

        const resData = await netlifyResponse.json();
        if (Array.isArray(resData)) {
          rawResults = resData;
        } else if (resData && typeof resData.text === 'string') {
          rawResults = JSON.parse(resData.text.trim());
        } else if (resData && Array.isArray(resData.items)) {
          rawResults = resData.items;
        } else {
          throw new Error("Invalid response format from serverless function.");
        }
      } catch (netlifyErr: any) {
        console.log("Could not resolve Netlify serverless endpoint, triggering Express local API route fallback...", netlifyErr);
        
        // Express fallback (for local dev server / AI Studio container environment)
        const expressResponse = await fetch('/api/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image: base64Data,
            mimeType
          })
        });

        if (!expressResponse.ok) {
          const errData = await expressResponse.json().catch(() => ({}));
          throw new Error(errData.error || `OCR API route failed with status ${expressResponse.status}`);
        }

        const expressData = await expressResponse.json();
        if (expressData.items) {
          setOcrItems(expressData.items);
          setFeedback(`Vision scanning completed via Express! Extracted ${expressData.items.length} items successfully.`);
          isExpressFallbackResult = true;
        } else {
          throw new Error("Express OCR response was invalid.");
        }
      }

      if (isExpressFallbackResult) {
        setLoading(false);
        return;
      }
      
      // Run standard fuzzy matching against prime parts database in the browser context
      const enrichedResults = rawResults.map((item: any) => {
        const cleanScanned = item.name.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
        let bestMatch = null;
        let maxOverlapScore = 0;

        if (cleanScanned) {
          for (const official of PRIME_ITEMS) {
            const cleanOfficial = official.part.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
            if (cleanScanned === cleanOfficial) {
              bestMatch = official;
              break;
            }
            if (cleanScanned.includes(cleanOfficial) || cleanOfficial.includes(cleanScanned)) {
              const overlap = Math.min(cleanScanned.length, cleanOfficial.length) / Math.max(cleanScanned.length, cleanOfficial.length);
              if (overlap > maxOverlapScore) {
                maxOverlapScore = overlap;
                bestMatch = official;
              }
            }
          }

          if (!bestMatch) {
            const scannedWords = cleanScanned.split(/\s+/).filter(w => w.length > 2 && w !== "prime");
            for (const official of PRIME_ITEMS) {
              const officialWords = official.part.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== "prime");
              const matchCount = scannedWords.filter(w => officialWords.includes(w)).length;
              if (matchCount >= 2 && matchCount / officialWords.length > maxOverlapScore) {
                maxOverlapScore = matchCount / officialWords.length;
                bestMatch = official;
              }
            }
          }
        }

        return {
          name: item.name,
          count: item.count || 1,
          matchedItem: bestMatch || undefined
        };
      });

      setOcrItems(enrichedResults);
      if (enrichedResults.length === 0) {
        setError("Gemini couldn't find any prime parts in the screenshot. Please make sure the table text is clear.");
      } else {
        setFeedback(`Vision scanning completed! Extracted ${enrichedResults.length} items successfully.`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failure executing the Gemini OCR scan.');
    } finally {
      setLoading(false);
    }
  };

  // State mutators for returned OCR list
  const updateOcrItemCount = (index: number, qtyString: string) => {
    const val = Math.max(0, parseInt(qtyString) || 0);
    setOcrItems(prev => {
      const next = [...prev];
      next[index].count = val;
      return next;
    });
  };

  const deleteOcrItem = (index: number) => {
    setOcrItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const addManualOcrItem = () => {
    setOcrItems(prev => [
      ...prev,
      { name: "New Prime Part", count: 1 }
    ]);
  };

  const remapOcrItem = (index: number, officialPartName: string) => {
    const official = PRIME_ITEMS.find(p => p.part === officialPartName);
    setOcrItems(prev => {
      const next = [...prev];
      next[index].name = official ? official.part : officialPartName;
      next[index].matchedItem = official || undefined;
      return next;
    });
  };

  // Convert OCR items list to Inventory counts to push to dashboard
  const submitToCalculator = () => {
    const counts: InventoryCount = {
      bronze15: 0,
      bronze25: 0,
      silver45: 0,
      silver65: 0,
      gold: 0
    };

    let acceptedItemsCount = 0;
    ocrItems.forEach(item => {
      if (!item.matchedItem) return;
      acceptedItemsCount += item.count;
      
      const v = item.matchedItem.ducat_value;
      if (v === 15) counts.bronze15 += item.count;
      else if (v === 25) counts.bronze25 += item.count;
      else if (v === 45) counts.silver45 += item.count;
      else if (v === 65) counts.silver65 += item.count;
      else if (v === 100) counts.gold += item.count;
    });

    onCountsCalculated(counts);
    setFeedback(`Successfully merged ${acceptedItemsCount} items into the active calculator!`);
    onSetTab('Calculator');
  };

  return (
    <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[#2a2c33] gap-4">
        <div>
          <h2 className="text-xl font-light text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
            <Clipboard className="w-5 h-5 text-[#d4af37]" />
            Gemini Vision OCR Analyzer
          </h2>
          <p className="text-xs text-[#8e9299] mt-1">
            Skip manual entries! Drag-and-drop inventory screenshots, upload images, or press <kbd className="bg-[#0c0d10] px-1 rounded border border-[#2a2c33] text-[10px] text-[#e0e1e6]">Ctrl+V / ⌘+V</kbd> to paste directly.
          </p>
        </div>
        {feedback && (
          <div className="bg-emerald-950/40 text-emerald-400 text-xs px-4 py-2 border border-emerald-900/40 rounded-lg flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload dropzone and preview */}
        <div className="space-y-4">
          <div 
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
            onClick={!previewUrl ? () => document.getElementById('screenshot-input')?.click() : undefined}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[220px] ${
              previewUrl ? 'border-[#d4af37]/50 bg-[#0c0d10]/40' : 'border-[#2a2c33] hover:border-[#d4af37]/40 bg-[#0c0d10]/20'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              id="screenshot-input"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleImageChange(e.target.files[0]);
                }
              }}
            />

            {previewUrl ? (
              <div className="w-full space-y-4" onClick={(e) => e.stopPropagation()}>
                <div 
                  onClick={() => setZoomedUrl(previewUrl)}
                  className="relative group cursor-zoom-in max-h-48 max-w-[280px] mx-auto overflow-hidden rounded-lg border border-[#2a2c33] shadow-md transition-all duration-300 bg-[#07080a]"
                >
                  <img 
                    src={previewUrl} 
                    alt="Inventory preview" 
                    className="max-h-48 mx-auto rounded-lg object-contain transition group-hover:scale-[1.03] group-hover:brightness-110"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                    <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#d4af37] bg-black/85 px-3 py-1.5 rounded-md border border-[#d4af37]/20 flex items-center gap-1.5 shadow-lg select-none">
                      <Eye className="w-3.5 h-3.5" />
                      Zoom Image
                    </span>
                  </div>
                </div>
                <div className="flex justify-center flex-wrap gap-2">
                  <label 
                    htmlFor="screenshot-input"
                    className="px-3 py-1.5 bg-[#0c0d10] hover:bg-[#1a1c22] rounded border border-[#2a2c33] hover:border-[#d4af37]/30 text-[11px] font-semibold text-[#c4c5cc] cursor-pointer transition select-none flex items-center gap-1"
                  >
                    Change Image
                  </label>
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setPreviewUrl(null);
                      setOcrItems([]);
                      setError(null);
                      setFeedback(null);
                    }}
                    className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 hover:border-red-800 rounded text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer select-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                  <button
                    onClick={runOcrAnalysis}
                    disabled={loading}
                    className="px-3.5 py-1.5 bg-[#d4af37] hover:bg-[#b08d26] text-black font-bold text-[11px] rounded transition flex items-center gap-1.5 cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Analyze
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center">
                <div className="p-4 bg-[#0c0d10]/80 border border-[#2a2c33] rounded-full text-slate-500 group-hover:text-[#d4af37] transition shadow-inner">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                </div>
                <div>
                  <p className="text-xs text-[#e0e1e6] font-semibold">Drop or paste screenshot, or click to upload</p>
                  <p className="text-[10px] text-[#8e9299]/70 mt-1">Compatible with in-game sell grids (as shown in help guide).</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="text-xs text-[#d4af37] hover:text-[#e5c158] font-bold flex items-center gap-1.5 focus:outline-none transition group cursor-pointer"
              >
                {showGuide ? <EyeOff className="w-4 h-4 text-[#d4af37]" /> : <Eye className="w-4 h-4 text-[#d4af37]" />}
                <span>{showGuide ? "Hide Visual Screenshot Guide" : "View Visual Screenshot Guide"}</span>
              </button>
            </div>

            {showGuide && (
              <div className="border border-[#2a2c33] bg-[#0c0d10]/90 rounded-xl p-4.5 space-y-4 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#d4af37] border-b border-[#2a2c33]/60 pb-2">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                    In-Game Capture Guide
                  </span>
                  <span className="text-red-400 animate-pulse text-[10px] flex items-center gap-1 font-mono uppercase tracking-widest bg-red-950/30 border border-red-900/40 px-1.5 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                    OCR Target Selection
                  </span>
                </div>

                {/* Sub-tabs to choose between Real reference or Wireframe diagram */}
                <div className="flex gap-2 p-1 bg-[#14161c] rounded-lg border border-[#2a2c33]">
                  <button
                    onClick={() => setGuideTab('real')}
                    className={`flex-1 text-center py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition duration-150 cursor-pointer ${
                      guideTab === 'real'
                        ? 'bg-[#d4af37] text-[#000] shadow'
                        : 'text-[#8e9299] hover:text-[#e0e1e6] hover:bg-[#1a1c22]'
                    }`}
                  >
                    Real Reference Image
                  </button>
                  <button
                    onClick={() => setGuideTab('diagram')}
                    className={`flex-1 text-center py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition duration-150 cursor-pointer ${
                      guideTab === 'diagram'
                        ? 'bg-[#d4af37] text-[#000] shadow'
                        : 'text-[#8e9299] hover:text-[#e0e1e6] hover:bg-[#1a1c22]'
                    }`}
                  >
                    Simulated Wireframe
                  </button>
                </div>
                
                {guideTab === 'real' ? (
                  <div className="space-y-3">
                    <p className="text-[11px] text-[#8e9299] leading-relaxed">
                      This is the <strong>exact screen layout</strong> for Void Trader transactions. Notice the red highlight box drawn around the right-hand selected items list. For 100% scanning accuracy, crop just this segment:
                    </p>

                    <div 
                      onClick={() => setZoomedUrl(PrimePartsImage)}
                      className="relative group cursor-zoom-in overflow-hidden rounded-lg border border-[#d4af37]/20 bg-[#090a0d] p-1 shadow-2xl transition-all duration-300"
                    >
                      <img 
                        src={PrimePartsImage} 
                        alt="Warframe OCR Area Reference" 
                        className="w-full max-h-[220px] object-contain rounded brightness-90 hover:brightness-100 transition duration-300 group-hover:scale-[1.01]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 right-3 bg-red-600/90 text-white font-mono font-bold text-[8px] uppercase px-2 py-0.5 rounded shadow-md tracking-wider select-none z-10">
                        Screenshot Area Example
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                        <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#d4af37] bg-black/85 px-3 py-1.5 rounded-md border border-[#d4af37]/20 flex items-center gap-1.5 shadow-lg select-none">
                          <Eye className="w-3.5 h-3.5" />
                          Zoom Guide
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <button
                        onClick={handleLoadExample}
                        className="px-4 py-2 bg-[#d4af37]/15 hover:bg-[#d4af37]/25 text-[#d4af37] border border-[#d4af37]/40 hover:border-[#d4af37] rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest transition duration-150 active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        ⚡ Use This Image to Test the Scanner
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-[#8e9299] leading-relaxed font-sans">
                      Simplified structural overview. Crop the <strong>right-side item ledger</strong> detailing name entries and numeric multipliers:
                    </p>

                    {/* Simulated Warframe UI Grid and Sidebar Mockup */}
                    <div className="bg-[#090a0d] border border-[#d4af37]/10 rounded-lg p-3 text-[10px] font-sans relative overflow-hidden select-none shadow-2xl">
                      {/* Mock Warframe Title and Filter Bar */}
                      <div className="flex items-center justify-between border-b border-[#2a2c33]/30 pb-2 mb-2">
                        <span className="font-bold text-[#b8b9bf] tracking-widest text-[9px] uppercase font-mono">PRIME PARTS FILTER</span>
                        <div className="flex items-center gap-1 text-[8px] opacity-75">
                          <span className="border border-[#d4af37]/10 px-1 py-0.5 rounded text-[#d4af37] font-bold bg-[#d4af37]/5">ALL</span>
                          <span className="border border-[#2a2c33] px-1 py-0.5 rounded">WEAPONS</span>
                          <span className="border border-[#2a2c33] px-1 py-0.5 rounded">WARFRAMES</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-0.5">
                        {/* Left Column: Grid representing the user's Inventory grid (faded in mock design) */}
                        <div className="col-span-2 grid grid-cols-2 gap-1.5 opacity-35">
                          <div className="bg-[#14161c]/80 border border-[#d4af37]/20 rounded p-1 flex flex-col justify-between h-14">
                            <span className="bg-[#1c1e24] px-0.5 py-0.2 rounded w-4 text-center font-bold text-[#d4af37] scale-75 origin-top-left font-mono">✔ 2</span>
                            <div className="w-full h-4 bg-[#23262f]/40 rounded-sm my-1"></div>
                            <span className="text-[7.5px] text-[#8e9299] truncate font-mono">Afuris Link</span>
                          </div>
                          <div className="bg-[#14161c]/80 border border-[#d4af37]/20 rounded p-1 flex flex-col justify-between h-14">
                            <span className="bg-[#1c1e24] px-0.5 py-0.2 rounded w-4 text-center font-bold text-[#d4af37] scale-75 origin-top-left font-mono">✔ 2</span>
                            <div className="w-full h-4 bg-[#23262f]/40 rounded-sm my-1"></div>
                            <span className="text-[7.5px] text-[#8e9299] truncate font-mono">Akarius Link</span>
                          </div>
                          <div className="bg-[#14161c]/80 border border-[#d4af37]/20 rounded p-1 flex flex-col justify-between h-14">
                            <span className="bg-[#1c1e24] px-0.5 py-0.2 rounded w-4 text-center font-bold text-[#d4af37] scale-75 origin-top-left font-mono">✔ 3</span>
                            <div className="w-full h-4 bg-[#23262f]/40 rounded-sm my-1"></div>
                            <span className="text-[7.5px] text-[#8e9299] truncate font-mono">Baruuk BP</span>
                          </div>
                          <div className="bg-[#14161c]/80 border border-[#d4af37]/20 rounded p-1 flex flex-col justify-between h-14">
                            <span className="bg-[#1c1e24] px-0.5 py-0.2 rounded w-4 text-center font-bold text-[#d4af37] scale-75 origin-top-left font-mono">✔ 3</span>
                            <div className="w-full h-4 bg-[#23262f]/40 rounded-sm my-1"></div>
                            <span className="text-[7.5px] text-[#8e9299] truncate font-mono">Braton Stock</span>
                          </div>
                        </div>

                        {/* Right Column: Selling ledger - outlined in glowing red as shown in the screenshot */}
                        <div className="col-span-1 border-2 border-red-500 rounded p-1.5 bg-[#101217] relative flex flex-col justify-between h-[126px] shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                          <div className="absolute -top-2.5 -right-0.5 bg-red-600 text-white text-[6.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest scale-90 shadow-lg font-mono">
                            Screenshot Area
                          </div>
                          
                          <div className="space-y-1 overflow-hidden pt-1">
                            <div className="text-[6.5px] text-[#c4c5cc] flex justify-between font-mono">
                              <span className="truncate max-w-[45px]">Cobra Guard</span>
                              <span className="text-zinc-500">3,500</span>
                            </div>
                            <div className="text-[6.5px] text-[#c4c5cc] flex justify-between font-mono">
                              <span className="truncate max-w-[45px]">Akvasto Link</span>
                              <span className="text-zinc-500">3,500</span>
                            </div>
                            <div className="text-[6.5px] text-[#d4af37] flex justify-between font-mono font-bold bg-[#d4af37]/5 px-0.5 rounded">
                              <span className="truncate max-w-[45px]">2 X Akarius Lnk</span>
                              <span className="text-[#8e9299]">7,000</span>
                            </div>
                            <div className="text-[6.5px] text-[#c4c5cc] flex justify-between font-mono">
                              <span className="truncate max-w-[45px]">Dual Keres Hndl</span>
                              <span className="text-zinc-500">3,500</span>
                            </div>
                            <div className="text-[6.5px] text-[#c4c5cc] flex justify-between font-mono">
                              <span className="truncate max-w-[45px]">Gauss Chassis</span>
                              <span className="text-zinc-500">3,500</span>
                            </div>
                            <div className="text-[6.5px] text-[#c4c5cc] flex justify-between font-mono">
                              <span className="truncate max-w-[45px]">Garuda BP</span>
                              <span className="text-zinc-500">2,500</span>
                            </div>
                          </div>

                          <div className="border-t border-[#2a2c33]/50 pt-1 mt-1">
                            <div className="flex justify-between text-[7px] text-[#8e9299] font-mono">
                              <span>TOTAL</span>
                              <span className="text-[#d4af37] font-bold">23,500</span>
                            </div>
                            <div className="bg-[#d4af37] text-[#000000] text-[5.5px] font-bold py-0.5 rounded text-center mt-1 scale-95 uppercase tracking-widest font-mono">
                              SELL ITEMS
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Explanatory tips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] text-[#8e9299] pt-1 border-t border-[#2a2c33]/50">
                  <div className="bg-[#14161c]/40 p-2.5 rounded border border-[#2a2c33]/40 space-y-0.5">
                    <span className="font-bold text-[#e0e1e6] block">🎯 Step 1: Crop Selection</span>
                    When taking a screenshot, selecting just the right-side summary list keeps image sizes tiny and results blazing fast.
                  </div>
                  <div className="bg-[#14161c]/40 p-2.5 rounded border border-[#2a2c33]/40 space-y-0.5">
                    <span className="font-bold text-[#e0e1e6] block">📋 Step 2: Paste Instantly</span>
                    Simply tap <kbd className="bg-[#0c0d10] px-1 py-0.5 rounded border border-[#2a2c33] text-[9px] text-[#e0e1e6]">Alt + PrtScn</kbd> inside Warframe, focus this tab, and paste with <kbd className="bg-[#0c0d10] px-1 py-0.5 rounded border border-[#2a2c33] text-[9px] text-[#e0e1e6]">Ctrl+V</kbd>.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OCR Parsed Items and Corrections list */}
        <div className="space-y-4">
          <div className="bg-[#0c0d10] border border-[#2a2c33] rounded-xl p-4 flex flex-col h-[280px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a2c33] mb-3">
              <span className="text-xs font-bold text-[#8e9299] uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                Parsed Results ({ocrItems.length})
              </span>
              {ocrItems.length > 0 && (
                <button 
                  onClick={addManualOcrItem}
                  className="text-[10px] text-[#d4af37] hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Add Item
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#8e9299] gap-2">
                <Loader className="w-8 h-8 text-[#d4af37] animate-spin" />
                <span className="text-xs font-semibold text-[#c4c5cc]">Gemini is reading text items...</span>
                <span className="text-[10px] text-zinc-600">Checking for parts and quantities...</span>
              </div>
            ) : error ? (
              <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center text-red-400 text-xs px-4 py-4 text-center space-y-4">
                <span className="leading-relaxed">{error}</span>
                <div className="flex justify-center gap-2.5">
                  <button 
                    onClick={runOcrAnalysis}
                    className="px-3 py-1.5 bg-[#d4af37] hover:bg-[#b08d26] text-black font-extrabold rounded text-[10px] uppercase tracking-wider duration-150 transition"
                  >
                    Retry Scan
                  </button>
                </div>
              </div>
            ) : ocrItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[#8e9299]/70 text-center">
                <ImageIcon className="w-12 h-12 opacity-15 mb-2" />
                <p className="text-xs">No parsed parts loaded.</p>
                <p className="text-[10px] opacity-75 mt-0.5">Click 'Analyze Sellsheet' to inspect your item counts.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {ocrItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2 border rounded-lg flex items-center justify-between text-xs transition gap-4 ${
                      item.matchedItem 
                        ? 'bg-[#14161c]/60 border-[#2a2c33] hover:border-[#d4af37]/40' 
                        : 'bg-amber-950/20 border-amber-900/30 hover:border-amber-800/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {item.matchedItem ? (
                        <div>
                          <div className="font-semibold text-[#e0e1e6] truncate">{item.matchedItem.part}</div>
                          <div className="text-[10px] text-[#8e9299] mt-0.5 flex items-center gap-1">
                            Official database match — <DucatValue val={item.matchedItem.ducat_value} size="w-2.5 h-2.5" />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-semibold text-[#d4af37] truncate">{item.name}</div>
                          <div className="text-[10px] text-amber-600/80 mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span>Unmatched text. Relink:</span>
                            <select
                              onChange={(e) => remapOcrItem(idx, e.target.value)}
                              className="bg-[#0c0d10] border border-[#2a2c33] rounded px-1.5 py-0.5 text-[9px] font-bold text-[#c4c5cc] focus:outline-none"
                            >
                              <option value="">-- Choose Part --</option>
                              {PRIME_ITEMS.map(p => (
                                <option key={p.part} value={p.part}>{p.part}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="0"
                        value={item.count}
                        onChange={(e) => updateOcrItemCount(idx, e.target.value)}
                        className="w-10 bg-[#0c0d10] border border-[#2a2c33] rounded text-center text-xs font-bold text-[#d4af37] py-0.5"
                      />
                      <button 
                        onClick={() => deleteOcrItem(idx)}
                        className="text-[#8e9299] hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2.5 border-t border-[#2a2c33]/70 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Set name (optional)..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                disabled={ocrItems.filter(i => i.matchedItem).length === 0}
                className="flex-1 min-w-0 bg-[#0c0d10] border border-[#2a2c33] hover:border-[#2a2c33]/80 focus:border-[#d4af37]/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none placeholder-zinc-650 disabled:opacity-40"
              />
              <button
                onClick={() => {
                  if (onSaveToItems) {
                    const counts: InventoryCount = {
                      bronze15: 0,
                      bronze25: 0,
                      silver45: 0,
                      silver65: 0,
                      gold: 0
                    };
                    ocrItems.forEach(item => {
                      if (!item.matchedItem) return;
                      const v = item.matchedItem.ducat_value;
                      if (v === 15) counts.bronze15 += item.count;
                      else if (v === 25) counts.bronze25 += item.count;
                      else if (v === 45) counts.silver45 += item.count;
                      else if (v === 65) counts.silver65 += item.count;
                      else if (v === 100) counts.gold += item.count;
                    });
                    onSaveToItems(counts, saveName.trim() || undefined);
                    setSaveName('');
                    setSaveSuccess(true);
                    setTimeout(() => setSaveSuccess(false), 2200);
                  }
                }}
                disabled={ocrItems.filter(i => i.matchedItem).length === 0}
                className="px-3.5 py-1.5 bg-[#161820] hover:bg-[#1f222b] text-[#c4c5cc] hover:text-white border border-[#2a2c33] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#d4af37]" />
                Save Set
              </button>
            </div>
            {saveSuccess && (
              <div className="text-[10px] text-emerald-400 text-center animate-pulse">
                ✓ Scanned set items saved to history successfully!
              </div>
            )}
          </div>

          <button
            onClick={submitToCalculator}
            disabled={ocrItems.filter(i => i.matchedItem).length === 0}
            className="w-full py-3 bg-[#d4af37] hover:bg-[#b08d26] text-black font-semibold text-xs uppercase tracking-wider rounded-lg shadow-xl flex items-center justify-center gap-2 duration-150 active:scale-95 disabled:opacity-45 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
          >
            Match & transfer to calculator
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zoom Modal overlay */}
      {zoomedUrl && (
        <div 
          onClick={() => setZoomedUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="relative max-w-4xl w-full max-h-[85vh] flex flex-col bg-[#0e1014] border border-[#d4af37]/20 rounded-2xl p-3 md:p-5 shadow-2xl space-y-3 cursor-default"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-[#2a2c33]/60 mb-1 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse"></span>
                <span className="text-xs uppercase font-mono tracking-widest text-[#d4af37]">Sellsheet Vision Magnifier</span>
              </div>
              <button 
                onClick={() => setZoomedUrl(null)}
                className="p-1 px-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer select-none"
              >
                <X className="w-3 h-3" />
                Close <span className="text-[9px] opacity-50">(Esc)</span>
              </button>
            </div>

            {/* Modal Image container */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-2 min-h-0 bg-[#07080a] rounded-lg border border-[#2a2c33]/40">
              <img 
                src={zoomedUrl} 
                alt="Zoomed inventory preview" 
                className="max-w-full max-h-[65vh] object-contain rounded shadow-2xl select-none"
              />
            </div>

            {/* Modal Footer helper */}
            <div className="flex items-center justify-between text-[10px] text-[#8e9299] font-mono uppercase tracking-wider shrink-0 select-none">
              <span>Press ESC or click outside to exit magnifier</span>
              <span>100% Native Resolution</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
