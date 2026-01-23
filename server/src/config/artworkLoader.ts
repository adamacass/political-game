/**
 * Artwork CSV Loader
 *
 * Supports batch uploading and editing artwork URLs for:
 * - Campaign cards
 * - Policy cards
 * - Wildcard cards
 * - Seats
 *
 * CSV Format:
 * type,id,artworkUrl,thumbnailUrl
 * campaign,campaign_001,https://example.com/art/tax_cuts.png,https://example.com/thumb/tax_cuts.png
 * policy,policy_001,https://example.com/art/carbon_tax.png,https://example.com/thumb/carbon_tax.png
 * seat,seat_001,https://example.com/art/sydney.png,https://example.com/thumb/sydney.png
 */

import * as fs from 'fs';
import * as path from 'path';
import { CampaignCard, PolicyCard, WildcardCard, Seat, SeatId } from '../types';

// ============================================================
// TYPES
// ============================================================

export interface ArtworkEntry {
  type: 'campaign' | 'policy' | 'wildcard' | 'seat';
  id: string;
  artworkUrl: string;
  thumbnailUrl?: string;
}

export interface ArtworkMapping {
  campaign: Record<string, { artworkUrl: string; thumbnailUrl?: string }>;
  policy: Record<string, { artworkUrl: string; thumbnailUrl?: string }>;
  wildcard: Record<string, { artworkUrl: string; thumbnailUrl?: string }>;
  seat: Record<string, { artworkUrl: string; thumbnailUrl?: string }>;
}

// ============================================================
// CSV PARSING
// ============================================================

/**
 * Parse a CSV string into artwork entries
 */
export function parseArtworkCsv(csvContent: string): ArtworkEntry[] {
  const lines = csvContent.trim().split('\n');
  const entries: ArtworkEntry[] = [];

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCSVLine(line);
    if (parts.length < 3) continue;

    const [type, id, artworkUrl, thumbnailUrl] = parts;

    if (!isValidType(type)) {
      console.warn(`[ArtworkLoader] Invalid type "${type}" on line ${i + 1}`);
      continue;
    }

    entries.push({
      type: type as ArtworkEntry['type'],
      id: id.trim(),
      artworkUrl: artworkUrl.trim(),
      thumbnailUrl: thumbnailUrl?.trim() || undefined,
    });
  }

  return entries;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function isValidType(type: string): type is ArtworkEntry['type'] {
  return ['campaign', 'policy', 'wildcard', 'seat'].includes(type);
}

// ============================================================
// ARTWORK APPLICATION
// ============================================================

/**
 * Build an artwork mapping from parsed entries
 */
export function buildArtworkMapping(entries: ArtworkEntry[]): ArtworkMapping {
  const mapping: ArtworkMapping = {
    campaign: {},
    policy: {},
    wildcard: {},
    seat: {},
  };

  for (const entry of entries) {
    mapping[entry.type][entry.id] = {
      artworkUrl: entry.artworkUrl,
      thumbnailUrl: entry.thumbnailUrl,
    };
  }

  return mapping;
}

/**
 * Apply artwork mapping to campaign cards
 */
export function applyCampaignArtwork(
  cards: CampaignCard[],
  mapping: ArtworkMapping
): CampaignCard[] {
  return cards.map(card => {
    const artwork = mapping.campaign[card.id];
    if (artwork) {
      return {
        ...card,
        artworkUrl: artwork.artworkUrl,
        thumbnailUrl: artwork.thumbnailUrl,
      };
    }
    return card;
  });
}

/**
 * Apply artwork mapping to policy cards
 */
export function applyPolicyArtwork(
  cards: PolicyCard[],
  mapping: ArtworkMapping
): PolicyCard[] {
  return cards.map(card => {
    const artwork = mapping.policy[card.id];
    if (artwork) {
      return {
        ...card,
        artworkUrl: artwork.artworkUrl,
        thumbnailUrl: artwork.thumbnailUrl,
      };
    }
    return card;
  });
}

/**
 * Apply artwork mapping to wildcard cards
 */
