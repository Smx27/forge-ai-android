export const palettes = {
  dark: {
    bg: '#05080D', surface: '#0A1119', raised: '#0F1A25', sunken: '#03060A', line: 'rgba(0,229,255,0.16)', lineStrong: 'rgba(0,229,255,0.32)',
    text: '#E6FBFF', muted: '#8AA6B3', faint: '#64818E',
    accent: '#00E5FF', accentInk: '#00141A', accentSoft: 'rgba(0,229,255,0.10)', accentLine: 'rgba(0,229,255,0.45)',
    info: '#5AA9FF', infoSoft: 'rgba(90,169,255,0.12)', success: '#3DF5A6', successSoft: 'rgba(61,245,166,0.11)',
    danger: '#FF3B5C', dangerSoft: 'rgba(255,59,92,0.12)', warn: '#FFB020', violet: '#B388FF', violetSoft: 'rgba(179,136,255,0.13)',
    code: '#03070B', overlay: 'rgba(0,6,10,0.78)', glow: 'rgba(0,229,255,0.6)', grid: 'rgba(0,229,255,0.045)',
  },
  light: {
    bg: '#EEF3F6', surface: '#FFFFFF', raised: '#E3EDF2', sunken: '#E7EFF3', line: 'rgba(0,110,140,0.20)', lineStrong: 'rgba(0,110,140,0.40)',
    text: '#04202A', muted: '#3D5965', faint: '#5A7480',
    accent: '#007E98', accentInk: '#FFFFFF', accentSoft: 'rgba(0,126,152,0.09)', accentLine: 'rgba(0,126,152,0.42)',
    info: '#1E5FC0', infoSoft: 'rgba(30,95,192,0.09)', success: '#08804F', successSoft: 'rgba(8,128,79,0.09)',
    danger: '#CC1A3F', dangerSoft: 'rgba(204,26,63,0.08)', warn: '#9A5800', violet: '#6236D0', violetSoft: 'rgba(98,54,208,0.09)',
    code: '#E6EEF2', overlay: 'rgba(4,20,28,0.42)', glow: 'rgba(0,126,152,0.0)', grid: 'rgba(0,110,140,0.06)',
  },
};

export type Palette = typeof palettes.dark;

export const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  mono: 'JetBrainsMono-Regular',
  hud: 'ShareTechMono-Regular',
  display: 'Orbitron-Medium',
  displayBold: 'Orbitron-Bold',
};

export const type = {
  display: {fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, letterSpacing: 1.5},
  title: {fontFamily: fonts.display, fontSize: 19, lineHeight: 26, letterSpacing: 0.8},
  heading: {fontFamily: fonts.medium, fontSize: 17, lineHeight: 24, letterSpacing: -0.2},
  body: {fontFamily: fonts.regular, fontSize: 16, lineHeight: 24},
  bodyMedium: {fontFamily: fonts.medium, fontSize: 16, lineHeight: 24},
  small: {fontFamily: fonts.regular, fontSize: 14, lineHeight: 20},
  smallMedium: {fontFamily: fonts.medium, fontSize: 14, lineHeight: 20},
  caption: {fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17},
  hud: {fontFamily: fonts.hud, fontSize: 12.5, lineHeight: 16, letterSpacing: 1.4, textTransform: 'uppercase'},
  mono: {fontFamily: fonts.mono, fontSize: 13, lineHeight: 19},
} as const;

export const space = {xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32};
export const radius = {sm: 2, md: 3, lg: 4, xl: 6, pill: 3};
