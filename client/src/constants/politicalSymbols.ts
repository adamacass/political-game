/**
 * Political Symbols Bank
 *
 * 50 political-related symbols for user selection in the lobby.
 * Uses Lucide React icons which are already included in the project.
 */

export interface PoliticalSymbol {
  id: string;
  name: string;
  icon: string;  // Lucide icon name
  category: 'government' | 'politics' | 'economics' | 'social' | 'nature' | 'communication';
}

export const POLITICAL_SYMBOLS: PoliticalSymbol[] = [
  // Government & Institutions (10)
  { id: 'landmark', name: 'Parliament', icon: 'Landmark', category: 'government' },
  { id: 'gavel', name: 'Gavel', icon: 'Gavel', category: 'government' },
  { id: 'scroll', name: 'Constitution', icon: 'Scroll', category: 'government' },
  { id: 'scale', name: 'Justice', icon: 'Scale', category: 'government' },
  { id: 'shield', name: 'Defence', icon: 'Shield', category: 'government' },
  { id: 'crown', name: 'Crown', icon: 'Crown', category: 'government' },
  { id: 'flag', name: 'Flag', icon: 'Flag', category: 'government' },
  { id: 'castle', name: 'Stronghold', icon: 'Castle', category: 'government' },
  { id: 'building', name: 'Ministry', icon: 'Building', category: 'government' },
  { id: 'library', name: 'Library', icon: 'Library', category: 'government' },

  // Politics & Democracy (10)
  { id: 'vote', name: 'Vote', icon: 'Vote', category: 'politics' },
  { id: 'megaphone', name: 'Campaign', icon: 'Megaphone', category: 'politics' },
  { id: 'users', name: 'Coalition', icon: 'Users', category: 'politics' },
  { id: 'handshake', name: 'Alliance', icon: 'Handshake', category: 'politics' },
  { id: 'swords', name: 'Opposition', icon: 'Swords', category: 'politics' },
  { id: 'target', name: 'Target', icon: 'Target', category: 'politics' },
  { id: 'trophy', name: 'Victory', icon: 'Trophy', category: 'politics' },
  { id: 'medal', name: 'Honour', icon: 'Medal', category: 'politics' },
  { id: 'badge', name: 'Authority', icon: 'BadgeCheck', category: 'politics' },
  { id: 'mic', name: 'Speech', icon: 'Mic', category: 'politics' },

  // Economics & Finance (10)
  { id: 'coins', name: 'Treasury', icon: 'Coins', category: 'economics' },
  { id: 'piggybank', name: 'Savings', icon: 'PiggyBank', category: 'economics' },
  { id: 'briefcase', name: 'Business', icon: 'Briefcase', category: 'economics' },
  { id: 'banknote', name: 'Revenue', icon: 'Banknote', category: 'economics' },
  { id: 'chart', name: 'Growth', icon: 'TrendingUp', category: 'economics' },
  { id: 'factory', name: 'Industry', icon: 'Factory', category: 'economics' },
  { id: 'warehouse', name: 'Trade', icon: 'Warehouse', category: 'economics' },
  { id: 'hammer', name: 'Labour', icon: 'Hammer', category: 'economics' },
  { id: 'pickaxe', name: 'Mining', icon: 'Pickaxe', category: 'economics' },
  { id: 'wheat', name: 'Agriculture', icon: 'Wheat', category: 'economics' },

  // Social & Movement (10)
  { id: 'heart', name: 'Compassion', icon: 'Heart', category: 'social' },
  { id: 'flame', name: 'Reform', icon: 'Flame', category: 'social' },
  { id: 'sun', name: 'Dawn', icon: 'Sun', category: 'social' },
  { id: 'star', name: 'Aspiration', icon: 'Star', category: 'social' },
  { id: 'moon', name: 'Vision', icon: 'Moon', category: 'social' },
  { id: 'sparkles', name: 'Change', icon: 'Sparkles', category: 'social' },
  { id: 'hand', name: 'Unity', icon: 'Hand', category: 'social' },
  { id: 'home', name: 'Housing', icon: 'Home', category: 'social' },
  { id: 'graduation', name: 'Education', icon: 'GraduationCap', category: 'social' },
  { id: 'stethoscope', name: 'Healthcare', icon: 'Stethoscope', category: 'social' },

  // Nature & Environment (5)
  { id: 'tree', name: 'Environment', icon: 'TreeDeciduous', category: 'nature' },
  { id: 'leaf', name: 'Green', icon: 'Leaf', category: 'nature' },
  { id: 'mountain', name: 'Steadfast', icon: 'Mountain', category: 'nature' },
  { id: 'waves', name: 'Tide', icon: 'Waves', category: 'nature' },
  { id: 'bird', name: 'Freedom', icon: 'Bird', category: 'nature' },

  // Communication & Ideas (5)
  { id: 'lightbulb', name: 'Innovation', icon: 'Lightbulb', category: 'communication' },
  { id: 'compass', name: 'Direction', icon: 'Compass', category: 'communication' },
  { id: 'pen', name: 'Policy', icon: 'Pen', category: 'communication' },
  { id: 'book', name: 'Manifesto', icon: 'BookOpen', category: 'communication' },
  { id: 'globe', name: 'Global', icon: 'Globe', category: 'communication' },
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
