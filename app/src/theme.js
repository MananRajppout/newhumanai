// newhuman design tokens — pulled from the reference screenshot
// Black backdrop, deep violet accent with glow, light grey text, system fonts.

export const colors = {
  bg: '#000000',
  bgElevated: '#0a0a0c',
  surface: 'rgba(255,255,255,0.03)',
  surfaceBorder: 'rgba(255,255,255,0.08)',

  // Violet accent — matches the glow in the reference
  accent: '#9d4edd',
  accentBright: '#c77dff',
  accentDim: '#5a189a',
  accentGlow: 'rgba(157, 78, 221, 0.45)',

  text: '#f4f4f5',
  textMuted: '#a1a1aa',
  textDim: '#71717a',

  danger: '#ef4444',
  success: '#10b981',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  full: 999,
};

export const type = {
  // Wide-tracked uppercase for the brand line — matches "NEW HUMAN AI" header
  brand: {
    fontSize: 14,
    letterSpacing: 4,
    fontWeight: '300',
    color: colors.text,
  },
  label: {
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '400',
    color: colors.accentBright,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  bodyMuted: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  triggerLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '400',
    textAlign: 'center',
  },
  triggerSub: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
};
