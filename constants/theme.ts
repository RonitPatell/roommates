export const colors = {
  background: '#09090B',
  backgroundElevated: '#121214',
  surface: '#18181B',
  surfaceHighlight: '#27272A',
  groupedBackground: '#141416',
  separator: 'rgba(255, 255, 255, 0.06)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderChrome: 'rgba(255, 255, 255, 0.16)',
  chrome: '#E4E4E7',
  chromeBright: '#FAFAFA',
  chromeMuted: '#A1A1AA',
  text: '#FAFAFA',
  textSecondary: 'rgba(250, 250, 250, 0.55)',
  textTertiary: 'rgba(250, 250, 250, 0.28)',
  tint: '#E4E4E7',
  tintSoft: 'rgba(228, 228, 231, 0.1)',
  accent: '#D4D4D8',
  success: '#A3E635',
  successSoft: 'rgba(163, 230, 53, 0.12)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.12)',
  destructive: '#F87171',
  destructiveSoft: 'rgba(248, 113, 113, 0.12)',
  fill: 'rgba(255, 255, 255, 0.05)',
  fillSecondary: 'rgba(255, 255, 255, 0.08)',
  tabBar: 'rgba(9, 9, 11, 0.96)',
  gradientStart: '#09090B',
  gradientMid: '#141416',
  gradientEnd: '#09090B',
  glow: 'rgba(228, 228, 231, 0.06)',
  memberColors: ['#E4E4E7', '#A1A1AA', '#D4D4D8', '#F4F4F5', '#71717A', '#C8C8CD'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
  chrome: {
    shadowColor: '#E4E4E7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const typography = {
  largeTitle: { fontSize: 34, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  title1: { fontSize: 28, fontFamily: 'Outfit_700Bold', letterSpacing: -0.4 },
  title2: { fontSize: 22, fontFamily: 'Outfit_600SemiBold', letterSpacing: -0.3 },
  title3: { fontSize: 20, fontFamily: 'Outfit_600SemiBold', letterSpacing: -0.25 },
  headline: { fontSize: 17, fontFamily: 'Outfit_600SemiBold', letterSpacing: -0.2 },
  body: { fontSize: 17, fontFamily: 'Outfit_400Regular', letterSpacing: -0.15 },
  callout: { fontSize: 16, fontFamily: 'Outfit_400Regular', letterSpacing: -0.1 },
  subhead: { fontSize: 15, fontFamily: 'Outfit_400Regular', letterSpacing: 0 },
  footnote: { fontSize: 13, fontFamily: 'Outfit_400Regular', letterSpacing: 0.1 },
  caption: { fontSize: 12, fontFamily: 'Outfit_500Medium', letterSpacing: 0.2 },
};
