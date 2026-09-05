import { Platform, Easing } from 'react-native';

/**
 * Apex V2 — design tokens.
 * Dark-first monochrome system with a pure white accent.
 * Ported verbatim from assets/style.css.
 */

export const colors = {
  // Surfaces — true neutrals, zero hue (dark default)
  bg: '#0A0A0A',
  bg1: '#121212',
  bg2: '#1A1A1A',
  bg3: '#232323',

  // Legacy aliases kept for compatibility
  ivory: '#0A0A0A',
  surface: '#121212',
  surface2: '#1A1A1A',

  // Ink — warm-free grays
  ink: '#FAFAFA',
  ink2: '#BDBDBD',
  ink3: '#7E7E7E',
  ink4: '#585858',

  // Lines
  line: 'rgba(255,255,255,0.075)',
  line2: 'rgba(255,255,255,0.14)',
  lineStrong: 'rgba(255,255,255,0.14)',

  // Accent — pure white
  accent: '#F5F5F5',
  accentHi: '#FFFFFF',
  accentInk: '#0A0A0A',
  accentSoft: 'rgba(255,255,255,0.1)',
  accentGlow: 'rgba(255,255,255,0.22)',

  // Legacy accent aliases
  accentDeep: '#FFFFFF',
  onAccent: '#0A0A0A',

  // Semantic status — desaturated, never neon
  ok: '#7CCB9B',
  okSoft: 'rgba(124,203,155,0.12)',
  okBg: 'rgba(124,203,155,0.12)',
  okDot: '#7CCB9B',
  warn: '#DEB87C',
  warnSoft: 'rgba(222,184,124,0.12)',
  warnBg: 'rgba(222,184,124,0.12)',
  warnDot: '#DEB87C',
  bad: '#DE8A80',
  badSoft: 'rgba(222,138,128,0.12)',
  badBg: 'rgba(222,138,128,0.12)',
  badDot: '#DE8A80',

  // QR plate (always light)
  plate: '#F5F6F8',

  // Muted tag/avatar background
  mutedBg: 'rgba(233,238,248,0.06)',

  // Focus ring
  ring: 'rgba(255,255,255,0.1)',

  // Dark surfaces (scanner, dark mode)
  dk: '#0A0A0A',
  dk2: '#121212',
  dkLine: 'rgba(255,255,255,0.075)',
  dkInk: '#FAFAFA',
  dkInk2: '#BDBDBD',

  // Membership card navy — object, not surface; stays dark in both modes
  cardNavy: '#0E161D',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  screen: 20, // body padding
  section: 26, // section gap
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  sheet: 20, // bottom sheet top
} as const;

export const shadows = {
  card:
    Platform.OS === 'web'
      ? ('inset 0 1px 0 rgba(255,255,255,0.045), 0 14px 34px rgba(0,0,0,0.38)' as unknown as number)
      : {
          shadowColor: '#000000',
          shadowOpacity: 0.38,
          shadowRadius: 34,
          shadowOffset: { width: 0, height: 14 },
          elevation: 4,
        },
  phone:
    Platform.OS === 'web'
      ? ('0 30px 80px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.4)' as unknown as number)
      : {
          shadowColor: '#000000',
          shadowOpacity: 0.55,
          shadowRadius: 80,
          shadowOffset: { width: 0, height: 30 },
          elevation: 12,
        },
  sheet:
    Platform.OS === 'web'
      ? ('0 -18px 50px rgba(0,0,0,0.5)' as unknown as number)
      : {
          shadowColor: '#000000',
          shadowOpacity: 0.5,
          shadowRadius: 50,
          shadowOffset: { width: 0, height: -18 },
          elevation: 16,
        },
} as const;

