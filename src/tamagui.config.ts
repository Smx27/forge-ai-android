import {createFont, createTamagui, createTokens} from '@tamagui/core';
import {createAnimations} from '@tamagui/animations-react-native';
import {palettes, type Palette} from './theme/tokens';

const face = {
  400: {normal: 'Inter-Regular'},
  500: {normal: 'Inter-Medium'},
  600: {normal: 'Inter-Medium'},
  700: {normal: 'Inter-Medium'},
};

const body = createFont({
  family: 'Inter-Regular',
  size: {1: 12.5, 2: 14, 3: 16, 4: 17, 5: 22, 6: 32, true: 16},
  lineHeight: {1: 17, 2: 20, 3: 24, 4: 24, 5: 28, 6: 38, true: 24},
  weight: {1: '400', 3: '500', true: '400'},
  letterSpacing: {1: 0, 5: -0.4, 6: -0.8, true: 0},
  face,
});

const hud = createFont({
  family: 'ShareTechMono-Regular',
  size: {1: 11.5, 2: 12.5, 3: 14, true: 12.5},
  lineHeight: {1: 15, 2: 16, 3: 18, true: 16},
  weight: {true: '400'},
  letterSpacing: {true: 1.4},
  face: {400: {normal: 'ShareTechMono-Regular'}, 500: {normal: 'ShareTechMono-Regular'}, 600: {normal: 'ShareTechMono-Regular'}, 700: {normal: 'ShareTechMono-Regular'}},
});

const display = createFont({
  family: 'Orbitron-Medium',
  size: {1: 15, 2: 19, 3: 26, 4: 30, true: 19},
  lineHeight: {1: 20, 2: 26, 3: 32, 4: 36, true: 26},
  weight: {1: '500', 3: '700', true: '500'},
  letterSpacing: {true: 1},
  face: {400: {normal: 'Orbitron-Medium'}, 500: {normal: 'Orbitron-Medium'}, 600: {normal: 'Orbitron-Bold'}, 700: {normal: 'Orbitron-Bold'}},
});

const mono = createFont({
  family: 'JetBrainsMono-Regular',
  size: {1: 12, 2: 13, true: 13},
  lineHeight: {1: 17, 2: 19, true: 19},
  weight: {true: '400'},
  letterSpacing: {true: 0},
});

const tokens = createTokens({
  color: {white: '#FFFFFF', black: '#000000', transparent: 'transparent'},
  space: {0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 56, true: 16, '-1': -4, '-2': -8, '-3': -12, '-4': -16},
  size: {0: 0, 1: 20, 2: 28, 3: 36, 4: 44, 5: 52, 6: 64, 7: 74, 8: 84, true: 44},
  radius: {0: 0, 1: 2, 2: 2, 3: 3, 4: 3, 5: 4, 6: 5, 7: 6, 8: 6, 9: 3, true: 4},
  zIndex: {0: 0, 1: 100, 2: 200, 3: 300, 4: 400, 5: 500},
});

const theme = (p: Palette) => ({
  ...p,
  background: p.bg,
  backgroundHover: p.surface,
  backgroundPress: p.raised,
  backgroundFocus: p.raised,
  backgroundStrong: p.surface,
  backgroundTransparent: 'transparent',
  color: p.text,
  colorHover: p.text,
  colorPress: p.text,
  colorFocus: p.text,
  colorTransparent: 'transparent',
  borderColor: p.line,
  borderColorHover: p.lineStrong,
  borderColorPress: p.lineStrong,
  borderColorFocus: p.accent,
  placeholderColor: p.faint,
  outlineColor: p.accentLine,
  shadowColor: 'rgba(0,0,0,0.35)',
});

const animations = createAnimations({
  quick: {type: 'spring', damping: 22, mass: 1, stiffness: 320},
  bouncy: {type: 'spring', damping: 12, mass: 0.9, stiffness: 140},
  lazy: {type: 'spring', damping: 20, stiffness: 70},
  fast: {type: 'timing', duration: 160},
});

export const config = createTamagui({
  tokens,
  themes: {dark: theme(palettes.dark), light: theme(palettes.light)},
  fonts: {body, heading: display, display, hud, mono},
  animations,
  defaultFont: 'body',
  shouldAddPrefersColorThemes: false,
  themeClassNameOnRoot: false,
  media: {short: {maxHeight: 700}, narrow: {maxWidth: 380}},
});

export type AppConfig = typeof config;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
