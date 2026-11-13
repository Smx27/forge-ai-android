import React from 'react';
import {Modal, Pressable, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {XStack, YStack} from '@tamagui/stacks';
import {create} from 'zustand';
import {useTheme} from '../theme/ThemeProvider';
import {Corners, Text} from './index';

export interface DialogButton {text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void}
interface DialogState {title: string; message?: string; buttons: DialogButton[]}

const useDialog = create<{current: DialogState | null}>(() => ({current: null}));

export function alert(title: string, message?: string, buttons?: DialogButton[]) {
  useDialog.setState({current: {title, message, buttons: buttons?.length ? buttons : [{text: 'OK'}]}});
}

export function DialogHost() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const current = useDialog(state => state.current);
  if (!current) return null;
  const cancel = current.buttons.find(button => button.style === 'cancel');
  const actions = current.buttons.filter(button => button !== cancel);
  const choose = (button?: DialogButton) => { useDialog.setState({current: null}); button?.onPress?.(); };
  const sheet = actions.length >= 2;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => choose(cancel)}>
      <Pressable style={[StyleSheet.absoluteFill, {backgroundColor: colors.overlay}]} onPress={() => choose(cancel)} accessibilityLabel="Close" />
      {sheet ? (
        <YStack position="absolute" left={10} right={10} bottom={insets.bottom + 10} gap={8} pointerEvents="box-none">
          <YStack backgroundColor="$surface" borderRadius={2} borderWidth={1} borderColor="$lineStrong" overflow="hidden">
            <Corners color={colors.accent} size={9} />
            <YStack paddingHorizontal="$4" paddingTop="$3.5" paddingBottom="$3" alignItems="center" gap={2}>
              <Text variant="label" tone="accent" textAlign="center" numberOfLines={2}>{'// ' + current.title}</Text>
              {current.message ? <Text variant="caption" tone="faint" textAlign="center">{current.message}</Text> : null}
            </YStack>
            {actions.map((button, index) => (
              <YStack key={index} borderTopWidth={1} borderTopColor="$line" height={54} alignItems="center" justifyContent="center"
                pressStyle={{backgroundColor: '$accentSoft'}} onPress={() => choose(button)} accessibilityRole="button">
                <Text variant="hud" fontSize={14.5} tone={button.style === 'destructive' ? 'danger' : 'text'}>{button.text}</Text>
              </YStack>
            ))}
          </YStack>
          {cancel ? (
            <YStack backgroundColor="$surface" borderRadius={2} borderWidth={1} borderColor="$lineStrong" height={54} alignItems="center" justifyContent="center"
              pressStyle={{backgroundColor: '$raised'}} onPress={() => choose(cancel)} accessibilityRole="button">
              <Text variant="hud" fontSize={14.5} tone="accent">{cancel.text ?? 'Cancel'}</Text>
            </YStack>
          ) : null}
        </YStack>
      ) : (
        <YStack flex={1} justifyContent="center" paddingHorizontal={28} pointerEvents="box-none">
          <YStack backgroundColor="$surface" borderRadius={2} borderWidth={1} borderColor="$lineStrong" padding="$5" gap="$2">
            <Corners color={colors.accent} size={10} />
            <Text variant="label" tone="accent">{'// SYSTEM'}</Text>
            <Text variant="title" fontSize={17} letterSpacing={0.6}>{current.title}</Text>
            {current.message ? <Text variant="small" tone="muted">{current.message}</Text> : null}
            <XStack justifyContent="flex-end" gap="$2" marginTop="$3">
              {[...(cancel ? [cancel] : []), ...actions].map((button, index) => {
                const primary = button !== cancel;
                const danger = button.style === 'destructive';
                return (
                  <YStack key={index} paddingHorizontal={18} height={44} borderRadius={2} borderWidth={1} borderColor={primary ? (danger ? '$danger' : '$accent') : 'transparent'} alignItems="center" justifyContent="center"
                    backgroundColor={primary ? (danger ? '$dangerSoft' : '$accent') : 'transparent'} pressStyle={{opacity: 0.8}}
                    onPress={() => choose(button)} accessibilityRole="button">
                    <Text variant="hud" fontSize={13.5} tone={primary ? (danger ? 'danger' : 'accentInk') : 'muted'}>{button.text ?? 'OK'}</Text>
                  </YStack>
                );
              })}
            </XStack>
          </YStack>
        </YStack>
      )}
    </Modal>
  );
}
