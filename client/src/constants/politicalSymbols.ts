/**
 * Political Symbols Bank
 *
 * 10 clearly political symbols for user selection in the lobby.
 * Uses Lucide React icons which are already included in the project.
 */

export interface PoliticalSymbol {
  id: string;
  name: string;
  icon: string;  // Lucide icon name
  category: 'government' | 'politics';
}

export const POLITICAL_SYMBOLS: PoliticalSymbol[] = [
  { id: 'landmark', name: 'Parliament', icon: 'Landmark', category: 'government' },
  { id: 'gavel', name: 'Justice', icon: 'Gavel', category: 'government' },
  { id: 'flag', name: 'Patriot', icon: 'Flag', category: 'government' },
  { id: 'shield', name: 'Defence', icon: 'Shield', category: 'government' },
  { id: 'scale', name: 'Balance', icon: 'Scale', category: 'government' },
  { id: 'vote', name: 'Democracy', icon: 'Vote', category: 'politics' },
  { id: 'megaphone', name: 'Campaign', icon: 'Megaphone', category: 'politics' },
  { id: 'users', name: 'Coalition', icon: 'Users', category: 'politics' },
  { id: 'handshake', name: 'Alliance', icon: 'Handshake', category: 'politics' },
  { id: 'trophy', name: 'Victory', icon: 'Trophy', category: 'politics' },
];

// Get symbol by ID
export function getSymbolById(id: string): PoliticalSymbol | undefined {
  return POLITICAL_SYMBOLS.find(s => s.id === id);
}

// Get symbols by category
export function getSymbolsByCategory(category: PoliticalSymbol['category']): PoliticalSymbol[] {
  return POLITICAL_SYMBOLS.filter(s => s.category === category);
}

// Default symbol for new players
export const DEFAULT_SYMBOL_ID = 'landmark';
