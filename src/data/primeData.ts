/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { PrimeItem } from '../types';
import { WIKI_DATA } from './wikiData';

// Determine which relics are available (unvaulted)
// A relic is available if at least one item has a drop location from it in RAW wiki data that is NOT vaulted
const AVAILABLE_RELICS = new Set<string>();
const BARO_RELICS = new Set<string>();

WIKI_DATA.forEach(item => {
  item.drop_locations.forEach(loc => {
    // E.g. "Neo V11 Common" or "Lith C13 Common (V)" or "Axi M5 Uncommon (B)"
    const parts = loc.split(' ');
    if (parts.length >= 2) {
      const relic = `${parts[0]} ${parts[1]}`;
      const isVaulted = loc.includes('(V)');
      const isBaro = loc.includes('(B)');
      if (!isVaulted && !isBaro) {
        AVAILABLE_RELICS.add(relic);
      } else if (isBaro) {
        BARO_RELICS.add(relic);
      }
    }
  });
});

// Helper to expand a drop location and adjust its vaulting status dynamically based on AVAILABLE_RELICS
function processDropLocation(loc: string, isRelicUnvaulted: boolean): string {
  if (isRelicUnvaulted) {
    // If the relic is unvaulted, ensure the drop location does not contain '(V)'
    return loc.replace(' (V)', '').replace('(V)', '').trim();
  }
  return loc;
}

// Build the final PRIME_ITEMS list
export const PRIME_ITEMS: PrimeItem[] = WIKI_DATA.map(item => {
  let isItemVaulted = true;
  let isItemBaro = false;

  const drop_locations = item.drop_locations.map(loc => {
    const parts = loc.split(' ');
    if (parts.length < 2) return loc;
    
    const relic = `${parts[0]} ${parts[1]}`;
    const isRelicUnvaulted = AVAILABLE_RELICS.has(relic);
    
    if (isRelicUnvaulted) {
      isItemVaulted = false;
    }
    
    // Check if the relic is Baro-exclusive (or drops only from Baro)
    const isRelicBaro = BARO_RELICS.has(relic) && !isRelicUnvaulted;
    if (isRelicBaro || loc.includes('(B)')) {
      isItemBaro = true;
    }

    return processDropLocation(loc, isRelicUnvaulted);
  });

  // Calculate final statuses
  const finalVaulted = drop_locations.every(loc => loc.includes('(V)') || loc.includes('(B)'));
  const finalBaro = drop_locations.some(loc => loc.includes('(B)')) && finalVaulted;

  let rarity: 'Bronze' | 'Silver' | 'Gold' = 'Bronze';
  if (item.ducat_value >= 100) {
    rarity = 'Gold';
  } else if (item.ducat_value >= 45) {
    rarity = 'Silver';
  }

  return {
    part: item.part,
    drop_locations,
    ducat_value: item.ducat_value,
    rarity,
    isVaulted: finalVaulted,
    isBaro: finalBaro
  };
});