export function applyWildcardArtwork(
  cards: WildcardCard[],
  mapping: ArtworkMapping
): WildcardCard[] {
  return cards.map(card => {
    const artwork = mapping.wildcard[card.id];
    if (artwork) {
      return {
        ...card,
        artworkUrl: artwork.artworkUrl,
        thumbnailUrl: artwork.thumbnailUrl,
      };
    }
    return card;
  });
}

/**
 * Apply artwork mapping to seats
 */
export function applySeatArtwork(
  seats: Record<SeatId, Seat>,
  mapping: ArtworkMapping
): Record<SeatId, Seat> {
  const result: Record<SeatId, Seat> = {};

  for (const [seatId, seat] of Object.entries(seats)) {
    const artwork = mapping.seat[seatId];
    if (artwork) {
      result[seatId] = {
        ...seat,
        artworkUrl: artwork.artworkUrl,
        thumbnailUrl: artwork.thumbnailUrl,
      };
    } else {
      result[seatId] = seat;
    }
  }

  return result;
}

// ============================================================
// FILE LOADING
// ============================================================

/**
 * Load artwork from a CSV file
 */
export function loadArtworkFromFile(filePath: string): ArtworkMapping | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[ArtworkLoader] No artwork file found at ${filePath}`);
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const entries = parseArtworkCsv(content);
    console.log(`[ArtworkLoader] Loaded ${entries.length} artwork entries from ${filePath}`);

    return buildArtworkMapping(entries);
  } catch (error) {
    console.error(`[ArtworkLoader] Error loading artwork from ${filePath}:`, error);
    return null;
  }
}

// ============================================================
// CSV GENERATION
// ============================================================

/**
 * Generate a CSV template with all card IDs for easy filling
 */
export function generateArtworkTemplate(
  campaignCards: CampaignCard[],
  policyCards: PolicyCard[],
  wildcardCards: WildcardCard[],
  seatIds?: string[]
): string {
  const lines: string[] = [
    'type,id,artworkUrl,thumbnailUrl',
  ];

  // Campaign cards
  for (const card of campaignCards) {
    lines.push(`campaign,${card.id},${card.artworkUrl || ''},${card.thumbnailUrl || ''}`);
  }

  // Policy cards
  for (const card of policyCards) {
    lines.push(`policy,${card.id},${card.artworkUrl || ''},${card.thumbnailUrl || ''}`);
  }

  // Wildcard cards
  for (const card of wildcardCards) {
    lines.push(`wildcard,${card.id},${card.artworkUrl || ''},${card.thumbnailUrl || ''}`);
  }

  // Seats (if provided)
  if (seatIds) {
    for (const seatId of seatIds) {
      lines.push(`seat,${seatId},,`);
    }
  }

  return lines.join('\n');
}

/**
 * Export current artwork mappings to CSV
 */
export function exportArtworkToCsv(mapping: ArtworkMapping): string {
  const lines: string[] = [
    'type,id,artworkUrl,thumbnailUrl',
  ];

  for (const [type, items] of Object.entries(mapping) as [keyof ArtworkMapping, Record<string, { artworkUrl: string; thumbnailUrl?: string }>][]) {
    for (const [id, artwork] of Object.entries(items)) {
      lines.push(`${type},${id},${artwork.artworkUrl},${artwork.thumbnailUrl || ''}`);
    }
  }

  return lines.join('\n');
}

// ============================================================
// GLOBAL ARTWORK STATE
// ============================================================

let globalArtworkMapping: ArtworkMapping | null = null;

/**
 * Initialize global artwork mapping from config directory
 */
export function initializeArtwork(configDir: string): void {
  const artworkPath = path.join(configDir, 'artwork.csv');
  globalArtworkMapping = loadArtworkFromFile(artworkPath);
}

/**
 * Get the current global artwork mapping
 */
export function getArtworkMapping(): ArtworkMapping | null {
  return globalArtworkMapping;
}

/**
 * Update the global artwork mapping from new CSV content
 */
export function updateArtworkFromCsv(csvContent: string): ArtworkMapping {
  const entries = parseArtworkCsv(csvContent);
  globalArtworkMapping = buildArtworkMapping(entries);
  return globalArtworkMapping;
}