export const typography = {
  // Space Grotesk for display, Inter for body, JetBrains Mono for numbers.
  // Loaded via web fonts on web; falls back to system fonts on native.
  fontFamily: Platform.select({
    web: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    default: undefined,
  }),
  display: Platform.select({
    web: "'Space Grotesk', 'Inter', sans-serif",
    default: undefined,
  }),
  mono: Platform.select({
    web: "'JetBrains Mono', ui-monospace, monospace",
    default: 'ui-monospace',
  }),
  serif: Platform.select({
    web: "'Newsreader', Georgia, serif",
    default: 'Georgia',
  }),
  arabic: Platform.select({
    web: "'IBM Plex Sans Arabic', 'Inter', sans-serif",
    default: undefined,
  }),
} as const;

/** Letter-spacing tokens — em-based, scales with font size. */
export const tracking = {
  tighter: -0.025, // large display / hero
  tight: -0.015,   // headings
  normal: 0,
  small: 0.01,     // small text 11-13px
  ui: 0.01,        // UI labels / buttons
  caps: 0.1,       // ALL CAPS — V2 uses 0.1em for labels
  capsWide: 0.16,  // wide caps (logotype, overlines)
} as const;

/** Type scale — sizes in px. Weights and tracking applied per-use. */
export const type = {
  h1: { size: 26, weight: '600' as const, track: tracking.tight },
  h2: { size: 20, weight: '600' as const, track: tracking.tight },
  h3: { size: 18, weight: '600' as const, track: tracking.normal },
  body: { size: 15, weight: '400' as const, track: tracking.normal },
  caption: { size: 13, weight: '400' as const, track: tracking.small },
  overline: { size: 11, weight: '600' as const, track: tracking.caps },
} as const;

export const duration = { fast: 120, default: 200, slow: 320 } as const;

export const easing = {
  enter: Easing.bezier(0.23, 1, 0.32, 1),
  exit: Easing.in(Easing.quad),
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  tracking,
  type,
  duration,
  easing,
};

export type Theme = typeof theme;
export type ColorKey = keyof typeof colors;

/** Light-mode color overrides — paper-white version of the dark-first system. */
export const lightColors = {
  bg: '#F6F6F6',
  bg1: '#FFFFFF',
  bg2: '#EDEDED',
  bg3: '#E2E2E2',

  ivory: '#F6F6F6',
  surface: '#FFFFFF',
  surface2: '#EDEDED',

  ink: '#111111',
  ink2: '#4A4A4A',
  ink3: '#7E7E7E',
  ink4: '#ABABAB',

  line: 'rgba(10,10,10,0.09)',
  line2: 'rgba(10,10,10,0.16)',
  lineStrong: 'rgba(10,10,10,0.16)',

  accent: '#161616',
  accentHi: '#000000',
  accentInk: '#FFFFFF',
  accentSoft: 'rgba(10,10,10,0.07)',
  accentGlow: 'rgba(10,10,10,0.16)',
  accentDeep: '#000000',
  onAccent: '#FFFFFF',

  ok: '#2E7D55',
  okSoft: 'rgba(46,125,85,0.1)',
  okBg: 'rgba(46,125,85,0.1)',
  okDot: '#2E7D55',
  warn: '#9A6F21',
  warnSoft: 'rgba(154,111,33,0.1)',
  warnBg: 'rgba(154,111,33,0.1)',
  warnDot: '#9A6F21',
  bad: '#B04A3F',
  badSoft: 'rgba(176,74,63,0.1)',
  badBg: 'rgba(176,74,63,0.1)',
  badDot: '#B04A3F',

  plate: '#F5F6F8',
  mutedBg: 'rgba(18,22,34,0.06)',
  ring: 'rgba(10,10,10,0.07)',

  dk: '#0A0A0A',
  dk2: '#121212',
  dkLine: 'rgba(255,255,255,0.075)',
  dkInk: '#FAFAFA',
  dkInk2: '#BDBDBD',

  cardNavy: '#0E161D',
} as const;

export type ColorSet = { [K in keyof typeof colors]: string };

/** Hook that returns the active color set based on dark mode state.
 * V2 is dark-first: `dark=false` gives light mode, `dark=true` gives dark mode.
 */
export function useColors(dark: boolean): ColorSet {
  return dark ? (colors as ColorSet) : { ...(colors as ColorSet), ...(lightColors as ColorSet) };
}

