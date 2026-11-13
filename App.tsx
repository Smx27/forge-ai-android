import React, {useEffect} from 'react';
import {DeviceEventEmitter, NativeModules, StatusBar} from 'react-native';
import {DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ThemeProvider, useTheme} from './src/theme/ThemeProvider';
import RootNavigator from './src/navigation/RootNavigator';
import type {RootStackParamList} from './src/navigation/types';
import {ErrorBoundary} from './src/components/ErrorBoundary';
import {DialogHost} from './src/ui/dialog';
import {useLinux} from './src/stores/linux';
import {useChats} from './src/stores/chats';
import {useSettings} from './src/stores/settings';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function openShared(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const share = value as {text?: string; url?: string; action?: string; chatId?: string};
  const text = (share.text ?? share.url ?? '').trim().slice(0, 32000);
  if (!useSettings.getState().onboarded || (!text && !share.action)) return;
  const go = () => {
    if (!navigationRef.isReady()) { setTimeout(go, 200); return; }
    if (share.action === 'open_chat') {
      if (share.chatId && useChats.getState().chats.some(chat => chat.id === share.chatId)) navigationRef.navigate('Chat', {chatId: share.chatId});
      return;
    }
    const chatId = useChats.getState().createChat();
    navigationRef.navigate('Chat', text ? {chatId, prefill: text} : {chatId});
  };
  go();
}

function Shell() {
  const {colors, dark} = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  useEffect(() => {
    void useLinux.getState().refresh();
    const subscription = DeviceEventEmitter.addListener('ForgeShare', openShared);
    void (NativeModules.ForgeShare as {getInitialShare?: () => Promise<unknown>} | undefined)?.getInitialShare?.().then(openShared).catch(() => undefined);
    return () => subscription.remove();
  }, []);
  return (
    <>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <NavigationContainer ref={navigationRef} theme={{...base, colors: {...base.colors, primary: colors.accent, background: colors.bg, card: colors.surface, text: colors.text, border: colors.line, notification: colors.accent}}}>
        <RootNavigator />
      </NavigationContainer>
      <DialogHost />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <Shell />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
