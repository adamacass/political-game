/**
 * Design Tokens - Ballot Paper Aesthetic
 *
 * Based on Australian ballot paper and parliamentary stationery design.
 * All components should import from this file for consistent styling.
 */

// Color palette
export const colors = {
  // Paper shades (backgrounds)
  paper1: '#F4F1E8',  // Primary background
  paper2: '#EEEBE2',  // Secondary background, cards
  paper3: '#E8E5DC',  // Tertiary, highlights

  // Ink colors (text)
  ink: '#111111',           // Primary text
  inkSecondary: '#3A3A3A',  // Secondary text

  // Rule (borders, lines)
  rule: '#1A1A1A',

  // Feedback states
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
};

// Spacing (8px grid)
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

// Border treatments
export const borders = {
  outer: `2px solid ${colors.rule}`,
  inner: `1px solid ${colors.rule}`,
  subtle: `1px solid ${colors.paper3}`,
  dashed: `2px dashed ${colors.inkSecondary}`,
};

// Common component styles
export const componentStyles = {
  // Card/panel styling
  card: {
    backgroundColor: colors.paper1,
    border: borders.outer,
    borderRadius: '4px',
  },

  // Secondary card styling
  cardSecondary: {
    backgroundColor: colors.paper2,
    border: borders.outer,
    borderRadius: '4px',
  },

  // Input styling
  input: {
    backgroundColor: colors.paper1,
    border: borders.inner,
    color: colors.ink,
    borderRadius: '4px',
  },

  // Primary button
  buttonPrimary: {
    backgroundColor: colors.ink,
    color: colors.paper1,
    border: borders.outer,
    borderRadius: '4px',
  },

  // Secondary button
  buttonSecondary: {
    backgroundColor: colors.paper2,
    color: colors.ink,
    border: borders.outer,
    borderRadius: '4px',
  },

  // Text colors
  textPrimary: { color: colors.ink },
  textSecondary: { color: colors.inkSecondary },
};

// Typography (for reference - actual fonts should be set in CSS)
export const typography = {
  fontFamily: {
    ui: 'Inter, system-ui, sans-serif',
    heading: "'Inter Tight', 'IBM Plex Sans Condensed', sans-serif",
    mono: "'IBM Plex Mono', monospace",
  },
};
