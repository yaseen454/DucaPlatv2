/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  TrendingUp,
  Bookmark,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { PRIME_ITEMS } from '../data/primeData';
import { InventoryCount } from '../types';
import { getProfitStats, generateCostsCustom } from '../utils/mathUtils';
import platinumIcon from '../data/platinum.png';
import ducatIcon from '../data/480px-OrokinDucats.png';
import AnovaPricingModal from './AnovaPricingModal';

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
  // bulk junk fields
  isPrimeJunk?: boolean;
  counts?: InventoryCount;
  totalDucats?: number;
  totalParts?: number;
  partDistribution?: string;
  tradesRequired?: number;
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

// Helper to convert item name into an InventoryCount
export function guessCountsFromItem(nameStr: string, qtyValue: number): InventoryCount {
  const empty: InventoryCount = { bronze15: 0, bronze25: 0, silver45: 0, silver65: 0, gold: 0 };
  const name = nameStr.trim().toLowerCase();
  if (!name) return empty;
  
  // Explicit junk matching
  if (name.includes('bronze prime junk (15d)') || name.includes('bronze 15') || (name.includes('bronze') && name.includes('15'))) {
    return { ...empty, bronze15: qtyValue };
  }
  if (name.includes('bronze prime junk (25d)') || name.includes('bronze 25') || (name.includes('bronze') && name.includes('25'))) {
    return { ...empty, bronze25: qtyValue };
  }
  if (name.includes('uncommon prime junk (45d)') || name.includes('silver 45') || (name.includes('uncommon') && name.includes('45')) || (name.includes('silver') && name.includes('45'))) {
    return { ...empty, silver45: qtyValue };
  }
  if (name.includes('uncommon prime junk (65d)') || name.includes('silver 65') || (name.includes('uncommon') && name.includes('65')) || (name.includes('silver') && name.includes('65'))) {
    return { ...empty, silver65: qtyValue };
  }
  if (name.includes('gold prime junk (100d)') || name.includes('gold') || name.includes('rare') || name.includes('100d')) {
    return { ...empty, gold: qtyValue };
  }
  
  // Match with database!
  const matched = PRIME_ITEMS.find(item => item.part.toLowerCase() === name);
  if (matched) {
    const v = matched.ducat_value;
    if (v === 15) return { ...empty, bronze15: qtyValue };
    if (v === 25) return { ...empty, bronze25: qtyValue };
    if (v === 45) return { ...empty, silver45: qtyValue };
    if (v === 65) return { ...empty, silver65: qtyValue };
    if (v === 100) return { ...empty, gold: qtyValue };
  }
  
  // Fallback based on typical search
  if (name.includes('grip') || name.includes('stock') || name.includes('receiver') || name.includes('barrel') || name.includes('link')) {
    return { ...empty, bronze15: qtyValue };
  }
  
  return { ...empty, bronze15: qtyValue };
}

interface MarketTabProps {
  narrowConfig?: any;
  broadConfig?: any;
  onAnalyzeInCalculator?: (counts: InventoryCount) => void;
}

