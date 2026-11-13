import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, Image, NativeModules, PermissionsAndroid, Platform, ScrollView, StyleSheet, TextInput, View} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {ArrowUp, ChevronDown, ImagePlus, Mic, Square, X, Zap} from 'lucide-react-native';
import {forgeNative} from '../native';
import {useTheme} from '../theme/ThemeProvider';
import {fonts, radius, space} from '../theme/tokens';
import {Chamfer, Corners, Tap, Text} from '../ui';
import {useSettings, activeModelLabel} from '../stores/settings';
import {providerById} from '../engine/providers';
import {usePrompts, matchPrompts} from '../stores/prompts';

export function HeatLine({active}: {active: boolean}) {
  const {colors} = useTheme();
  const value = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!active) { value.stopAnimation(); return; }
    const loop = Animated.loop(Animated.timing(value, {toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true}));
    loop.start();
    return () => loop.stop();
  }, [active, value]);
  return (
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{height: 2, overflow: 'hidden', opacity: active ? 1 : 0}}>
      <Animated.View style={{width: width * 0.35, height: 2, backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 1, shadowRadius: 6, transform: [{translateX: value.interpolate({inputRange: [0, 1], outputRange: [-width * 0.35, width]})}]}} />
    </View>
  );
}

export function ModelChip({onPress}: {onPress: () => void}) {
  const {colors} = useTheme();
  const settings = useSettings();
  const provider = providerById(settings.activeProvider);
  const full = activeModelLabel(settings).replace(/:free$/, '');
  const tail = full.split('/').pop() ?? '';
  const label = tail.length < 8 ? full : tail;
  return (
    <Tap accessibilityRole="button" accessibilityLabel={`Model: ${label}. Change model`} onPress={onPress} style={[styles.chip, {borderColor: colors.lineStrong}]}>
      <Text variant="hud" fontSize={11.5} letterSpacing={0.5} tone="muted" numberOfLines={1} flexShrink={1}>{provider.name} · <Text variant="hud" fontSize={11.5} letterSpacing={0.5} tone="accent">{label}</Text></Text>
      <ChevronDown size={13} color={colors.accent} />
    </Tap>
  );
}

