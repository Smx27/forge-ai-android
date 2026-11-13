import React, {createContext, useContext, useMemo} from 'react';
import {useColorScheme} from 'react-native';
import {TamaguiProvider, Theme} from '@tamagui/core';
import config from '../tamagui.config';
import {palettes, type Palette} from './tokens';
import {useSettings} from '../stores/settings';

interface ThemeValue {colors: Palette; dark: boolean}
const ThemeContext = createContext<ThemeValue>({colors: palettes.dark, dark: true});

export function ThemeProvider({children}: React.PropsWithChildren) {
  const preference = useSettings(state => state.theme);
  const system = useColorScheme();
  const dark = preference === 'system' ? system !== 'light' : preference === 'dark';
  const value = useMemo(() => ({colors: dark ? palettes.dark : palettes.light, dark}), [dark]);
  return (
    <TamaguiProvider config={config} defaultTheme={dark ? 'dark' : 'light'}>
      <Theme name={dark ? 'dark' : 'light'}>
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
      </Theme>
    </TamaguiProvider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
