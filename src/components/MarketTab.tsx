/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  writeBatch,
  serverTimestamp, 
  deleteDoc 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Plus, 
  Check, 
  Copy, 
  ExternalLink, 
  X, 
  RotateCcw, 
  ShieldCheck, 
  AlertCircle, 
  ShoppingBag, 
  Coins, 
  Trash2, 
  Filter, 
  UserCheck, 
  MessageSquare,
  HelpCircle,
  Tag,
  Loader2
} from 'lucide-react';
import { PRIME_ITEMS } from '../data/primeData';

// Generate WF-VERIFY-[8 alphanumeric] token
function generateVerifyToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = 'WF-VERIFY-';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

interface MarketListing {
  id: string;
  sellerUid: string;
  sellerIGN: string;
  normalizedSellerIGN: string;
  isSellerVerified: boolean;
  itemName: string;
  price: number;
  quantity: number;
  type: 'WTS' | 'WTB';
  status: 'active' | 'sold' | 'cancelled';
  createdAt: any;
}

interface UserVerification {
  status: 'unverified' | 'pending' | 'verified';
  claimedIGN: string;
  normalizedIGN: string;
  verifiedIGN: string | null;
  token: string | null;
  updatedAt: any;
}

// Extract profile username/slug from warframe.market profile links or raw usernames
function extractWFMProfileUsername(input: string): string {
  let val = input.trim();
  // Handle warframe.market/profile/username urls
  if (val.toLowerCase().includes("warframe.market/profile/")) {
    const parts = val.split(/warframe\.market\/profile\//i);
    if (parts.length > 1) {
      val = parts[1];
    }
  } else if (val.toLowerCase().includes("forums.warframe.com/profile/")) {
    // Fallback for older links or forum layout formats
    const parts = val.split(/forums\.warframe\.com\/profile\//i);
    if (parts.length > 1) {
      val = parts[1];
    }
    if (val.includes("-")) {
      const blocks = val.split("-");
      if (/^\d+$/.test(blocks[0])) {
        val = blocks.slice(1).join("-");
      }
    }
  }
  while (val.endsWith("/")) {
    val = val.slice(0, -1);
  }
  if (val.includes("?")) {
    val = val.split("?")[0];
  }
  if (val.includes("/")) {
    val = val.split("/").pop() || val;
  }
  return val.trim();
}

export default function MarketTab() {
  const { user } = useAuth();
  
  // Real-time states
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [userVerification, setUserVerification] = useState<UserVerification>({
    status: 'unverified',
    claimedIGN: '',
    normalizedIGN: '',
    verifiedIGN: null,
    token: null,
    updatedAt: null
  });
  
  // Local UI / Form states
  const [claimedInput, setClaimedInput] = useState('');
  const [htmlInput, setHtmlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'WTS' | 'WTB'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);
  
  // Create listing states
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState<number>(10);
  const [quantity, setQuantity] = useState<number>(1);
  const [listType, setListType] = useState<'WTS' | 'WTB'>('WTS');
  
  // Statuses
  const [verifying, setVerifying] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Suggested / popular prime search lists
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);
  const popularShortcuts = [
    'Bronze Prime Junk (15d)',
    'Bronze Prime Junk (25d)',
    'Uncommon Prime Junk (45d)',
    'Uncommon Prime Junk (65d)',
    'Gold Prime Junk (100d)',
  ];

  // 1. Listen to global active listings
  useEffect(() => {
    const q = query(
      collection(db, 'listings'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveListings: MarketListing[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        liveListings.push({
          id: docSnap.id,
          ...data
        } as MarketListing);
      });
      // Sort by creation time newest first
      liveListings.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setListings(liveListings);
    }, (error) => {
      console.warn("Listing active stream restricted or offline.", error);
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen to current user verification node in database
  useEffect(() => {
    if (!user) {
      setUserVerification({
        status: 'unverified',
        claimedIGN: '',
        normalizedIGN: '',
        verifiedIGN: null,
        token: null,
        updatedAt: null
      });
      return;
    }

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.verification) {
          setUserVerification(data.verification as UserVerification);
        } else {
          setUserVerification({
            status: 'unverified',
            claimedIGN: '',
            normalizedIGN: '',
            verifiedIGN: null,
            token: null,
            updatedAt: null
          });
        }
      }
    }, (error) => {
      console.warn("User data sync restricted or offline.", error);
    });

    return () => unsubProfile();
  }, [user]);

  // Handle Autocomplete listing item searches
  useEffect(() => {
    if (!itemName.trim()) {
      setItemSuggestions([]);
      return;
    }
    const queryTerm = itemName.toLowerCase();
    const suggestionsSet = new Set<string>();

    // Suggest custom junk items
    popularShortcuts.forEach(item => {
      if (item.toLowerCase().includes(queryTerm)) {
        suggestionsSet.add(item);
      }
    });

    // Suggest from static database
    PRIME_ITEMS.forEach(obj => {
      if (obj.part.toLowerCase().includes(queryTerm)) {
        suggestionsSet.add(obj.part);
      }
    });

    setItemSuggestions(Array.from(suggestionsSet).slice(0, 5));
  }, [itemName]);

  // Request token block generation (unverified state)
  const handleInitiateVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const claimed = claimedInput.trim();
    if (!claimed) {
      setErrorMsg('Please enter a valid claimed Warframe.market Username or Profile Link.');
      return;
    }

    setActionLoading(true);
    const token = generateVerifyToken();
    const parsedSlug = extractWFMProfileUsername(claimed);
    const normalized = parsedSlug.toLowerCase();

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        verification: {
          status: 'pending',
          claimedIGN: parsedSlug,
          normalizedIGN: normalized,
          verifiedIGN: null,
          token: token,
          updatedAt: serverTimestamp()
        }
      });
      setSuccessMsg(`Verification token successfully created!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setErrorMsg('Failed to create verification token. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger POST checkout validation (pending verification state)
  const handleTriggerValidation = async () => {
    if (!user || userVerification.status !== 'pending') return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const htmlCode = htmlInput.trim();
    if (!htmlCode) {
      setErrorMsg('Please paste the viewed page source (HTML code) of your warframe.market profile page.');
      return;
    }

    setVerifying(true);

    try {
      const checkRes = await fetch('/.netlify/functions/verify-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          claimedIGN: userVerification.claimedIGN,
          htmlSource: htmlCode
        })
      });

      const result = await checkRes.json();
      if (result.success) {
        setSuccessMsg(`Congratulations! Successfully verified as: ${result.verifiedIGN}. You can now safely remove the token code from your profile biography.`);
        setHtmlInput(''); // Clear the text field on successful verification
      } else {
        setErrorMsg(result.error || 'Token checking failed. Ensure you copied it fully and saved.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Network error requesting Netlify validator function. Try again shortly.');
    } finally {
      setVerifying(false);
    }
  };

  // Confirmation Reset function (verified state)
  const handlePerformReset = async () => {
    if (!user) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      const batch = writeBatch(db);
      
      // 1. Reset user verification block
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        verification: {
          status: 'unverified',
          claimedIGN: '',
          normalizedIGN: '',
          verifiedIGN: null,
          token: null,
          updatedAt: serverTimestamp()
        }
      });

      // 2. Set user's active listings to cancelled status
      const userListings = listings.filter(l => l.sellerUid === user.uid);
      userListings.forEach(l => {
        const listingDocRef = doc(db, 'listings', l.id);
        batch.update(listingDocRef, {
          status: 'cancelled'
        });
      });

      await batch.commit();
      setShowConfirmReset(false);
      setClaimedInput('');
      setSuccessMsg('Profile and active listings reset successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/reset`);
      setErrorMsg('Failed to reset listing profiles.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit live listing
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || userVerification.status !== 'verified') {
      setErrorMsg('Only fully verified traders can post live listings.');
      return;
    }

    const item = itemName.trim();
    if (!item) {
      setErrorMsg('Enter an item name.');
      return;
    }
    if (price < 0 || quantity <= 0) {
      setErrorMsg('Invalid price or quantity amounts.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);

    try {
      await addDoc(collection(db, 'listings'), {
        sellerUid: user.uid,
        sellerIGN: userVerification.verifiedIGN,
        normalizedSellerIGN: userVerification.normalizedIGN,
        isSellerVerified: true,
        itemName: item,
        price: Math.floor(price),
        quantity: Math.floor(quantity),
        type: listType,
        status: 'active',
        createdAt: serverTimestamp()
      });

      // Reset form on success
      setItemName('');
      setPrice(10);
      setQuantity(1);
      setSuccessMsg(`Listed "${item}" successfully!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'listings');
      setErrorMsg('Firestore rejected the listing. Verify rule settings.');
    } finally {
      setActionLoading(false);
    }
  };

  // Complete / delete user listed items
  const handleMarkListingStatus = async (id: string, newStatus: 'sold' | 'cancelled') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const listingRef = doc(db, 'listings', id);
      await updateDoc(listingRef, {
        status: newStatus
      });
      setSuccessMsg(`Listing marked as ${newStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `listings/${id}`);
      setErrorMsg('Could not update listing state.');
    }
  };

  const handleDeleteListing = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteDoc(doc(db, 'listings', id));
      setSuccessMsg('Your listing was permanently cleared.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `listings/${id}`);
      setErrorMsg('Could not drop listing from database.');
    }
  };

  // Utilities helper
  const copyToClipboard = (text: string, isToken: boolean, commandId?: string) => {
    navigator.clipboard.writeText(text);
    if (isToken) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else if (commandId) {
      setCopiedCommandId(commandId);
      setTimeout(() => setCopiedCommandId(null), 2000);
    }
  };

  // Perform client filters on listing sets
  const filteredListings = listings.filter(l => {
    const itemMatch = l.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.sellerIGN.toLowerCase().includes(searchQuery.toLowerCase());
    const typeMatch = typeFilter === 'all' || l.type === typeFilter;
    const verifiedMatch = !verifiedFilter || l.isSellerVerified;
    return itemMatch && typeMatch && verifiedMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
          <ShoppingBag className="w-5 h-5 text-[#d4af37]" />
          Warframe Live Market Tab
        </h2>
        <p className="text-xs text-[#8e9299]">
          Trade Prime parts and Junk safely. Authenticate your In-Game name via warframe.market profile bios to guarantee seller identities.
        </p>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-red-950/20 border border-red-900/30 text-red-400 rounded-lg text-xs font-medium flex items-start gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-lg text-xs font-medium flex items-start gap-2 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Verification & Listing Widgets */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* PROFILE / VERIFICATION CONTAINER */}
          <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 space-y-4">
            <div className="border-b border-[#2a2c33]/40 pb-3">
              <h3 className="font-semibold text-sm text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide">
                <UserCheck className="w-4 h-4 text-[#d4af37]" />
                Identity Certification
              </h3>
            </div>

            {!user ? (
              <p className="text-xs text-[#8e9299] leading-relaxed py-2">
                Log in using Google via the Settings tab to authenticate your Warframe IGN and begin listing trades. Unverified guests can browse listings but cannot create trade requests.
              </p>
            ) : (
              <>
                {/* 1. STATE: UNVERIFIED */}
                {userVerification.status === 'unverified' && (
                  <form onSubmit={handleInitiateVerification} className="space-y-3">
                    <p className="text-xs text-[#8e9299] leading-relaxed">
                      To safely post trades, prove you own your In-Game Name. Enter your <strong>exact warframe.market Username</strong> below (capitalization must match exactly):
                    </p>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Your exact warframe.market Username</label>
                      <input
                        type="text"
                        placeholder="e.g. TennoMerchant (case-sensitive)"
                        value={claimedInput}
                        onChange={(e) => setClaimedInput(e.target.value)}
                        className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-zinc-700"
                        required
                      />
                      <p className="text-[10px] text-amber-500/80 leading-normal">
                        ⚠️ Note: The warframe.market API requires your exact capitalization (e.g., if your name has capital letters, enter them exactly).
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-2 bg-[#d4af37] hover:bg-[#b08d26] disabled:opacity-50 text-black font-semibold text-xs uppercase tracking-wider rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Generate Signature Token
                    </button>
                  </form>
                )}

                {/* 2. STATE: PENDING */}
                {userVerification.status === 'pending' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-3 bg-[#1c1214] border border-[#b45a3c]/30 rounded-lg space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Verification Awaiting</h4>
                      </div>
                      <p className="text-[11px] text-[#c4c5cc] leading-relaxed">
                        Claimed In-Game Username: <span className="font-semibold text-white px-1.5 py-0.5 font-mono uppercase bg-[#0c0d10] rounded">{userVerification.claimedIGN}</span>
                      </p>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs text-[#8e9299] leading-relaxed font-semibold text-[#d4af37]">
                        Please follow these 4 steps to complete authentication:
                      </p>

                      <ol className="text-[11px] text-[#c4c5cc] space-y-3 list-decimal list-inside leading-relaxed bg-[#1b1d24]/50 p-3 rounded-lg border border-[#2a2c33]/40">
                        <li className="space-y-2">
                          <span>Paste and save this signature inside your warframe.market profile settings <strong className="text-white font-medium">"About" (custom biography)</strong>:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-[#0c0d10] border border-[#2a2c33] rounded-lg px-2.5 py-2 font-mono text-xs text-[#d4af37] select-all truncate">
                              {userVerification.token}
                            </div>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(userVerification.token || '', true)}
                              className="px-2.5 py-2 bg-[#2a2c33] hover:bg-[#3f414a] border border-[#3f414a] rounded-lg text-white font-medium text-xs transition uppercase flex items-center justify-center cursor-pointer shrink-0"
                              title="Copy Token"
                            >
                              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                            </button>
                          </div>
                        </li>
                        <li>
                          <span>Open your public profile page (<a
                            href={`https://warframe.market/profile/${encodeURIComponent((userVerification.claimedIGN || userVerification.normalizedIGN || '').toLowerCase())}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#d4af37] font-semibold underline hover:text-[#b08d26] inline-flex items-center gap-0.5"
                          >
                            {userVerification.claimedIGN} <ExternalLink className="w-3 h-3 inline mb-0.5" />
                          </a>) and press refresh.</span>
                        </li>
                        <li>
                          <span>Right-click anywhere on that page, and select <strong className="text-white font-medium">View Page Source</strong> (or press <kbd className="bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 px-1 py-0.5 rounded text-[9px] font-mono">CTRL + U</kbd> on PC, <kbd className="bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 px-1 py-0.5 rounded text-[9px] font-mono">CMD + Option + U</kbd> on Mac).</span>
                        </li>
                        <li className="space-y-1.5">
                          <span>Select all text on that page (<strong className="text-white font-medium">CTRL + A</strong> or <strong className="text-white font-medium">CMD + A</strong>), copy it, and paste it fully in the box below:</span>
                          <textarea
                            rows={3}
                            value={htmlInput}
                            onChange={(e) => setHtmlInput(e.target.value)}
                            maxLength={100000}
                            placeholder="Right-click on your profile page -> View Page Source -> Copy all source code (CTRL+A) and paste here..."
                            className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-2.5 py-2 text-[10px] text-[#e0e1e6] focus:outline-none placeholder:text-zinc-600 font-mono resize-none mt-1"
                          />
                          <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono">
                            <span>*Accepts first 100k characters containing page header metadata</span>
                            <span>{htmlInput.length.toLocaleString()} / 100,000</span>
                          </div>
                        </li>
                      </ol>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handlePerformReset}
                        className="py-2.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center justify-center gap-1 transition select-none cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerValidation}
                        disabled={verifying}
                        className="py-2.5 bg-[#d4af37] hover:bg-[#b08d26] disabled:opacity-50 text-black font-semibold text-[10px] uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        Verify Now
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. STATE: VERIFIED */}
                {userVerification.status === 'verified' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-emerald-950/10 border border-emerald-900/30 rounded-xl p-3.5">
                      <div className="p-2 bg-emerald-950/20 rounded-full border border-emerald-900/50">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <span className="text-[9px] uppercase tracking-wider font-mono text-emerald-400 font-bold block">Verified Identity</span>
                        <span className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                          {userVerification.verifiedIGN}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] text-[#8e9299]">
                        Authenticated via warframe.market profile biography checks. Your listings display as certified.
                        <strong className="text-emerald-400 ml-1 block mt-1">✓ You can now safely remove the token/signature code from your warframe.market biography settings.</strong>
                      </p>

                      <button
                        type="button"
                        onClick={() => setShowConfirmReset(true)}
                        className="w-full py-2 bg-red-950/25 hover:bg-red-950/50 text-red-400 hover:text-red-300 border border-red-900/30 text-xs font-semibold uppercase tracking-wider rounded-lg transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Profile & Listings
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* LISTING CREATION FORM */}
          {user && userVerification.status === 'verified' && (
            <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 space-y-4">
              <div className="border-b border-[#2a2c33]/40 pb-3">
                <h3 className="font-semibold text-sm text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide">
                  <Tag className="w-4 h-4 text-[#d4af37]" />
                  Post Trade Request
                </h3>
              </div>

              <form onSubmit={handleCreateListing} className="space-y-4">
                
                {/* WTS or WTB */}
                <div className="grid grid-cols-2 gap-2 bg-[#0c0d10] p-1 border border-[#2a2c33] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setListType('WTS')}
                    className={`py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition ${listType === 'WTS' ? 'bg-[#d4af37] text-black' : 'text-[#8e9299] hover:text-white'}`}
                  >
                    WTS (Sell)
                  </button>
                  <button
                    type="button"
                    onClick={() => setListType('WTB')}
                    className={`py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition ${listType === 'WTB' ? 'bg-[#d4af37] text-black' : 'text-[#8e9299] hover:text-white'}`}
                  >
                    WTB (Buy)
                  </button>
                </div>

                {/* Item Name & Autocomplete suggestions */}
                <div className="space-y-2 relative">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Item or Junk part name</label>
                  <input
                    type="text"
                    placeholder="e.g. Bronze Prime Junk (15d) or Paris Prime Grip"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                    required
                  />

                  {itemSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[60px] bg-[#0c0d10] border border-[#2f313a] rounded-lg shadow-2xl z-30 overflow-hidden divide-y divide-[#2a2c33]/40 font-mono text-xs">
                      {itemSuggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setItemName(sug);
                            setItemSuggestions([]);
                          }}
                          className="w-full text-left px-3.5 py-2 hover:bg-[#14161c] text-slate-300 hover:text-white transition block"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Shortcuts helpful for junk */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {popularShortcuts.slice(0, 3).map((itemShort, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setItemName(itemShort)}
                        className="px-2 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-md text-[10px] text-zinc-400 hover:text-zinc-200 transition"
                      >
                        +{itemShort.split(' ')[0]} {itemShort.substring(itemShort.lastIndexOf('('))}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price and Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                      Price <span className="text-[#d4af37]">Plat</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Qty available</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-2 bg-[#d4af37] hover:bg-[#b08d26] disabled:opacity-50 text-black font-semibold text-xs uppercase tracking-wider rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  Publish Market Listing
                </button>
              </form>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Listings browse search feed */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* SEARCH ACTIONS BAR */}
          <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search items or usernames..."
                value={searchQuery}
                onInput={(e: React.FormEvent<HTMLInputElement>) => setSearchQuery(e.currentTarget.value)}
                className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 focus:outline-none rounded-lg pl-9 pr-4 py-2.5 text-xs text-white font-mono"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex bg-[#0c0d10] border border-[#2a2c33] rounded-lg p-0.5 text-[10px] font-bold uppercase transition">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-md transition ${typeFilter === 'all' ? 'bg-[#2a2c33] text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('WTS')}
                  className={`px-3 py-1.5 rounded-md transition ${typeFilter === 'WTS' ? 'bg-red-950/50 text-red-400' : 'text-zinc-400 hover:text-white'}`}
                >
                  Sells
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('WTB')}
                  className={`px-3 py-1.5 rounded-md transition ${typeFilter === 'WTB' ? 'bg-blue-950/50 text-blue-400' : 'text-zinc-400 hover:text-white'}`}
                >
                  Buys
                </button>
              </div>

              {/* Verified Badge Checkbox */}
              <button
                type="button"
                onClick={() => setVerifiedFilter(!verifiedFilter)}
                className={`px-3 py-2 rounded-lg border text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 transition select-none ${verifiedFilter ? 'bg-emerald-950/10 border-emerald-900/50 text-emerald-400' : 'bg-[#0c0d10] border-[#2a2c33] text-zinc-400 hover:text-white'}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Only
              </button>
            </div>
          </div>

          {/* LISTINGS FEED CARDS CONTAINER */}
          {filteredListings.length === 0 ? (
            <div className="p-12 text-center bg-[#14161c] border border-[#2a2c33] rounded-xl flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 bg-[#0c0d10] border border-zinc-800 rounded-full flex items-center justify-center text-zinc-500">
                <Search className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#e0e1e6]">No trade listings found</h4>
                <p className="text-xs text-zinc-500 max-w-sm">No active entries matching your select requirements are listed yet. Verification profiles may publish new items in real-time.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredListings.map((listing) => {
                const isWTS = listing.type === 'WTS';
                const isOwner = user && listing.sellerUid === user.uid;
                
                // Copy-paste trade command for Warframe Chat
                const tradeText = isWTS 
                  ? `/w ${listing.sellerIGN} Hi! I want to buy ${listing.itemName} for ${listing.price}p [DucaPlat]`
                  : `/w ${listing.sellerIGN} Hi! I want to sell ${listing.itemName} for ${listing.price}p [DucaPlat]`;

                return (
                  <div
                    key={listing.id}
                    className={`bg-[#14161c] border rounded-xl p-4.5 transition duration-150 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isOwner ? 'border-[#d4af37]/45 shadow-lg shadow-[#d4af37]/3' : 'border-[#2a2c33]'}`}
                  >
                    
                    {/* Left Accent Bar depending on listing type */}
                    <div className={`absolute top-0 bottom-0 left-0 w-1 ${isWTS ? 'bg-red-500' : 'bg-blue-500'}`} />

                    <div className="space-y-2 flex-1 pl-1">
                      
                      {/* Top seller tag & verification */}
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${isWTS ? 'bg-red-950/50 text-red-400 border border-red-900/35' : 'bg-blue-950/50 text-blue-400 border border-blue-900/35'}`}>
                          {listing.type}
                        </span>

                        <span className="font-mono text-xs font-semibold text-[#e0e1e6] flex items-center gap-1 uppercase select-all">
                          {listing.sellerIGN}
                        </span>

                        {listing.isSellerVerified ? (
                          <div className="flex items-center text-[9px] font-semibold text-emerald-400 gap-0.5 bg-emerald-950/10 px-1.5 py-0.5 border border-emerald-900/25 rounded" title="Identity Verified">
                            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>VERIFIED</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-[9px] font-semibold text-zinc-500 gap-0.5 bg-[#0c0d10] px-1.5 py-0.5 border border-transparent rounded" title="Identity Unverified">
                            <HelpCircle className="w-3 h-3 shrink-0" />
                            <span>UNVERIFIED</span>
                          </div>
                        )}

                        {isOwner && (
                          <span className="text-[9px] font-extrabold uppercase bg-zinc-950 text-[#d4af37] border border-[#d4af37]/30 px-1.5 py-0.5 rounded">
                            YOUR LISTING
                          </span>
                        )}
                      </div>

                      {/* Item and Quantity details */}
                      <div className="flex flex-wrap items-baseline gap-2.5">
                        <h4 className="text-[13px] font-semibold text-[#f1f2f6] tracking-wide uppercase font-sans">
                          {listing.itemName}
                        </h4>
                        <span className="text-xs text-zinc-500">
                          Qty: <span className="font-bold text-zinc-300 font-mono">{listing.quantity}</span>
                        </span>
                      </div>

                      {/* COPY FORUM COMMAND BLOCK */}
                      {!isOwner && (
                        <div className="flex items-center gap-1.5 mt-2 bg-[#0c0d10]/60 border border-[#2a2c33]/40 rounded-lg p-1 max-w-md shrink-0">
                          <span className="text-[9px] text-[#8e9299] shrink-0 pl-1.5 font-mono uppercase tracking-wide">Copy command:</span>
                          <div className="flex-1 font-mono text-[10px] text-zinc-400 truncate select-all px-1">
                            {tradeText}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(tradeText, false, listing.id)}
                            className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 rounded text-[9px] text-[#d4af37] border border-[#d4af37]/15 hover:border-[#d4af37]/30 transition uppercase font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            {copiedCommandId === listing.id ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right Price section / Own operations */}
                    <div className="flex sm:flex-col items-end gap-3.5 sm:gap-1.5 justify-between border-t sm:border-0 border-zinc-800/55 pt-3 sm:pt-0 shrink-0">
                      
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-[#8e9299] uppercase select-none block">Price Per Item</span>
                        <div className="flex items-center gap-1 text-base font-semibold text-[#f1f2f6] justify-end">
                          <span className="font-mono">{listing.price}</span>
                          <span className="text-xs text-[#d4af37] uppercase tracking-wide">Plat</span>
                        </div>
                      </div>

                      {/* Owner Operations to manage or clear active listed rows */}
                      {isOwner ? (
                        <div className="flex items-center gap-1 mt-1.5">
                          <button
                            type="button"
                            onClick={() => handleMarkListingStatus(listing.id, 'sold')}
                            className="px-2.5 py-1 bg-emerald-950/20 hover:bg-emerald-950/45 border border-emerald-900/30 text-emerald-400 hover:text-emerald-300 rounded text-[9px] font-bold uppercase transition select-none cursor-pointer"
                          >
                            Mark Sold
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkListingStatus(listing.id, 'cancelled')}
                            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-[#e0e1e6] rounded text-[9px] font-bold uppercase transition select-none cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteListing(listing.id)}
                            className="p-1 bg-red-950/15 hover:bg-red-850/20 border border-red-900/20 text-red-400 rounded transition cursor-pointer"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <a
                          href={`https://forums.warframe.com/profile/${listing.normalizedSellerIGN}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-md text-[10px] text-zinc-300 font-semibold uppercase tracking-wide flex items-center justify-center gap-1 select-none cursor-pointer"
                          title="Contact on forums"
                        >
                          <MessageSquare className="w-3 h-3 text-zinc-400 shrink-0" />
                          Contact
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CUSTOM CONFIRMATION RESET MODAL */}
      {showConfirmReset && (
        <div className="fixed inset-0 bg-[#06070a]/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#14161c] border border-red-900/35 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            
            <div className="flex items-center gap-3 border-b border-[#2a2c33]/45 pb-3 text-red-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="font-bold text-base uppercase tracking-wide">
                Confirm Reset Profile
              </h4>
            </div>

            <p className="text-xs text-[#c4c5cc] leading-relaxed">
              Resetting your verification profile is permanent. 
              This will return your state to "unverified" and will automatically <span className="text-white font-semibold">cancel all of your active listings</span> from the public trade feeds.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-300 transition select-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePerformReset}
                disabled={actionLoading}
                className="py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1 select-none cursor-pointer"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Yes, Reset Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