export default function MarketTab({
  narrowConfig,
  broadConfig,
  onAnalyzeInCalculator
}: MarketTabProps) {
  const { user } = useAuth();

  const activeNarrowConfig = narrowConfig || {
    b15: 1,
    b25: { min: 1, max: 2 },
    s45: { min: 2, max: 4 },
    s65: { min: 4, max: 7 },
    g: { min: 7, max: 10 }
  };
  const activeBroadConfig = broadConfig || {
    b15: 1,
    b25: { min: 1, max: 2 },
    s45: { min: 2, max: 4 },
    s65: { min: 2, max: 7 },
    g: { min: 5, max: 10 }
  };

  const getListingPriceSuggestion = (c: InventoryCount) => {
    const totalParts = c.bronze15 + c.bronze25 + c.silver45 + c.silver65 + c.gold;
    if (totalParts === 0) return null;
    
    const costsNarrow = generateCostsCustom(activeNarrowConfig);
    const costsBroad = generateCostsCustom(activeBroadConfig);
    
    const statsNarrow = getProfitStats(c, costsNarrow);
    const statsBroad = getProfitStats(c, costsBroad);
    
    const minVal = Math.floor(Math.min(statsNarrow.min, statsBroad.min));
    const maxVal = Math.ceil(Math.max(statsNarrow.max, statsBroad.max));
    const avgVal = Math.round((statsNarrow.average + statsBroad.average) / 2);
    
    return {
      min: minVal,
      max: maxVal,
      average: avgVal,
    };
  };
  
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
  const [marketSubTab, setMarketSubTab] = useState<'browse' | 'manage' | 'saved'>('browse');
  const [claimedInput, setClaimedInput] = useState('');
  const [profileSlugInput, setProfileSlugInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'WTS' | 'WTB'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCommandId, setCopiedCommandId] = useState<string | null>(null);

  // Saved presets & bulk custom junk states
  const [savedTrades, setSavedTrades] = useState<any[]>([]);
  const [bulkCounts, setBulkCounts] = useState<InventoryCount>({
    bronze15: 0,
    bronze25: 0,
    silver45: 0,
    silver65: 0,
    gold: 0
  });

  const totalParts = (bulkCounts.bronze15 || 0) + 
    (bulkCounts.bronze25 || 0) + 
    (bulkCounts.silver45 || 0) + 
    (bulkCounts.silver65 || 0) + 
    (bulkCounts.gold || 0);

  const totalDucats = 
    (bulkCounts.bronze15 || 0) * 15 + 
    (bulkCounts.bronze25 || 0) * 25 + 
    (bulkCounts.silver45 || 0) * 45 + 
    (bulkCounts.silver65 || 0) * 65 + 
    (bulkCounts.gold || 0) * 100;

  const loadSavedTrades = () => {
    try {
      const existing = localStorage.getItem('saved_trades_for_market');
      if (existing) {
        setSavedTrades(JSON.parse(existing));
      } else {
        setSavedTrades([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSavedTrades();
  }, [marketSubTab]);

  const handleRemoveSavedTrade = (id: string) => {
    try {
      const existing = localStorage.getItem('saved_trades_for_market');
      if (existing) {
        const trades = JSON.parse(existing);
        const filtered = trades.filter((t: any) => t.id !== id);
        localStorage.setItem('saved_trades_for_market', JSON.stringify(filtered));
        setSavedTrades(filtered);
      }
    } catch (e) {
      console.error(e);
    }
  };
  
  // Create listing states
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState<number>(10);
  const [quantity, setQuantity] = useState<number>(1);
  const [listType, setListType] = useState<'WTS' | 'WTB'>('WTS');
  const [bulkListType, setBulkListType] = useState<'WTS' | 'WTB'>('WTS');
  const [standardNote, setStandardNote] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkPriceCustom, setBulkPriceCustom] = useState<number | null>(null);
  const [bulkRarityPrices, setBulkRarityPrices] = useState<InventoryCount>({
    bronze15: 1,
    bronze25: 2,
    silver45: 3,
    silver65: 5,
    gold: 8
  });
  const [isBulkAnovaOpen, setIsBulkAnovaOpen] = useState(false);
  
  // Statuses
  const [verifying, setVerifying] = useState(false);
  const [verificationCooldown, setVerificationCooldown] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showCasingInput, setShowCasingInput] = useState(false);
  const [newCasingValue, setNewCasingValue] = useState('');
  const [casingLoading, setCasingLoading] = useState(false);

  // Suggested / popular prime search lists
  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);
  const popularShortcuts = [
    'Bronze Prime Junk (15d)',
    'Bronze Prime Junk (25d)',
    'Uncommon Prime Junk (45d)',
    'Uncommon Prime Junk (65d)',
    'Gold Prime Junk (100d)',
  ];

  // Track previous verification status to detect transitions
  const prevVerificationStatusRef = useRef<string>('unverified');

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

  // Guard: Clear inputs only when transitioning FROM pending TO unverified
  useEffect(() => {
    const wasInPending = prevVerificationStatusRef.current === 'pending';
    const nowUnverified = userVerification.status === 'unverified';
    
    if (wasInPending && nowUnverified) {
      setClaimedInput('');
      setProfileSlugInput('');
    }
    
    // Always update ref for next check
    prevVerificationStatusRef.current = userVerification.status;
  }, [userVerification.status]);

  // 3. Manage verification cooldown timer (30-second countdown)
  useEffect(() => {
    if (!verificationCooldown || cooldownSeconds <= 0) return;

    const timerId = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setVerificationCooldown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [verificationCooldown, cooldownSeconds]);

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

  // Request token block generation (unverified state) - Two-step verification
  const handleInitiateVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const inGameName = claimedInput.trim();
    const profileSlug = profileSlugInput.trim();

    if (!inGameName) {
      setErrorMsg('Please enter your in-game Warframe username.');
      return;
    }

    if (!profileSlug) {
      setErrorMsg('Please enter your Warframe Market profile URL slug.');
      return;
    }

    setActionLoading(true);
    const token = generateVerifyToken();
    const normalizedSlug = profileSlug.toLowerCase();

    try {
      const userRef = doc(db, 'users', user.uid);
      // Two-step verification: in-game name + profile slug for API lookup
      await updateDoc(userRef, {
        'verification.status': 'pending',
        'verification.claimedIGN': inGameName,
        'verification.profileSlug': normalizedSlug,
        'verification.normalizedIGN': normalizedSlug,
        'verification.verifiedIGN': null,
        'verification.token': token,
        'verification.updatedAt': serverTimestamp()
      });
      setSuccessMsg(`✓ Verification token successfully created! Code: ${token}`);
      // Keep inputs populated so user can see what they submitted
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setErrorMsg('Failed to create verification token. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Intercept the textarea paste action to safely parse and discard private page state in-browser
  // Removed handleSourcePaste - no longer needed with WFM v2 API
  // Verification now uses official API endpoint with JWT authorization

  // Trigger POST verification against WFM v2 API (pending verification state)
  const handleTriggerValidation = async () => {
    if (!user || userVerification.status !== 'pending') return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const code = userVerification.token?.trim();
    if (!code) {
      setErrorMsg('No verification code found. Please initiate verification first.');
      return;
    }

    // Start cooldown
    setVerificationCooldown(true);
    setCooldownSeconds(30);
    setVerifying(true);

    try {
      const checkRes = await fetch('/.netlify/functions/verify-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          claimedIGN: userVerification.claimedIGN,
          profileSlug: userVerification.profileSlug,
          verificationCode: code
        })
      });

      const result = await checkRes.json();
      if (result.success) {
        setSuccessMsg(`✓ Congratulations! Successfully verified as: ${result.verifiedIGN}. You can now safely remove the code from your profile biography.`);
      } else {
        // Only show cooldown on actual verification attempts, not on errors
        setVerificationCooldown(false);
        setCooldownSeconds(0);
        setErrorMsg(result.error || 'Verification failed. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setVerificationCooldown(false);
      setCooldownSeconds(0);
      setErrorMsg('Network error reaching verification service. Please try again shortly.');
    } finally {
      setVerifying(false);
    }
  };

  // Retry with different username (pending state) - clears verification without affecting listings
  const handleRetryDifferentUsername = async () => {
    if (!user) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setActionLoading(true);
    
    // Clear input state IMMEDIATELY (before async Firestore call)
    setClaimedInput('');
    setProfileSlugInput('');

    try {
      const userRef = doc(db, 'users', user.uid);
      // Reset verification ONLY using field-level updates (listings remain active)
      await updateDoc(userRef, {
        'verification.status': 'unverified',
        'verification.claimedIGN': '',
        'verification.normalizedIGN': '',
        'verification.verifiedIGN': null,
        'verification.token': null,
        'verification.updatedAt': serverTimestamp()
      });
      setSuccessMsg('Ready to try a different username.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/verification`);
      setErrorMsg('Failed to reset verification. Try again.');
    } finally {
      setActionLoading(false);
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
        'verification.status': 'unverified',
        'verification.claimedIGN': '',
        'verification.profileSlug': '',
        'verification.normalizedIGN': '',
        'verification.verifiedIGN': null,
        'verification.token': null,
        'verification.updatedAt': serverTimestamp()
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
      setProfileSlugInput('');
      setSuccessMsg('Profile and active listings reset successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/reset`);
      setErrorMsg('Failed to reset listing profiles.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCasing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userVerification.verifiedIGN) return;
    const inputval = newCasingValue.trim();
    if (!inputval) return;

    if (inputval.toLowerCase() !== userVerification.normalizedIGN) {
      setErrorMsg(`Adjusted capitalization must be case-insensitively identical to your verified name "${userVerification.verifiedIGN}". You cannot change to a completely different user.`);
      return;
    }

    setCasingLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/.netlify/functions/verify-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          claimedIGN: inputval,
          action: 'update-casing'
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`✓ Capitalization corrected successfully in profile and active listings! Selected casing: ${data.verifiedIGN}`);
        setShowCasingInput(false);
      } else {
        setErrorMsg(data.error || 'Failed to update casing of username.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to call serverless function. Please try again shortly.');
    } finally {
      setCasingLoading(false);
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
        note: standardNote.trim(),
        createdAt: serverTimestamp()
      });

      // Reset form on success
      setItemName('');
      setPrice(10);
      setQuantity(1);
      setStandardNote('');
      setSuccessMsg(`Listed "${item}" successfully!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'listings');
      setErrorMsg('Firestore rejected the listing. Verify rule settings.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishPrimeJunk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      setErrorMsg('Log in using Google first to publish trades.');
      return;
    }

    if (userVerification.status !== 'verified') {
      setErrorMsg('Identity verification is required. Complete verification under "My Trade Panel & Verification" first.');
      return;
    }

    const totalParts = (bulkCounts.bronze15 || 0) + 
      (bulkCounts.bronze25 || 0) + 
      (bulkCounts.silver45 || 0) + 
      (bulkCounts.silver65 || 0) + 
      (bulkCounts.gold || 0);
    if (totalParts === 0) {
      setErrorMsg('Cannot publish empty bundle. Specify at least one prime part.');
      return;
    }

    const totalDucats = 
      (bulkCounts.bronze15 || 0) * 15 + 
      (bulkCounts.bronze25 || 0) * 25 + 
      (bulkCounts.silver45 || 0) * 45 + 
      (bulkCounts.silver65 || 0) * 65 + 
      (bulkCounts.gold || 0) * 100;

    const finalPrice = (bulkCounts.bronze15 || 0) * (bulkRarityPrices.bronze15 || 0) +
                       (bulkCounts.bronze25 || 0) * (bulkRarityPrices.bronze25 || 0) +
                       (bulkCounts.silver45 || 0) * (bulkRarityPrices.silver45 || 0) +
                       (bulkCounts.silver65 || 0) * (bulkRarityPrices.silver65 || 0) +
                       (bulkCounts.gold || 0) * (bulkRarityPrices.gold || 0);

    const tradesRequired = Math.ceil(totalParts / 6);

    const distList = [];
    if (bulkCounts.bronze15 > 0) distList.push(`15d x ${bulkCounts.bronze15}`);
    if (bulkCounts.bronze25 > 0) distList.push(`25d x ${bulkCounts.bronze25}`);
    if (bulkCounts.silver45 > 0) distList.push(`45d x ${bulkCounts.silver45}`);
    if (bulkCounts.silver65 > 0) distList.push(`65d x ${bulkCounts.silver65}`);
    if (bulkCounts.gold > 0) distList.push(`100d x ${bulkCounts.gold}`);
    const partDistribution = distList.join(', ');

    setActionLoading(true);

    try {
      await addDoc(collection(db, 'listings'), {
        sellerUid: user.uid,
        sellerIGN: userVerification.verifiedIGN,
        normalizedSellerIGN: userVerification.normalizedIGN,
        isSellerVerified: true,
        itemName: `Bulk Prime Junk (${totalParts} parts)`,
        price: finalPrice,
        quantity: 1,
        type: bulkListType,
        status: 'active',
        note: bulkNote.trim(),
        isPrimeJunk: true,
        counts: { ...bulkCounts },
        rarityPrices: { ...bulkRarityPrices },
        totalDucats,
        totalParts,
        partDistribution,
        tradesRequired,
        createdAt: serverTimestamp()
      });

      setSuccessMsg(`✓ Bulk Prime Junk Bundle successfully listed as ${bulkListType}! ${totalParts} parts for ${finalPrice} Plat. (${totalDucats} Ducats).`);
      setBulkCounts({
        bronze15: 0,
        bronze25: 0,
        silver45: 0,
        silver65: 0,
        gold: 0
      });
      setBulkNote('');
      setBulkPriceCustom(null);
      setBulkRarityPrices({
        bronze15: 1,
        bronze25: 2,
        silver45: 3,
        silver65: 5,
        gold: 8
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'listings');
      setErrorMsg('Failed to publish bulk junk listing.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishPresetDirectly = async (presetCounts: InventoryCount, presetName: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      setErrorMsg('Log in using Google first to publish trades.');
      return;
    }

    if (userVerification.status !== 'verified') {
      setErrorMsg('Identity verification is required. Complete verification under "My Trade Panel & Verification" first.');
      return;
    }

    const totalParts = Object.values(presetCounts).reduce((a, b) => a + b, 0);
    if (totalParts === 0) {
      setErrorMsg('Cannot publish empty bundle.');
      return;
    }

    const totalDucats = 
      presetCounts.bronze15 * 15 + 
      presetCounts.bronze25 * 25 + 
      presetCounts.silver45 * 45 + 
      presetCounts.silver65 * 65 + 
      presetCounts.gold * 100;

    const pricePlat = Math.round(totalDucats / 25);
    const tradesRequired = Math.ceil(totalParts / 6);

    const distList = [];
    if (presetCounts.bronze15 > 0) distList.push(`15d x ${presetCounts.bronze15}`);
    if (presetCounts.bronze25 > 0) distList.push(`25d x ${presetCounts.bronze25}`);
    if (presetCounts.silver45 > 0) distList.push(`45d x ${presetCounts.silver45}`);
    if (presetCounts.silver65 > 0) distList.push(`65d x ${presetCounts.silver65}`);
    if (presetCounts.gold > 0) distList.push(`100d x ${presetCounts.gold}`);
    const partDistribution = distList.join(', ');

    setActionLoading(true);

    try {
      await addDoc(collection(db, 'listings'), {
        sellerUid: user.uid,
        sellerIGN: userVerification.verifiedIGN,
        normalizedSellerIGN: userVerification.normalizedIGN,
        isSellerVerified: true,
        itemName: `Bulk Prime Junk (${totalParts} parts)`,
        price: pricePlat,
        quantity: 1,
        type: bulkListType,
        status: 'active',
        note: '',
        isPrimeJunk: true,
        counts: { ...presetCounts },
        totalDucats,
        totalParts,
        partDistribution,
        tradesRequired,
        createdAt: serverTimestamp()
      });

      setSuccessMsg(`✓ Published preset "${presetName}" directly as ${bulkListType}! Listed ${totalParts} parts for ${pricePlat} Plat.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'listings');
      setErrorMsg('Failed to publish bulk junk listing.');
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

      {/* Sub navigation tabs */}
      <div className="flex border-b border-[#2a2c33]/50">
        <button
          onClick={() => setMarketSubTab('browse')}
          className={`flex-1 sm:flex-initial px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all relative -mb-px border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
            marketSubTab === 'browse'
              ? 'border-[#d4af37] text-[#d4af37] bg-slate-900/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShoppingBag className="w-4 h-4 shrink-0 text-[#d4af37]" />
          <span>Browse listings</span>
          <span className="bg-[#0c0d10] text-[#e0e1e6] border border-[#2a2c33] text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
            {filteredListings.length}
          </span>
        </button>

        <button
          onClick={() => setMarketSubTab('saved')}
          className={`flex-1 sm:flex-initial px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all relative -mb-px border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
            marketSubTab === 'saved'
              ? 'border-[#d4af37] text-[#d4af37] bg-slate-900/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Tag className="w-4 h-4 shrink-0 text-[#d4af37]" />
          <span>Saved listings</span>
          {savedTrades.length > 0 && (
            <span className="bg-[#0c0d10] text-[#e0e1e6] border border-[#2a2c33] text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
              {savedTrades.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setMarketSubTab('manage')}
          className={`flex-1 sm:flex-initial px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all relative -mb-px border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
            marketSubTab === 'manage'
              ? 'border-[#d4af37] text-[#d4af37] bg-slate-900/10'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <UserCheck className="w-4 h-4 shrink-0 text-[#d4af37]" />
          <span>My Trade Panel & Verification</span>
          {user && (
            <span className={`w-2 h-2 rounded-full ${userVerification.status === 'verified' ? 'bg-emerald-500 shadow shadow-emerald-500/20' : 'bg-amber-500 animate-pulse'}`} />
          )}
        </button>
      </div>

      {marketSubTab === 'saved' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn max-w-7xl mx-auto w-full">
          {/* Left Column: Manual Quantity Seller / Editor */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 space-y-5">
              <div className="border-b border-[#2a2c33]/40 pb-3">
                <h3 className="font-semibold text-sm text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide">
                  <Coins className="w-4 h-4 text-[#d4af37]" />
                  Bulk Junk Bundle Builder & Seller
                </h3>
                <p className="text-[11px] text-[#8e9299] mt-0.5">
                  Build your bundle manually or click a saved preset from the right-hand panel. Prices automatically compute at <strong className="text-[#d4af37]">25 Ducats : 1 Platinum</strong>.
                </p>
              </div>

              {/* WTS or WTB Operation Toggle */}
              <div className="grid grid-cols-2 gap-2 bg-[#0c0d10] p-1 border border-[#2a2c33] rounded-lg">
                <button
                  type="button"
                  onClick={() => setBulkListType('WTS')}
                  className={`py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer ${bulkListType === 'WTS' ? 'bg-[#d4af37] text-black' : 'text-[#8e9299] hover:text-white'}`}
                >
                  WTS (Sell)
                </button>
                <button
                  type="button"
                  onClick={() => setBulkListType('WTB')}
                  className={`py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer ${bulkListType === 'WTB' ? 'bg-[#d4af37] text-black' : 'text-[#8e9299] hover:text-white'}`}
                >
                  WTB (Buy)
                </button>
              </div>

              {/* Input grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bronze 15 */}
                <div className="bg-[#0c0d10] p-3 border border-[#cd7f32]/20 rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase text-[#cd7f32] tracking-wider">Bronze (15 Ducats)</span>
                    <span className="text-[10px] text-zinc-500 font-mono">15d parts count</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, bronze15: Math.max(0, prev.bronze15 - 1) }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={bulkCounts.bronze15 || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setBulkCounts(prev => ({ ...prev, bronze15: val >= 0 ? val : 0 }));
                      }}
                      className="w-12 text-center bg-[#14161c] border border-zinc-700 text-xs text-white font-mono h-7 focus:outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, bronze15: prev.bronze15 + 1 }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Bronze 25 */}
                <div className="bg-[#0c0d10] p-3 border border-[#cd7f32]/45 rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase text-[#cd7f32] tracking-wider">Bronze (25 Ducats)</span>
                    <span className="text-[10px] text-zinc-500 font-mono">25d parts count</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, bronze25: Math.max(0, prev.bronze25 - 1) }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={bulkCounts.bronze25 || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setBulkCounts(prev => ({ ...prev, bronze25: val >= 0 ? val : 0 }));
                      }}
                      className="w-12 text-center bg-[#14161c] border border-zinc-700 text-xs text-white font-mono h-7 focus:outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, bronze25: prev.bronze25 + 1 }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Silver 45 */}
                <div className="bg-[#0c0d10] p-3 border border-[#c0c0c0]/25 rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase text-slate-300 tracking-wider">Silver (45 Ducats)</span>
                    <span className="text-[10px] text-zinc-500 font-mono">45d parts count</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, silver45: Math.max(0, prev.silver45 - 1) }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={bulkCounts.silver45 || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setBulkCounts(prev => ({ ...prev, silver45: val >= 0 ? val : 0 }));
                      }}
                      className="w-12 text-center bg-[#14161c] border border-zinc-700 text-xs text-white font-mono h-7 focus:outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, silver45: prev.silver45 + 1 }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Silver 65 */}
                <div className="bg-[#0c0d10] p-3 border border-[#c0c0c0]/45 rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase text-slate-300 tracking-wider">Silver (65 Ducats)</span>
                    <span className="text-[10px] text-zinc-500 font-mono">65d parts count</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, silver65: Math.max(0, prev.silver65 - 1) }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={bulkCounts.silver65 || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setBulkCounts(prev => ({ ...prev, silver65: val >= 0 ? val : 0 }));
                      }}
                      className="w-12 text-center bg-[#14161c] border border-zinc-700 text-xs text-white font-mono h-7 focus:outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, silver65: prev.silver65 + 1 }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Gold 100 */}
                <div className="bg-[#0c0d10] p-3 border border-[#d4af37]/30 rounded-lg flex items-center justify-between gap-2 sm:col-span-2">
                  <div>
                    <span className="block text-[10px] font-extrabold uppercase text-[#d4af37] tracking-wider">Gold (100 Ducats)</span>
                    <span className="text-[10px] text-zinc-500 font-mono">100d parts count</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, gold: Math.max(0, prev.gold - 1) }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={bulkCounts.gold || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setBulkCounts(prev => ({ ...prev, gold: val >= 0 ? val : 0 }));
                      }}
                      className="w-12 text-center bg-[#14161c] border border-[#d4af37]/30 text-xs text-white font-mono h-7 focus:outline-none focus:border-[#d4af37]"
                    />
                    <button
                      type="button"
                      onClick={() => setBulkCounts(prev => ({ ...prev, gold: prev.gold + 1 }))}
                      className="w-7 h-7 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700/50 rounded flex items-center justify-center text-zinc-400 font-bold text-sm cursor-pointer select-none active:scale-90 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Computed margins info */}
              {(() => {
                const totalParts = (bulkCounts.bronze15 || 0) + 
                  (bulkCounts.bronze25 || 0) + 
                  (bulkCounts.silver45 || 0) + 
                  (bulkCounts.silver65 || 0) + 
                  (bulkCounts.gold || 0);
                const totalDucats = 
                  (bulkCounts.bronze15 || 0) * 15 + 
                  (bulkCounts.bronze25 || 0) * 25 + 
                  (bulkCounts.silver45 || 0) * 45 + 
                  (bulkCounts.silver65 || 0) * 65 + 
                  (bulkCounts.gold || 0) * 100;
                
                const sumPricePlat = 
                  (bulkCounts.bronze15 || 0) * (bulkRarityPrices.bronze15 || 0) +
                  (bulkCounts.bronze25 || 0) * (bulkRarityPrices.bronze25 || 0) +
                  (bulkCounts.silver45 || 0) * (bulkRarityPrices.silver45 || 0) +
                  (bulkCounts.silver65 || 0) * (bulkRarityPrices.silver65 || 0) +
                  (bulkCounts.gold || 0) * (bulkRarityPrices.gold || 0);

                const tradesRequired = Math.ceil(totalParts / 6);

                return (
                  <div className="bg-[#0c0d10] p-4 rounded-xl border border-[#2a2c33]/80 space-y-4">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Dynamic Bundle Appraisal</h4>
                    <div className="grid grid-cols-2 gap-3.5 pt-1">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#8e9299] uppercase">Total Parts Selected</span>
                        <div className="text-white text-base font-mono font-extrabold">{totalParts} <span className="text-[10px] text-zinc-500 font-normal font-sans">pieces</span></div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#8e9299] uppercase">Total Ducat Pool</span>
                        <div className="text-[#d4af37] text-base font-mono font-extrabold flex items-center gap-0.5">
                          <span>{totalDucats}</span>
                          <img src={ducatIcon} className="w-3.5 h-3.5 object-contain inline" alt="D" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#8e9299] uppercase">Trades Needed</span>
                        <div className="text-pink-400 text-base font-mono font-extrabold">{tradesRequired} <span className="text-[10px] text-zinc-500 font-normal font-sans">trades (max 6/trade)</span></div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#d4af37] uppercase">Summed Total Bundle Price</span>
                        <div className="text-emerald-400 text-base font-mono font-extrabold flex items-center gap-0.5">
                          <span>{sumPricePlat}</span>
                          <img src={platinumIcon} className="w-4 h-4 object-contain inline" alt="Pt" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-[#8e9299] leading-normal p-2.5 bg-zinc-950/40 border border-zinc-900 rounded-md">
                      Formula: <strong className="text-zinc-300 font-mono">({bulkCounts.bronze15 || 0}x{bulkRarityPrices.bronze15}p + {bulkCounts.bronze25 || 0}x{bulkRarityPrices.bronze25}p + {bulkCounts.silver45 || 0}x{bulkRarityPrices.silver45}p + {bulkCounts.silver65 || 0}x{bulkRarityPrices.silver65}p + {bulkCounts.gold || 0}x{bulkRarityPrices.gold}p) = {sumPricePlat}p</strong>
                    </div>

                    {/* Integrated ANOVA modal triggers */}
                    <div className="bg-[#14161c]/50 p-3 rounded-lg border border-[#2a2c33] text-xs text-zinc-400 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[#d4af37] font-semibold text-[10px] uppercase tracking-wider">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>ANOVA STRATEGIC PRICING</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsBulkAnovaOpen(true)}
                          className="text-[9px] text-[#d4af37] bg-[#d4af37]/10 hover:bg-[#d4af37]/20 px-2.5 py-1 rounded border border-[#d4af37]/25 font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1"
                        >
                          Launch Pricing Wizard
                        </button>
                      </div>
                      <p className="text-[9px] text-zinc-500 leading-normal">
                        Not sure how to price your items? Click to run automated ANOVA regression models on active trade sets and apply high-performing strategy patterns instantly.
                      </p>
                    </div>

                    {/* Manual fine-tuning inputs */}
                    <div className="space-y-2 pt-2 border-t border-zinc-900">
                      <span className="block text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Fine-Tune Individual Part Prices (Plat):</span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div className="p-2 bg-[#0c0d10] border border-zinc-800 rounded text-center space-y-1">
                          <span className="block text-[8px] uppercase tracking-wider text-[#cd7f32]">B15 (Bronze)</span>
                          <input
                            type="number"
                            min="0"
                            value={bulkRarityPrices.bronze15}
                            onChange={(e) => setBulkRarityPrices(prev => ({ ...prev, bronze15: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-[#14161c] border border-zinc-800 text-center font-mono text-xs rounded py-0.5 focus:outline-none focus:border-[#d4af37] text-white"
                          />
                        </div>
                        <div className="p-2 bg-[#0c0d10] border border-zinc-800 rounded text-center space-y-1">
                          <span className="block text-[8px] uppercase tracking-wider text-[#cd7f32]">B25 (Bronze)</span>
                          <input
                            type="number"
                            min="0"
                            value={bulkRarityPrices.bronze25}
                            onChange={(e) => setBulkRarityPrices(prev => ({ ...prev, bronze25: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-[#14161c] border border-zinc-800 text-center font-mono text-xs rounded py-0.5 focus:outline-none focus:border-[#d4af37] text-white"
                          />
                        </div>
                        <div className="p-2 bg-[#0c0d10] border border-zinc-800 rounded text-center space-y-1">
                          <span className="block text-[8px] uppercase tracking-wider text-zinc-300">S45 (Silver)</span>
                          <input
                            type="number"
                            min="0"
                            value={bulkRarityPrices.silver45}
                            onChange={(e) => setBulkRarityPrices(prev => ({ ...prev, silver45: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-[#14161c] border border-zinc-800 text-center font-mono text-xs rounded py-0.5 focus:outline-none focus:border-[#d4af37] text-white"
                          />
                        </div>
                        <div className="p-2 bg-[#0c0d10] border border-zinc-800 rounded text-center space-y-1">
                          <span className="block text-[8px] uppercase tracking-wider text-zinc-300">S65 (Silver)</span>
                          <input
                            type="number"
                            min="0"
                            value={bulkRarityPrices.silver65}
                            onChange={(e) => setBulkRarityPrices(prev => ({ ...prev, silver65: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-[#14161c] border border-zinc-800 text-center font-mono text-xs rounded py-0.5 focus:outline-none focus:border-[#d4af37] text-white"
                          />
                        </div>
                        <div className="p-2 bg-[#0c0d10] border border-zinc-800 rounded text-center space-y-1 col-span-2 sm:col-span-1">
                          <span className="block text-[8px] uppercase tracking-wider text-[#d4af37]">G100 (Gold)</span>
                          <input
                            type="number"
                            min="0"
                            value={bulkRarityPrices.gold}
                            onChange={(e) => setBulkRarityPrices(prev => ({ ...prev, gold: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-full bg-[#14161c] border border-zinc-800 text-center font-mono text-xs rounded py-0.5 focus:outline-none focus:border-[#d4af37] text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

                    {/* Custom note */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                        <span>Bundle Special Notes</span>
                        <span className="text-zinc-600 font-normal">Optional</span>
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        placeholder="e.g. Bulk seller, online now! No split orders."
                        value={bulkNote}
                        onChange={(e) => setBulkNote(e.target.value)}
                        className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder-zinc-500"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2">
                       {!user ? (
                        <div className="text-xs text-zinc-500 text-center py-2 border border-dashed border-zinc-800 rounded">
                           Please Log In via Google to publish trades on the Live Board.
                        </div>
                      ) : userVerification.status !== 'verified' ? (
                        <div className="space-y-2">
                          <p className="text-[11px] text-red-400 text-center">
                            You must complete identity verification to post listed trades.
                          </p>
                          <button
                            type="button"
                            onClick={() => setMarketSubTab('manage')}
                            className="w-full py-2.5 bg-[#2a2c33] hover:bg-[#3f414a] text-[#d4af37] rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                          >
                            Go To Verification Panel &rarr;
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePublishPrimeJunk()}
                          disabled={totalParts === 0 || actionLoading}
                          className={`w-full py-2.5 disabled:opacity-40 text-black font-extrabold text-xs uppercase tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer select-none ${bulkListType === 'WTS' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                        >
                          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                          {bulkListType === 'WTS' ? 'Publish Bulk Bundle (WTS - Sell)' : 'Publish Bulk Bundle (WTB - Buy)'}
                        </button>
                      )}
                    </div>
                  </div>

            {/* Standard Post Trade Request card for verified players inside the Bulk Junk subtab */}
            {user && userVerification.status === 'verified' && (
              <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 space-y-4 animate-fadeIn">
                <div className="border-b border-[#2a2c33]/40 pb-3">
                  <h3 className="font-semibold text-sm text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide">
                    <Tag className="w-4 h-4 text-[#d4af37]" />
                    Post Standard Trade Request
                  </h3>
                  <p className="text-[10px] text-[#8e9299] mt-0.5">
                    Post standard individual parts or prime junk trades immediately on the live board.
                  </p>
                </div>

                <form onSubmit={handleCreateListing} className="space-y-4">
                  {/* WTS or WTB */}
                  <div className="grid grid-cols-2 gap-2 bg-[#0c0d10] p-1 border border-[#2a2c33] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setListType('WTS')}
                      className={`py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer ${listType === 'WTS' ? 'bg-[#d4af37] text-black' : 'text-[#8e9299] hover:text-white'}`}
                    >
                      WTS (Sell)
                    </button>
                    <button
                      type="button"
                      onClick={() => setListType('WTB')}
                      className={`py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer ${listType === 'WTB' ? 'bg-[#d4af37] text-black' : 'text-[#8e9299] hover:text-white'}`}
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
                        className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-sans">Qty available</label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Pricing Suggestion */}
                  {(() => {
                    const currentStandardCounts = guessCountsFromItem(itemName, quantity);
                    const standardPriceSuggestion = getListingPriceSuggestion(currentStandardCounts);
                    if (!standardPriceSuggestion) return null;
                    return (
                      <div className="text-[11px] bg-[#0c0d10] p-2.5 rounded border border-[#2a2c33] text-zinc-400 space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span>📊 Statistical expected value:</span>
                          <span className="font-semibold text-[#d4af37] font-mono">{standardPriceSuggestion.average}p</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-zinc-500">
                          <span>Market Price Range:</span>
                          <span className="font-mono text-zinc-300 font-semibold">{standardPriceSuggestion.min}p - {standardPriceSuggestion.max}p</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setPrice(standardPriceSuggestion.average)}
                          className="text-[9px] text-[#d4af37] uppercase font-bold tracking-wider hover:underline block pt-0.5"
                        >
                          Use Statistical Average ({standardPriceSuggestion.average}p)
                        </button>
                      </div>
                    );
                  })()}

                  {/* Note input field */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                      <span>Listing Note</span>
                      <span className="text-zinc-600 font-normal">Optional</span>
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="e.g., Fast trade, online now! No negotiations."
                      value={standardNote}
                      onChange={(e) => setStandardNote(e.target.value)}
                      className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder-zinc-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-[#d4af37] hover:bg-[#b08d26] disabled:opacity-50 text-black font-semibold text-xs uppercase tracking-wider rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg font-sans"
                  >
                    <Plus className="w-4 h-4" />
                    Publish Standard Listing
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Right Column: Saved Drafts Presets */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 space-y-4">
              <div className="border-b border-[#2a2c33]/40 pb-3">
                <h3 className="font-semibold text-sm text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide">
                  <Bookmark className="w-4 h-4 text-emerald-400" />
                  Your Saved Trade Presets
                </h3>
                <p className="text-[11px] text-[#8e9299]">
                  Trade items saved via the <strong className="text-white">"Save to Trades"</strong> buttons in the Calculator, Directory, and OCR Scans.
                </p>
              </div>

              {savedTrades.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 flex flex-col items-center justify-center space-y-3 bg-[#0c0d10]/40 rounded-xl border border-dashed border-[#2a2c33]/60">
                  <Bookmark className="w-10 h-10 text-zinc-700 animate-pulse" />
                  <div className="max-w-xs">
                    <h4 className="text-slate-400 text-xs font-semibold">No trade presets saved yet</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                      Visit the Calculator, search the directory, or scan logs, and hit <strong className="text-emerald-400 font-semibold inline-flex items-center gap-0.5"><TrendingUp className="w-3 h-3 text-emerald-400" /> Save to Trades</strong> to populate this buffer!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {savedTrades.map((trade: any) => {
                    const totalParts = Object.values(trade.counts).reduce((a: number, b: any) => a + (parseInt(b) || 0), 0) as number;
                    const totalDucats = 
                      (parseInt(trade.counts.bronze15) || 0) * 15 + 
                      (parseInt(trade.counts.bronze25) || 0) * 25 + 
                      (parseInt(trade.counts.silver45) || 0) * 45 + 
                      (parseInt(trade.counts.silver65) || 0) * 65 + 
                      (parseInt(trade.counts.gold) || 0) * 100;
                    const pricePlat = Math.round(totalDucats / 25);

                    return (
                      <div key={trade.id} className="bg-[#0c0d10] border border-[#2a2c33] rounded-lg p-3.5 space-y-3 hover:border-emerald-500/30 transition-all duration-150">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-white tracking-wide truncate max-w-[200px]">{trade.name}</h4>
                            <span className="text-[9px] text-zinc-500 font-mono block">{trade.timestamp}</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 border border-emerald-950 bg-[#0c0d10] text-[#d4af37] border-[#d4af37]/35 rounded-full font-mono uppercase font-bold">
                            Preset
                          </span>
                        </div>

                        {/* Counts grid */}
                        <div className="grid grid-cols-5 gap-1.5 text-center">
                          <div className="bg-[#14161c] rounded p-1">
                            <span className="block text-[8px] text-[#cd7f32] font-mono">B15</span>
                            <span className="text-xs text-white font-mono">{trade.counts.bronze15}</span>
                          </div>
                          <div className="bg-[#14161c] rounded p-1">
                            <span className="block text-[8px] text-[#cd7f32] font-mono">B25</span>
                            <span className="text-xs text-white font-mono">{trade.counts.bronze25}</span>
                          </div>
                          <div className="bg-[#14161c] rounded p-1">
                            <span className="block text-[8px] text-[#c0c0c0] font-mono">S45</span>
                            <span className="text-xs text-white font-mono">{trade.counts.silver45}</span>
                          </div>
                          <div className="bg-[#14161c] rounded p-1">
                            <span className="block text-[8px] text-[#c0c0c0] font-mono">S65</span>
                            <span className="text-xs text-white font-mono">{trade.counts.silver65}</span>
                          </div>
                          <div className="bg-[#14161c] rounded p-1 border border-[#d4af37]/25">
                            <span className="block text-[8px] text-[#d4af37] font-mono">G100</span>
                            <span className="text-xs text-white font-mono">{trade.counts.gold}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono">
                          <span>Parts: <span className="text-white font-bold">{totalParts}</span></span>
                          <span className="flex items-center gap-0.5">Ducats: <span className="text-[#d4af37] font-bold">{totalDucats}</span><img src={ducatIcon} className="w-3 h-3 object-contain inline" alt="D" referrerPolicy="no-referrer" /></span>
                          <span className="flex items-center gap-0.5">Price: <span className="text-emerald-400 font-bold">{pricePlat}</span><img src={platinumIcon} className="w-3.5 h-3.5 object-contain inline" alt="P" referrerPolicy="no-referrer" /></span>
                        </div>

                        {/* Preset Actions */}
                        <div className="flex items-center gap-2 pt-1 border-t border-[#2a2c33]/50">
                          <button
                            type="button"
                            onClick={() => {
                              setBulkCounts({
                                bronze15: parseInt(trade.counts.bronze15) || 0,
                                bronze25: parseInt(trade.counts.bronze25) || 0,
                                silver45: parseInt(trade.counts.silver45) || 0,
                                silver65: parseInt(trade.counts.silver65) || 0,
                                gold: parseInt(trade.counts.gold) || 0,
                              });
                              setSuccessMsg(`✓ Loaded items from "${trade.name}" into your Bulk Junk Seller!`);
                            }}
                            className="flex-1 py-1 px-3 bg-[#14161c] hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded text-[10px] uppercase font-bold text-[#e0e1e6] transition cursor-pointer select-none text-center"
                          >
                            Load to Editor
                          </button>
                          
                          {userVerification.status === 'verified' && (
                            <button
                              type="button"
                              onClick={() => handlePublishPresetDirectly(trade.counts, trade.name)}
                              className="py-1 px-3 bg-emerald-950/30 hover:bg-emerald-950/60 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-emerald-300 rounded text-[10px] uppercase font-bold transition cursor-pointer select-none"
                              title="Publish this specific set directly to public live board"
                            >
                              Publish Preset
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveSavedTrade(trade.id)}
                            className="p-1 px-2.5 bg-red-950/10 hover:bg-red-950/30 border border-red-900/35 text-red-400 rounded transition cursor-pointer select-none"
                            title="Remove draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {marketSubTab === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* LEFT COLUMN: Verification & Listing Widgets */}
          <div className="lg:col-span-6 space-y-6">
            
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
                  <form onSubmit={handleInitiateVerification} className="space-y-4">
                    <p className="text-xs text-[#8e9299] leading-relaxed">
                      To safely post trades, prove you own your Warframe account. We need <strong>two pieces of information</strong> because some in-game names have special characters that don't appear in Warframe Market URLs.
                    </p>

                    {/* Step 1: In-Game Name */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                        Step 1: Your exact in-game username (as shown in Warframe)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TENno_BoSS"
                        value={claimedInput}
                        onChange={(e) => setClaimedInput(e.target.value)}
                        className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-zinc-700"
                        required
                      />
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Enter your username exactly as it appears in-game, including any brackets, underscores, or special characters.
                      </p>
                    </div>

                    {/* Step 2: Profile Slug */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                        Step 2: Your Warframe Market profile URL slug
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. tenno-boss (from warframe.market/profile/tenno-boss)"
                        value={profileSlugInput}
                        onChange={(e) => setProfileSlugInput(e.target.value)}
                        className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-zinc-700"
                        required
                      />
                      <p className="text-[10px] text-zinc-400 leading-normal">
                        Visit your <a href="https://warframe.market/profile" target="_blank" rel="noreferrer" className="text-[#d4af37] hover:underline">Warframe Market profile</a> and copy the name from the URL (after <code className="bg-[#0c0d10] px-1">/profile/</code>). This is typically lowercase with hyphens.
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
                        <li className="text-amber-400 font-bold leading-normal p-2.5 bg-amber-950/25 border border-amber-500/20 rounded-md animate-pulse">
                          <span>⚠️ CRITICAL MANDATORY STEP: After pasting the signature token above into your warframe.market settings page called "About" (biography) and saving it, you MUST go back to your public profile page (<a
                            href={`https://warframe.market/profile/${encodeURIComponent((userVerification.claimedIGN || userVerification.normalizedIGN || '').toLowerCase())}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#d4af37] font-extrabold underline hover:text-[#b08d26] inline-flex items-center gap-0.5"
                          >
                            {userVerification.claimedIGN} <ExternalLink className="w-3 h-3 inline mb-0.5" />
                          </a>) and press <strong className="text-[#facc15] font-extrabold underline uppercase">REFRESH (F5 / CTRL+R)</strong>! If you do not refresh the public profile, warframe.market will serve stale cached data and verification will fail.</span>
                        </li>
                        <li>
                          <span>Visit your Warframe.Market profile page and click <strong className="text-white font-medium">Edit Profile</strong>. Navigate to the <strong className="text-white font-medium">"About" / "Biography"</strong> section.</span>
                        </li>
                        <li className="space-y-1.5">
                          <span>Add the verification code anywhere in your biography text:</span>
                          <div className="w-full bg-[#0c0d10] border border-[#2a2c33] rounded-lg px-2.5 py-2 text-[10px] text-[#d4af37] font-mono select-all truncate">
                            {userVerification.token}
                          </div>
                        </li>
                        <li>
                          <span>Click <strong className="text-white font-medium">Save</strong> on your profile settings, then refresh your profile page (press <kbd className="bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 px-1 py-0.5 rounded text-[9px] font-mono">F5</kbd> or <kbd className="bg-[#0c0d10] border border-[#2a2c33] text-zinc-300 px-1 py-0.5 rounded text-[9px] font-mono">CTRL+R</kbd>).</span>
                        </li>
                        <li>
                          <span>Click <strong className="text-[#facc15] font-extrabold">"Verify Now"</strong> below. The system will securely connect to Warframe.Market API to confirm your identity.</span>
                        </li>
                      </ol>

                      <div className="mt-3 p-2.5 bg-emerald-950/25 border border-emerald-500/20 rounded-md text-[9px] text-emerald-300 leading-normal font-mono flex gap-2 items-start">
                        <span className="text-emerald-400 font-bold mt-0.5 shrink-0">✓ SECURE:</span>
                        <span>
                          Your verification code is verified using Warframe.Market's official API. No HTML parsing, no page source uploads—direct API validation only.
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={handleRetryDifferentUsername}
                        disabled={actionLoading}
                        className="py-2.5 bg-orange-900/60 hover:bg-orange-900 disabled:opacity-50 border border-orange-800 rounded-lg text-[10px] text-orange-300 uppercase tracking-wider font-semibold flex items-center justify-center gap-1 transition select-none cursor-pointer"
                        title="Try a different Warframe username without resetting your listings"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handlePerformReset}
                        className="py-2.5 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center justify-center gap-1 transition select-none cursor-pointer"
                        title="Reset verification and cancel all active listings"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset All
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerValidation}
                        disabled={verifying || verificationCooldown}
                        className="py-2.5 bg-[#d4af37] hover:bg-[#b08d26] disabled:opacity-50 text-black font-semibold text-[10px] uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {verifying ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Verifying...
                          </>
                        ) : verificationCooldown ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            Wait {cooldownSeconds}s
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verify Now
                          </>
                        )}
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

                    {/* Casing correction tools */}
                    <div className="bg-[#0c0d10] border border-[#2a2c33] rounded-lg p-3 space-y-2">
                      {!showCasingInput ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[#8e9299]">Casing incorrect or links broken?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCasingValue(userVerification.verifiedIGN || '');
                              setShowCasingInput(true);
                            }}
                            className="px-2.5 py-1 text-[10px] uppercase tracking-wide font-bold bg-[#1d1f26] hover:bg-[#272933] text-[#e0e1e6] border border-[#2a2c33] rounded transition cursor-pointer"
                          >
                            Adjust Casing
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleUpdateCasing} className="space-y-2">
                          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8e9299]">Exact Case-Sensitive Name</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newCasingValue}
                              onChange={(e) => setNewCasingValue(e.target.value)}
                              placeholder="e.g. ShyKnees2"
                              className="flex-1 bg-[#14161c] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded px-2 py-1.5 text-xs text-white focus:outline-none font-mono"
                              required
                            />
                            <button
                              type="submit"
                              disabled={casingLoading}
                              className="px-3 py-1.5 bg-[#d4af37] hover:bg-[#b08d26] disabled:opacity-50 text-black text-[10px] font-bold uppercase rounded cursor-pointer transition flex items-center justify-center gap-1"
                            >
                              {casingLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                              Apply
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCasingInput(false)}
                              className="px-2.5 py-1.5 bg-[#14161c] hover:bg-[#20222a] text-[#8e9299] text-[10px] font-bold uppercase rounded cursor-pointer transition border border-[#2a2c33]"
                            >
                              Cancel
                            </button>
                          </div>
                          <p className="text-[9px] text-[#8e9299]">Must match of the same letters. Instantly updates profile identity and all your active listings.</p>
                        </form>
                      )}
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

                {/* Pricing Suggestion */}
                {(() => {
                  const currentStandardCounts = guessCountsFromItem(itemName, quantity);
                  const standardPriceSuggestion = getListingPriceSuggestion(currentStandardCounts);
                  if (!standardPriceSuggestion) return null;
                  return (
                    <div className="text-[11px] bg-[#0c0d10] p-2.5 rounded border border-[#2a2c33] text-zinc-400 space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span>📊 Statistical expected value:</span>
                        <span className="font-semibold text-[#d4af37] font-mono">{standardPriceSuggestion.average}p</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-zinc-500">
                        <span>Market Price Range:</span>
                        <span className="font-mono text-zinc-300 font-semibold">{standardPriceSuggestion.min}p - {standardPriceSuggestion.max}p</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setPrice(standardPriceSuggestion.average)}
                        className="text-[9px] text-[#d4af37] uppercase font-bold tracking-wider hover:underline block pt-0.5"
                      >
                        Use Statistical Average ({standardPriceSuggestion.average}p)
                      </button>
                    </div>
                  );
                })()}

                {/* Note input field */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center justify-between">
                    <span>Listing Note</span>
                    <span className="text-zinc-600 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="e.g., Fast trade, online now! No negotiations."
                    value={standardNote}
                    onChange={(e) => setStandardNote(e.target.value)}
                    className="w-full bg-[#0c0d10] border border-[#2a2c33] focus:border-[#d4af37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder-zinc-500"
                  />
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

        {/* MY OWN LISTINGS & OPERATIONS FEED (Col span 6 in Manage Tab) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-5 space-y-4">
            <div className="border-b border-[#2a2c33]/40 pb-3 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[#e0e1e6] flex items-center gap-2 uppercase tracking-wide font-sans">
                <Coins className="w-4 h-4 text-[#d4af37]" />
                My Active Trade Offers
              </h3>
              <span className="bg-[#0c0d10] text-[#e0e1e6] border border-[#2a2c33]/60 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                {listings.filter(l => user && l.sellerUid === user.uid).length} listed
              </span>
            </div>

            {!user ? (
              <p className="text-xs text-[#8e9299] text-center py-6 leading-relaxed">
                Log in using Google to review and close your listings.
              </p>
            ) : userVerification.status !== 'verified' ? (
              <p className="text-xs text-[#c4c5cc] text-center py-6 leading-normal bg-[#0c0d10]/40 border border-[#2a2c33]/40 rounded-lg">
                🔒 Complete identity certification first to post and oversee active trade listings.
              </p>
            ) : listings.filter(l => l.sellerUid === user.uid).length === 0 ? (
              <div className="p-8 text-center bg-[#0c0d10]/40 border border-[#2a2c33]/40 rounded-xl space-y-2.5">
                <Tag className="w-6 h-6 text-zinc-650 mx-auto" />
                <p className="text-xs text-[#8e9299]">
                  You have no active listings right now. Publish one using the form on the left!
                </p>
              </div>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                {listings.filter(l => l.sellerUid === user.uid).map((listing) => {
                  const isWTS = listing.type === 'WTS';
                  return (
                    <div
                      key={listing.id}
                      className="bg-[#0b0c10] border border-[#2a2c33] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden transition hover:border-[#d4af37]/30"
                    >
                      <div className={`absolute top-0 bottom-0 left-0 w-1 ${isWTS ? 'bg-red-500' : 'bg-blue-500'}`} />
                      
                      <div className="space-y-1 pl-2 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isWTS ? 'bg-red-950/40 text-red-150 border border-red-900/30' : 'bg-blue-950/40 text-blue-405 border border-blue-900/30'}`}>
                            {listing.type}
                          </span>
                          <span className="text-[9px] text-zinc-500">ACTIVE OFFER</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-bold text-white uppercase tracking-wide font-sans">{listing.itemName}</span>
                          <span className="text-[10px] text-zinc-500 font-sans">Qty: {listing.quantity}</span>
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-[#2a2c33]/45 pt-2 sm:pt-0 shrink-0 gap-2 font-sans font-mono whitespace-nowrap">
                        <div className="text-right">
                          <span className="text-xs font-semibold text-[#f1f2f6]">{listing.price} <span className="text-[10px] text-[#d4af37] font-semibold uppercase">p</span></span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleMarkListingStatus(listing.id, 'sold')}
                            className="px-2 py-0.5 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-900/40 text-emerald-400 hover:text-emerald-300 rounded text-[9px] font-bold uppercase transition select-none cursor-pointer"
                          >
                            Sold
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkListingStatus(listing.id, 'cancelled')}
                            className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-[#e0e1e6] rounded text-[9px] font-bold uppercase transition select-none cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteListing(listing.id)}
                            className="p-1 px-1.5 bg-red-950/15 hover:bg-red-850/20 border border-red-900/35 text-red-500 hover:text-red-450 rounded transition cursor-pointer"
                            title="Delete row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Quick tips */}
          <div className="bg-[#14161c] border border-[#2a2c33] rounded-xl p-4.5 space-y-2 text-[11px] text-[#8e9299] leading-relaxed">
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Live Panel Tips</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Pasting your profile View Source checks in step 4 securely discards private page cookies in-browser! No login parameters ever leave this page.</li>
              <li>Marking listings Sold or Cancelled immediately removes public entries database-wide.</li>
              <li>Toggle "Verified Only" in Browse listings to only see trades from players who successfully completed trade verification.</li>
            </ul>
          </div>
        </div>
      </div>
      )}

      {/* RIGHT COLUMN: Listings browse search feed (Community Feed tab) */}
      {marketSubTab === 'browse' && (
        <div className="space-y-4 animate-fadeIn max-w-5xl mx-auto w-full">
          {/* Helpful call-to-action bar for unverified visitors */}
          {(!user || userVerification.status !== 'verified') && (
            <div className="bg-[#14161c] border border-amber-900/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md shadow-amber-950/5">
              <div className="space-y-1 flex-1">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                  Become a Certified Seller or Buyer
                </h4>
                <p className="text-[11px] text-[#c4c5cc] leading-normal">
                  Unlock posting powers! Verify your Warframe IGN inside the <strong className="text-white">"My Trade Panel & Verification"</strong> tab to publish your own custom deals on this board.
                </p>
              </div>
              <button
                onClick={() => setMarketSubTab('manage')}
                className="px-3.5 py-2 bg-[#d4af37] hover:bg-[#b08d26] text-black font-semibold text-[10px] uppercase tracking-wider rounded-lg transition duration-150 shrink-0 self-start sm:self-center cursor-pointer active:scale-95"
              >
                Go to Verification &rarr;
              </button>
            </div>
          )}
          
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
                const isPrimeJunk = !!listing.isPrimeJunk;
                const isWTS = listing.type === 'WTS';
                const isOwner = user && listing.sellerUid === user.uid;
                const listPrices = listing.rarityPrices || {
                  bronze15: 1,
                  bronze25: 2,
                  silver45: 3,
                  silver65: 5,
                  gold: 8
                };
                
                // Copy-paste trade command for Warframe Chat
                let tradeText = "";
                if (isPrimeJunk) {
                  const partDetails = listing.partDistribution ? ` [${listing.partDistribution}]` : '';
                  tradeText = isWTS
                    ? `/w ${listing.sellerIGN} Hi! I want to buy your Bulk Prime Junk Bundle${partDetails} (${listing.totalParts} parts for ${listing.price}p)`
                    : `/w ${listing.sellerIGN} Hi! I want to sell you a Bulk Prime Junk Bundle${partDetails} (${listing.totalParts} parts for ${listing.price}p)`;
                } else {
                  tradeText = isWTS 
                    ? `/w ${listing.sellerIGN} Hi! I want to buy ${listing.itemName} for ${listing.price}p [DucaPlat]`
                    : `/w ${listing.sellerIGN} Hi! I want to sell ${listing.itemName} for ${listing.price}p [DucaPlat]`;
                }

                return (
                  <div
                    key={listing.id}
                    className={`bg-[#14161c] border rounded-xl p-6 transition duration-150 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${isOwner ? 'border-[#d4af37]/45 shadow-lg shadow-[#d4af37]/3' : 'border-[#2a2c33]'}`}
                  >
                    
                    {/* Left Accent Bar depending on listing type */}
                    <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${isWTS ? 'bg-[#c55353]' : 'bg-[#3b82f6]'}`} />

                    <div className="space-y-2 flex-1 pl-1">
                      
                      {/* Top seller tag & verification */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${
                          isPrimeJunk 
                            ? (isWTS 
                                ? 'bg-rose-950/20 text-[#e06d6d] border border-rose-900/30 font-semibold' 
                                : 'bg-blue-950/20 text-blue-400 border border-blue-900/40')
                            : (isWTS 
                                ? 'bg-rose-950/20 text-[#e06d6d] border border-rose-900/30' 
                                : 'bg-blue-950/20 text-blue-400 border border-blue-900/35')
                        }`}>
                          {isPrimeJunk ? `PRIME JUNK (${listing.type})` : listing.type}
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
                      {isPrimeJunk ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-baseline gap-2.5">
                            <h4 className={`text-[13px] font-extrabold tracking-wide uppercase font-sans ${isWTS ? 'text-[#e06d6d]' : 'text-blue-400'}`}>
                              {listing.itemName || 'Bulk Prime Junk Bundle'}
                            </h4>
                            <span className="text-xs text-zinc-500 font-sans">
                              Wholesale bundle — No single item purchases!
                            </span>
                          </div>
                          
                          {/* Part distribution chips */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {listing.counts && listing.counts.bronze15 > 0 && (
                              <span className="text-[9px] font-mono px-2 py-1 bg-[#0c0d10] border border-[#cd7f32]/25 text-[#cd7f32] rounded flex items-center gap-1">
                                B15: <span className="text-[#e0e1e6] font-bold">{listing.counts.bronze15}</span> <span className="text-zinc-500 font-normal">(@ {listPrices.bronze15}p)</span>
                              </span>
                            )}
                            {listing.counts && listing.counts.bronze25 > 0 && (
                              <span className="text-[9px] font-mono px-2 py-1 bg-[#0c0d10] border border-[#cd7f32]/35 text-[#cd7f32] rounded flex items-center gap-1">
                                B25: <span className="text-[#e0e1e6] font-bold">{listing.counts.bronze25}</span> <span className="text-zinc-500 font-normal">(@ {listPrices.bronze25}p)</span>
                              </span>
                            )}
                            {listing.counts && listing.counts.silver45 > 0 && (
                              <span className="text-[9px] font-mono px-2 py-1 bg-[#0c0d10] border border-slate-700/50 text-slate-300 rounded flex items-center gap-1">
                                S45: <span className="text-[#e0e1e6] font-bold">{listing.counts.silver45}</span> <span className="text-zinc-500 font-normal">(@ {listPrices.silver45}p)</span>
                              </span>
                            )}
                            {listing.counts && listing.counts.silver65 > 0 && (
                              <span className="text-[9px] font-mono px-2 py-1 bg-[#0c0d10] border border-slate-600/60 text-slate-300 rounded flex items-center gap-1">
                                S65: <span className="text-[#e0e1e6] font-bold">{listing.counts.silver65}</span> <span className="text-zinc-500 font-normal">(@ {listPrices.silver65}p)</span>
                              </span>
                            )}
                            {listing.counts && listing.counts.gold > 0 && (
                              <span className="text-[9px] font-mono px-2 py-1 bg-[#0c0d10] border border-[#d4af37]/25 text-[#d4af37] rounded flex items-center gap-1">
                                G100: <span className="text-[#e0e1e6] font-bold">{listing.counts.gold}</span> <span className="text-zinc-500 font-normal">(@ {listPrices.gold}p)</span>
                              </span>
                            )}
                          </div>

                          {/* Extra info metrics */}
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-zinc-400 font-mono items-center">
                            <span>Total Parts: <span className="text-white font-extrabold">{listing.totalParts}</span></span>
                            <span className="flex items-center gap-0.5">Total Ducats: <span className="text-[#d4af37] font-extrabold">{listing.totalDucats}</span><img src={ducatIcon} className="w-3 h-3 object-contain inline" alt="D" referrerPolicy="no-referrer" /></span>
                            <span className="text-pink-400">Trades Needed: <span className="font-extrabold">{listing.tradesRequired}</span></span>
                            <span className="text-emerald-400 flex items-center gap-1 bg-[#101915] px-2 py-0.5 rounded border border-emerald-900/30 font-semibold text-[9px]">
                              Value: {(listing.counts?.bronze15 || 0)}x{listPrices.bronze15}p + {(listing.counts?.bronze25 || 0)}x{listPrices.bronze25}p + {(listing.counts?.silver45 || 0)}x{listPrices.silver45}p + {(listing.counts?.silver65 || 0)}x{listPrices.silver65}p + {(listing.counts?.gold || 0)}x{listPrices.gold}p = <span className="text-emerald-300 font-extrabold flex items-center gap-0.5">{listing.price} <img src={platinumIcon} className="w-2.5 h-2.5 object-contain inline" alt="Pt" /></span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-baseline gap-2.5">
                          <h4 className={`text-[13px] font-semibold tracking-wide uppercase font-sans ${isWTS ? 'text-[#e06d6d]' : 'text-blue-400'}`}>
                            {listing.itemName}
                          </h4>
                          <span className="text-xs text-zinc-500">
                            Qty: <span className="font-bold text-zinc-300 font-mono">{listing.quantity}</span>
                          </span>
                        </div>
                      )}

                      {/* Optional Listing note */}
                      {listing.note && (
                        <div className="text-[11px] text-zinc-300 bg-[#0c0d10]/40 border border-[#2a2c33]/40 p-2.5 rounded-lg italic pr-4 max-w-lg font-sans">
                          "{listing.note}"
                        </div>
                      )}

                      {/* Price Realism Valuation Insights */}
                      {(() => {
                        const derivedCounts = isPrimeJunk 
                          ? (listing.counts || { bronze15: 0, bronze25: 0, silver45: 0, silver65: 0, gold: 0 })
                          : guessCountsFromItem(listing.itemName, listing.quantity);
                        const valuation = getListingPriceSuggestion(derivedCounts);
                        if (!valuation) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] mt-1.5">
                            <span className="text-zinc-500 font-mono">Valuation range:</span>
                            <span className="font-mono text-zinc-300 font-semibold">{valuation.min}-{valuation.max}p</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase font-mono ${
                              listing.price <= valuation.average
                                ? 'bg-emerald-950/30 text-[#4ade80] border border-emerald-900/35'
                                : listing.price > valuation.max * 1.15
                                ? 'bg-rose-950/20 text-[#e06d6d] border border-rose-900/25'
                                : 'bg-zinc-950/50 text-zinc-400 border border-zinc-900/60'
                            }`}>
                              {listing.price <= valuation.average
                                ? '🟢 Statistical Good Deal'
                                : listing.price > valuation.max * 1.15
                                ? '⚠️ Overpriced Strategy'
                                : '⚖️ Fair market value'}
                            </span>
                          </div>
                        );
                      })()}

                      {/* COPY FORUM COMMAND BLOCK */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {!isOwner && (
                          <div className="flex items-center gap-1.5 bg-[#0c0d10]/60 border border-[#2a2c33]/40 rounded-lg p-1 max-w-sm shrink-0 flex-1 sm:flex-initial">
                            <span className="text-[9px] text-[#8e9299] shrink-0 pl-1.5 font-mono uppercase tracking-wide">Command:</span>
                            <div className="flex-1 font-mono text-[10px] text-[#22c55e] truncate select-all px-1 font-semibold">
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

                        <button
                          type="button"
                          onClick={() => {
                            const derivedCounts = isPrimeJunk 
                              ? (listing.counts || { bronze15: 0, bronze25: 0, silver45: 0, silver65: 0, gold: 0 })
                              : guessCountsFromItem(listing.itemName, listing.quantity);
                            onAnalyzeInCalculator?.(derivedCounts);
                          }}
                          className="px-3.5 py-1.5 bg-[#d4af37]/10 hover:bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/25 hover:border-[#d4af37]/45 text-[9px] font-extrabold uppercase tracking-widest rounded-lg transition duration-150 inline-flex items-center gap-1.5 cursor-pointer max-w-max select-none"
                          title="Transmit item parameters to the main ANOVA statistical calculator"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-[#d4af37]" />
                          <span>Analyze in Calculator</span>
                        </button>
                      </div>
                    </div>

                    {/* Right Price section / Own operations */}
                    <div className="flex sm:flex-col items-end gap-3.5 sm:gap-1.5 justify-between border-t sm:border-0 border-zinc-800/55 pt-3 sm:pt-0 shrink-0">
                      
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-[#8e9299] uppercase select-none block">
                          {isPrimeJunk ? 'Total Bundle Price' : 'Price Per Item'}
                        </span>
                        <div className="flex items-center gap-1 text-base font-semibold text-[#f1f2f6] justify-end">
                          <span className="font-mono text-emerald-400 font-extrabold">{listing.price}</span>
                          <img src={platinumIcon} className="w-4 h-4 object-contain inline" alt="Pt" referrerPolicy="no-referrer" />
                        </div>
                        {isPrimeJunk && (
                          <span className="text-[9px] text-[#d4af37] font-mono block">Wholesale combo</span>
                        )}
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
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
      {isBulkAnovaOpen && (
        <AnovaPricingModal
          isOpen={true}
          onClose={() => setIsBulkAnovaOpen(false)}
          title="Bulk Bundle ANOVA Wizard"
          counts={bulkCounts}
          initialPrices={bulkRarityPrices}
          onApplyPrices={(prices) => {
            setBulkRarityPrices(prices);
            setIsBulkAnovaOpen(false);
          }}
        />
      )}
    </div>
  );
}
