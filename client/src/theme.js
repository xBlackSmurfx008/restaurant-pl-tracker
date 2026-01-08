/**
 * Flavor 91 Bistro - Brand Theme Configuration
 * ============================================
 * 
 * This file is the SINGLE SOURCE OF TRUTH for all brand colors and styling.
 * Import this file whenever you need to use brand colors in JavaScript.
 * 
 * For CSS, use the CSS variables defined in App.css (--flavor-*)
 * 
 * Brand Reference: https://flavor91.com/
 * 
 * USAGE:
 * ------
 * import { colors, fonts } from '../theme';
 * 
 * // In inline styles (avoid when possible, prefer CSS classes):
 * style={{ color: colors.primary }}
 * 
 * PREFER CSS CLASSES:
 * -------------------
 * Instead of: style={{ color: '#9AC636' }}
 * Use: className="text-primary" or className="brand-accent"
 */

// ==============================================
// BRAND COLORS - Flavor 91 Bistro
// ==============================================
export const colors = {
  // Primary Brand Colors
  primary: '#9AC636',           // Lime green - main brand color
  primaryDark: '#7BA328',       // Darker green for hover states
  primaryLight: '#B8D95A',      // Lighter green for highlights
  
  // Background Colors
  charcoal: '#1A1A1A',          // Main dark background
  dark: '#2D2D2D',              // Secondary dark (navigation)
  gray: '#3D3D3D',              // Tertiary dark (borders, dividers)
  lightGray: '#F5F5F5',         // Light background for content areas
  white: '#FFFFFF',             // White
  
  // Text Colors
  text: '#333333',              // Main text on light backgrounds
  textLight: '#666666',         // Secondary/muted text
  textOnDark: '#FFFFFF',        // Text on dark backgrounds
  textOnPrimary: '#1A1A1A',     // Text on primary green background
  
  // Status Colors (contextual)
  success: '#43A047',           // Success states (different from brand green)
  warning: '#FFB300',           // Warning states - amber
  danger: '#E53935',            // Danger/error states
  dangerDark: '#C62828',        // Danger hover
  info: '#1976D2',              // Info states - blue
  
  // Legacy mapping (for gradual migration)
  // These map old colors to new brand colors
  accent: '#9AC636',            // Use this instead of #667eea
  highlight: '#9AC636',         // Use this instead of #28a745 for brand highlights
};

// ==============================================
// TYPOGRAPHY
// ==============================================
export const fonts = {
  heading: "'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  body: "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
  mono: "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
};

// ==============================================
// SPACING
// ==============================================
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

// ==============================================
// BORDER RADIUS
// ==============================================
export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
};

// ==============================================
// SHADOWS
// ==============================================
export const shadows = {
  sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
  md: '0 4px 12px rgba(0, 0, 0, 0.15)',
  lg: '0 10px 30px rgba(0, 0, 0, 0.2)',
  primary: '0 4px 12px rgba(154, 198, 54, 0.4)',  // Green glow
};

// ==============================================
// TRANSITIONS
// ==============================================
export const transitions = {
  fast: '0.15s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
};

// ==============================================
// HELPER: Get CSS Variable Reference
// ==============================================
export const cssVar = (name) => `var(--flavor-${name})`;

// ==============================================
// INLINE STYLE HELPERS
// When you MUST use inline styles, use these helpers
// ==============================================
export const inlineStyles = {
  // Primary brand accent
  primaryText: { color: colors.primary },
  primaryBg: { backgroundColor: colors.primary, color: colors.textOnPrimary },
  
  // Selected/active states
  selected: { 
    border: `2px solid ${colors.primary}`,
    backgroundColor: 'rgba(154, 198, 54, 0.08)',
  },
  selectedStrong: {
    border: `2px solid ${colors.primary}`,
    backgroundColor: 'rgba(154, 198, 54, 0.15)',
  },
  
  // Hover highlight
  hoverHighlight: {
    backgroundColor: 'rgba(154, 198, 54, 0.08)',
  },
  
  // Status indicators
  successText: { color: colors.success },
  warningText: { color: colors.warning },
  dangerText: { color: colors.danger },
  
  // Muted text
  mutedText: { color: colors.textLight },
  
  // Card on dark background
  darkCard: {
    backgroundColor: colors.charcoal,
    color: colors.textOnDark,
    borderLeft: `4px solid ${colors.primary}`,
  },
};

// ==============================================
// DEFAULT EXPORT
// ==============================================
const theme = {
  colors,
  fonts,
  spacing,
  borderRadius,
  shadows,
  transitions,
  cssVar,
  inlineStyles,
};

export default theme;