export function Composer({onSend, onStop, running, initial = '', placeholder = 'Ask Forge to build, explain or fix…', onModelPress, autoFocus, editing, onCancelEdit}: {onSend: (text: string, images: string[]) => void; onStop?: () => void; running?: boolean; initial?: string; placeholder?: string; onModelPress: () => void; autoFocus?: boolean; editing?: string | null; onCancelEdit?: () => void}) {
  const {colors} = useTheme();
  const [text, setText] = useState(initial);
  const input = useRef<TextInput>(null);
  const prompts = usePrompts(state => state.prompts);
  const suggestions = matchPrompts(prompts, text);
  useEffect(() => { if (editing != null) { setText(editing); setTimeout(() => input.current?.focus(), 50); } }, [editing]);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const canSend = (text.trim().length > 0 || images.length > 0) && !running;
  const send = () => { if (!canSend) return; onSend(text.trim(), images); setText(''); setImages([]); };
  const attach = async () => {
    setVoiceError('');
    try {
      const picked = await forgeNative.pickImage();
      if (picked) setImages(current => [...current, picked.path].slice(0, 4));
    } catch (error) { setVoiceError(error instanceof Error ? error.message : 'Could not attach that image.'); }
  };
  const voice = async () => {
    const module = NativeModules.VoiceModule as {startListening?: (locale: string) => Promise<string>} | undefined;
    if (Platform.OS !== 'android' || !module?.startListening) { setVoiceError('Voice input needs the Android app.'); return; }
    setVoiceError('');
    const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (permission !== PermissionsAndroid.RESULTS.GRANTED) { setVoiceError('Allow microphone access to dictate.'); return; }
    setListening(true);
    try { const spoken = await module.startListening('en-US'); setText(current => (current ? current + ' ' : '') + spoken); }
    catch (error) { setVoiceError(error instanceof Error ? error.message : 'Speech recognition failed.'); }
    finally { setListening(false); }
  };
  return (
    <YStack gap="$2">
    {suggestions.length ? (
      <YStack backgroundColor="$surface" borderRadius="$2" borderWidth={1} borderColor="$lineStrong" paddingVertical="$1" overflow="hidden">
        {suggestions.map(prompt => (
          <Tap key={prompt.id} accessibilityRole="button" accessibilityLabel={`Use prompt ${prompt.title}`} onPress={() => { usePrompts.getState().used(prompt.id); setText(prompt.body); input.current?.focus(); }}>
            <XStack alignItems="center" gap="$3" paddingHorizontal="$3" paddingVertical={10}>
              <YStack width={28} height={28} borderRadius={2} borderWidth={1} borderColor="$accentLine" backgroundColor="$accentSoft" alignItems="center" justifyContent="center"><Zap size={14} color={colors.accent} /></YStack>
              <YStack flex={1}>
                <Text variant="hud" textTransform="none" letterSpacing={0.6} tone="accent" numberOfLines={1}>/{prompt.command}  <Text variant="small" textTransform="none" letterSpacing={0} tone="muted">{prompt.title}</Text></Text>
                <Text variant="caption" tone="faint" numberOfLines={1}>{prompt.body}</Text>
              </YStack>
            </XStack>
          </Tap>
        ))}
      </YStack>
    ) : null}
    {editing != null ? (
      <XStack alignItems="center" gap="$2" paddingHorizontal="$2">
        <Text variant="label" fontSize={11} tone="accent" flex={1}>EDIT MODE // replaces later answers</Text>
        <Tap accessibilityRole="button" accessibilityLabel="Cancel edit" onPress={() => { setText(''); onCancelEdit?.(); }}><Text variant="label" tone="muted">Cancel</Text></Tap>
      </XStack>
    ) : null}
    <View style={[styles.wrap, {backgroundColor: colors.sunken, borderColor: editing != null ? colors.accent : colors.lineStrong}]}>
      <Corners color={colors.accent} size={8} />
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs} keyboardShouldPersistTaps="handled">
          {images.map(path => (
            <View key={path}>
              <Image source={{uri: `file://${path}`}} style={[styles.thumb, {backgroundColor: colors.raised}]} accessibilityLabel="Attached image" />
              <Tap accessibilityRole="button" accessibilityLabel="Remove image" onPress={() => setImages(current => current.filter(item => item !== path))} style={[styles.remove, {backgroundColor: colors.text}]}>
                <X size={12} color={colors.bg} strokeWidth={3} />
              </Tap>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.prompt}>
      <Text variant="bodyMedium" tone="accent" fontSize={22} lineHeight={24} style={{paddingTop: 9, paddingLeft: space.md}}>›</Text>
      <TextInput
        ref={input} value={text} onChangeText={setText} placeholder={listening ? 'Listening…' : placeholder} placeholderTextColor={colors.faint}
        multiline autoFocus={autoFocus} selectionColor={colors.accent} accessibilityLabel="Message"
        style={[styles.input, {color: colors.text}]} />
      </View>
      {voiceError ? <Text variant="caption" tone="danger" style={{paddingHorizontal: space.md}}>{voiceError}</Text> : null}
      <View style={styles.bar}>
        <ModelChip onPress={onModelPress} />
        <View style={{flex: 1}} />
        <Tap accessibilityRole="button" accessibilityLabel="Attach image" onPress={attach} disabled={running || images.length >= 4} style={styles.round}>
          <ImagePlus size={19} color={colors.muted} strokeWidth={1.6} />
        </Tap>
        <Tap accessibilityRole="button" accessibilityLabel="Dictate" onPress={voice} style={[styles.round, {backgroundColor: listening ? colors.accentSoft : 'transparent', borderColor: listening ? colors.accentLine : 'transparent'}]}>
          <Mic size={19} color={listening ? colors.accent : colors.muted} />
        </Tap>
        {running ? (
          <Tap accessibilityRole="button" accessibilityLabel="Stop" onPress={onStop} style={styles.round}>
            <Chamfer fill={colors.dangerSoft} stroke={colors.danger} cut={8} />
            <Square size={14} color={colors.danger} fill={colors.danger} />
          </Tap>
        ) : (
          <Tap accessibilityRole="button" accessibilityLabel="Send" onPress={send} disabled={!canSend} style={styles.round}>
            <Chamfer fill={canSend ? colors.accent : colors.raised} stroke={canSend ? colors.accent : colors.line} cut={8} />
            <ArrowUp size={19} color={canSend ? colors.accentInk : colors.faint} strokeWidth={2.4} />
          </Tap>
        )}
      </View>
    </View>
    </YStack>
  );
}

const styles = StyleSheet.create({
  wrap: {borderRadius: radius.sm, borderWidth: 1, paddingTop: 4},
  prompt: {flexDirection: 'row', alignItems: 'flex-start'},
  input: {flex: 1, fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, maxHeight: 160, minHeight: 44, paddingLeft: 8, paddingRight: space.md, paddingTop: 10, paddingBottom: 4},
  bar: {flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 8},
  round: {width: 40, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center'},
  thumbs: {gap: 8, paddingHorizontal: space.md, paddingTop: 8},
  thumb: {width: 60, height: 60, borderRadius: radius.sm},
  remove: {position: 'absolute', top: -5, right: -5, width: 22, height: 22, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center'},
  chip: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, flexShrink: 1, maxWidth: 230, borderRadius: radius.sm, borderWidth: 1},
});
