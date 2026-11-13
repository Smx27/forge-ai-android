import React, {useRef, useState} from 'react';
import {Linking, TextInput} from 'react-native';
import {YStack} from '@tamagui/stacks';
import {WebView} from 'react-native-webview';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft, ExternalLink, RotateCw} from 'lucide-react-native';
import type {RootStackParamList} from '../navigation/types';
import {useTheme} from '../theme/ThemeProvider';
import {fonts} from '../theme/tokens';
import {IconButton, NavHeader, Screen, Text} from '../ui';

export default function PreviewScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'Preview'>>();
  const {colors} = useTheme();
  const view = useRef<WebView>(null);
  const [uri, setUri] = useState(params.uri);
  const [draft, setDraft] = useState(params.uri.replace(/^http:\/\//, ''));
  const [failed, setFailed] = useState('');
  const local = uri.startsWith('file://');
  const folder = uri.replace(/[^/]*$/, '');
  const allowNavigation = (url: string) => {
    if (url.startsWith('about:blank') || url.startsWith('data:')) return true;
    if (local) {
      if (url.startsWith('file://')) return url.startsWith(folder);
      if (/^https?:\/\//.test(url)) void Linking.openURL(url);
      return false;
    }
    return /^https?:\/\//.test(url);
  };
  const go = () => {
    const value = draft.trim();
    if (!value) return;
    const next = /^https?:\/\//.test(value) ? value : /^\d+$/.test(value) ? 'http://127.0.0.1:' + value : 'http://' + value;
    setFailed(''); setUri(next);
  };
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title={params.title} backIcon={ArrowLeft} onBack={() => navigation.goBack()} right={<>
        {!local ? <IconButton icon={ExternalLink} label="Open in browser" onPress={() => void Linking.openURL(uri)} /> : null}
        <IconButton icon={RotateCw} label="Reload" onPress={() => { setFailed(''); view.current?.reload(); }} />
      </>} />
      {!local ? (
        <YStack paddingHorizontal="$4" paddingVertical="$2" borderBottomWidth={1} borderBottomColor="$line">
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={go} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" selectTextOnFocus
            accessibilityLabel="Address" placeholder="127.0.0.1:3000" placeholderTextColor={colors.faint} selectionColor={colors.accent}
            style={{fontFamily: fonts.mono, fontSize: 13, color: colors.text, backgroundColor: colors.raised, borderRadius: 2, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 14, paddingVertical: 8}} />
        </YStack>
      ) : null}
      <YStack flex={1}>
        {failed ? (
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$1.5">
            <Text variant="bodyMedium">Nothing is answering there</Text>
            <Text variant="small" tone="muted" textAlign="center">{failed}. If this is a dev server, check that it is still running in the Linux tab and listening on this port.</Text>
          </YStack>
        ) : (
          <WebView key={uri} ref={view} source={{uri}} originWhitelist={['*']}
            allowFileAccess={local} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
            onShouldStartLoadWithRequest={request => allowNavigation(request.url)}
            onError={event => setFailed(event.nativeEvent.description || 'The page could not be loaded')}
            onNavigationStateChange={state => { if (!local && state.url && !state.loading) setDraft(state.url.replace(/^http:\/\//, '')); }}
            javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} mixedContentMode="never" />
        )}
      </YStack>
    </Screen>
  );
}
