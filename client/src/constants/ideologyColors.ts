/**
 * Ideology Colors
 *
 * Soft color palette for ideology spectrum visualization.
 * Based on Australian political conventions:
 * - Left/Progressive/Interventionist = Soft Red (Labor-esque)
 * - Right/Conservative/Market = Soft Blue (Liberal-esque)
 *
 * Colors are intentionally softer than party colors to be distinguishable.
 */

// Economic ideology: market (right) to interventionist (left)
// Score 0 = market (blue), 100 = interventionist (red)
export const ECONOMIC_COLORS = {
  market: '#7BAFD4',        // Soft blue - free market
  leanMarket: '#9BB8C9',    // Light blue-grey
  center: '#B8B8B8',        // Neutral grey
  leanIntervention: '#C9A3A3', // Light red-grey
  interventionist: '#D47B7B', // Soft red - interventionist
} as const;

// Social ideology: conservative (blue) to progressive (red)
// Score 0 = conservative (blue), 100 = progressive (red)
export const SOCIAL_COLORS = {
  conservative: '#6B8FAD',  // Muted blue
  leanConservative: '#8A9FAD', // Light blue-grey
  center: '#A8A8A8',        // Neutral grey
  leanProgressive: '#AD8A8A', // Light red-grey
  progressive: '#AD6B6B',   // Muted red
} as const;

/**
 * Get color for economic score (0-100)
 * 0 = market (blue), 100 = interventionist (red)
 */
export function getEconomicColor(score: number): string {
  if (score <= 20) return ECONOMIC_COLORS.market;
  if (score <= 40) return ECONOMIC_COLORS.leanMarket;
  if (score <= 60) return ECONOMIC_COLORS.center;
  if (score <= 80) return ECONOMIC_COLORS.leanIntervention;
  return ECONOMIC_COLORS.interventionist;
}

/**
 * Get color for social score (0-100)
 * 0 = conservative (blue), 100 = progressive (red)
 */
export function getSocialColor(score: number): string {
  if (score <= 20) return SOCIAL_COLORS.conservative;
  if (score <= 40) return SOCIAL_COLORS.leanConservative;
  if (score <= 60) return SOCIAL_COLORS.center;
  if (score <= 80) return SOCIAL_COLORS.leanProgressive;
  return SOCIAL_COLORS.progressive;
}

/**
 * Get blended ideology color based on both economic and social scores
 * This creates a 2D gradient effect
 */
export function getBlendedIdeologyColor(economicScore: number, socialScore: number): string {
  // Use HSL for smooth blending
  // Hue: 0 (red) to 210 (blue)
  // Economic and social both contribute to the final hue

  const avgScore = (economicScore + socialScore) / 2;

  // Map score to hue: 0 (market/conservative = blue 210) to 100 (interventionist/progressive = red 0)
  const hue = Math.round(210 - (avgScore / 100) * 210);
  const saturation = 35; // Soft, muted
  const lightness = 60;  // Not too dark, not too light

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get ideology label with color
 */
export function getIdeologyDisplay(
  dominantEconomic: 'market' | 'interventionist' | 'neutral',
  dominantSocial: 'progressive' | 'conservative' | 'neutral',
  economicScore: number,
  socialScore: number
): { label: string; color: string; bgColor: string } {
  // Determine primary ideology label
  let label: string;
  if (dominantEconomic === 'neutral' && dominantSocial === 'neutral') {
    label = 'Centrist';
  } else if (dominantEconomic === 'neutral') {
    label = dominantSocial === 'progressive' ? 'Progressive' : 'Conservative';
  } else if (dominantSocial === 'neutral') {
    label = dominantEconomic === 'market' ? 'Free Market' : 'Interventionist';
  } else {
    // Both have a direction
    const socialLabel = dominantSocial === 'progressive' ? 'Progressive' : 'Conservative';
    const econLabel = dominantEconomic === 'market' ? 'Free Market' : 'Interventionist';
    label = `${socialLabel} ${econLabel}`;
  }

  const color = getBlendedIdeologyColor(economicScore, socialScore);

  // Background is lighter version
  const avgScore = (economicScore + socialScore) / 2;
  const hue = Math.round(210 - (avgScore / 100) * 210);
  const bgColor = `hsl(${hue}, 25%, 90%)`;

  return { label, color, bgColor };
}

/**
 * Ideology badge colors for seat buckets (LEFT/CENTER/RIGHT, PROG/CENTER/CONS)
 */
export const SEAT_IDEOLOGY_COLORS = {
  // Economic
  LEFT: { bg: '#F5D7D7', text: '#8B2020', border: '#D99090' },      // Soft red tones
  RIGHT: { bg: '#D7E5F5', text: '#204080', border: '#90B0D9' },     // Soft blue tones
  // Social
  PROG: { bg: '#F5D7D7', text: '#8B2020', border: '#D99090' },      // Soft red tones
  CONS: { bg: '#D7E5F5', text: '#204080', border: '#90B0D9' },      // Soft blue tones
  // Center for both
  CENTER: { bg: '#E8E8E8', text: '#505050', border: '#B0B0B0' },    // Neutral grey
} as const;
