import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, ActivityIndicator, Animated, ScrollView, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Defs, Path, Pattern, Polygon, Rect} from 'react-native-svg';
import {ChevronRight, type LucideIcon} from 'lucide-react-native';
import {Text as TamaguiText, styled, type GetProps} from '@tamagui/core';
import {XStack, YStack} from '@tamagui/stacks';
import {Switch} from '@tamagui/switch';
import {useTheme} from '../theme/ThemeProvider';
import {fonts} from '../theme/tokens';
import {onKeyboard} from '../native/keyboard';

export type Tone = 'text' | 'muted' | 'faint' | 'accent' | 'danger' | 'success' | 'info' | 'warn' | 'violet' | 'accentInk';

export function alpha(color: string, amount: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return color + Math.round(Math.max(0, Math.min(1, amount)) * 255).toString(16).padStart(2, '0');
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

export const Text = styled(TamaguiText, {
  name: 'ForgeText',
  fontFamily: '$body',
  color: '$text',
  variants: {
    variant: {
      display: {fontFamily: '$display', fontSize: 25, lineHeight: 32, letterSpacing: 1.6, fontWeight: '700', textTransform: 'uppercase'},
      title: {fontFamily: '$display', fontSize: 18, lineHeight: 25, letterSpacing: 0.8, fontWeight: '500'},
      heading: {fontSize: 17, lineHeight: 24, letterSpacing: -0.2, fontWeight: '500'},
      body: {fontSize: 16, lineHeight: 24, fontWeight: '400'},
      bodyMedium: {fontSize: 16, lineHeight: 24, fontWeight: '500'},
      small: {fontSize: 14, lineHeight: 20, fontWeight: '400'},
      smallMedium: {fontSize: 14, lineHeight: 20, fontWeight: '500'},
      caption: {fontSize: 12.5, lineHeight: 17, fontWeight: '400'},
      label: {fontFamily: '$hud', fontSize: 12, lineHeight: 16, letterSpacing: 1.8, fontWeight: '400', textTransform: 'uppercase'},
      hud: {fontFamily: '$hud', fontSize: 13, lineHeight: 17, letterSpacing: 1.3, fontWeight: '400', textTransform: 'uppercase'},
      metric: {fontFamily: '$display', fontSize: 25, lineHeight: 32, letterSpacing: 0.6, fontWeight: '700'},
      mono: {fontFamily: '$mono', fontSize: 13, lineHeight: 19},
    },
    tone: {
      text: {color: '$text'},
      muted: {color: '$muted'},
      faint: {color: '$faint'},
      accent: {color: '$accent'},
      danger: {color: '$danger'},
      success: {color: '$success'},
      info: {color: '$info'},
      warn: {color: '$warn'},
      violet: {color: '$violet'},
      accentInk: {color: '$accentInk'},
    },
  } as const,
  defaultVariants: {variant: 'body', tone: 'text'},
});

export function useGlow(tone: Tone = 'accent', radius = 10) {
  const {colors, dark} = useTheme();
  const color = colors[tone as keyof typeof colors] as string;
  if (!dark) return undefined;
  return {textShadowColor: alpha(color, 0.55), textShadowRadius: radius, textShadowOffset: {width: 0, height: 0}};
}

export function Corners({color, size = 9, weight = 1.5, inset = 0}: {color?: string; size?: number; weight?: number; inset?: number}) {
  const {colors} = useTheme();
  const c = color ?? colors.accentLine;
  const base = {position: 'absolute' as const, width: size, height: size, borderColor: c};
  return (
    <>
      <View pointerEvents="none" style={[base, {top: inset, left: inset, borderTopWidth: weight, borderLeftWidth: weight}]} />
      <View pointerEvents="none" style={[base, {top: inset, right: inset, borderTopWidth: weight, borderRightWidth: weight}]} />
      <View pointerEvents="none" style={[base, {bottom: inset, left: inset, borderBottomWidth: weight, borderLeftWidth: weight}]} />
      <View pointerEvents="none" style={[base, {bottom: inset, right: inset, borderBottomWidth: weight, borderRightWidth: weight}]} />
    </>
  );
}

export function Chamfer({fill, stroke, cut = 10}: {fill: string; stroke?: string; cut?: number}) {
  const [size, setSize] = useState({w: 0, h: 0});
  const {w, h} = size;
  const points = [cut + ',0.5', (w - 0.5) + ',0.5', (w - 0.5) + ',' + (h - cut), (w - cut) + ',' + (h - 0.5), '0.5,' + (h - 0.5), '0.5,' + cut].join(' ');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={event => { const {width, height} = event.nativeEvent.layout; if (width !== w || height !== h) setSize({w: width, h: height}); }}>
      {w > 0 ? <Svg width={w} height={h}><Polygon points={points} fill={fill} stroke={stroke ?? 'none'} strokeWidth={1} /></Svg> : null}
    </View>
  );
}

export function PulseDot({tone = 'accent', size = 6}: {tone?: Tone; size?: number}) {
  const {colors} = useTheme();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { opacity.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, {toValue: 0.25, duration: 900, useNativeDriver: true}),
      Animated.timing(opacity, {toValue: 1, duration: 900, useNativeDriver: true}),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, opacity]);
  const color = colors[tone as keyof typeof colors] as string;
  return <Animated.View style={{width: size, height: size, backgroundColor: color, opacity, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 4, elevation: 0}} />;
}

export function HudLabel({title, action, index, tone = 'muted'}: {title: string; action?: React.ReactNode; index?: number; tone?: Tone}) {
  return (
    <XStack alignItems="center" gap="$2" marginBottom="$2.5" paddingHorizontal="$0.5">
      <Text variant="label" tone="accent">{index !== undefined ? String(index).padStart(2, '0') : '//'}</Text>
      <Text variant="label" tone={tone} numberOfLines={1} flexShrink={1}>{title}</Text>
      <YStack flex={1} height={1} backgroundColor="$line" minWidth={16} />
      {action}
    </XStack>
  );
}

const CardFrame = styled(YStack, {
  name: 'Card',
  backgroundColor: '$surface',
  borderRadius: '$2',
  borderWidth: 1,
  borderColor: '$line',
  padding: '$4',
  variants: {
    pressable: {true: {animation: 'quick', pressStyle: {backgroundColor: '$raised', borderColor: '$lineStrong'}}},
    tone: {
      accent: {backgroundColor: '$accentSoft', borderColor: '$accentLine'},
      danger: {backgroundColor: '$dangerSoft', borderColor: '$dangerSoft'},
      sunken: {backgroundColor: '$sunken', borderColor: '$line'},
    },
  } as const,
});

export function Card({children, brackets = true, ...props}: GetProps<typeof CardFrame> & {brackets?: boolean}) {
  const {colors} = useTheme();
  return (
    <CardFrame {...props}>
      {children}
      {brackets ? <Corners color={props.tone === 'danger' ? alpha(colors.danger, 0.6) : colors.accentLine} size={8} /> : null}
    </CardFrame>
  );
}

export const Divider = styled(YStack, {name: 'Divider', height: 1, backgroundColor: '$line', alignSelf: 'stretch'});

export const Spread = styled(XStack, {name: 'Spread', alignItems: 'center', justifyContent: 'space-between', gap: '$3'});

const TapFrame = styled(YStack, {
  name: 'Tap',
  animation: 'quick',
  pressStyle: {scale: 0.97, opacity: 0.85},
});

export function Tap({disabled, onPress, onLongPress, style, ...props}: GetProps<typeof TapFrame> & {disabled?: boolean; scale?: number}) {
  return <TapFrame {...props} style={StyleSheet.flatten([style as StyleProp<ViewStyle>, disabled ? {opacity: 0.45} : null])} onPress={disabled ? undefined : onPress} onLongPress={disabled ? undefined : onLongPress} accessibilityState={{disabled: !!disabled}} />;
}

export function useKeyboardInset() {
  const ref = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [inset, setInset] = useState(0);
  const measure = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null) { setInset(0); return; }
    ref.current?.measureInWindow((_x, y, _width, height) => setInset(Math.max(0, Math.round(y + height - top))));
  }, []);
  useEffect(() => onKeyboard(top => { keyboardTop.current = top; if (top === null) setInset(0); else requestAnimationFrame(measure); }), [measure]);
  return {ref, inset, onLayout: measure};
}

export function GridBackdrop() {
  const {colors} = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="hudgrid" width={32} height={32} patternUnits="userSpaceOnUse">
            <Path d="M32 0H0V32" fill="none" stroke={colors.grid} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#hudgrid)" />
      </Svg>
    </View>
  );
}

export function Screen({children, scroll, padded = true, style, contentStyle, edges = ['top'], grid = true}: React.PropsWithChildren<{scroll?: boolean; padded?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom')[]; grid?: boolean}>) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const bottom = edges.includes('bottom') ? insets.bottom : 0;
  const padding = {paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: Math.max(bottom, keyboard.inset)};
  if (scroll) {
    return (
      <View ref={keyboard.ref} onLayout={keyboard.onLayout} style={[{flex: 1, backgroundColor: colors.bg}, padding, style]}>
        {grid ? <GridBackdrop /> : null}
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[padded && {paddingHorizontal: 16}, {paddingBottom: 40}, contentStyle]}>{children}</ScrollView>
      </View>
    );
  }
  return (
    <View ref={keyboard.ref} onLayout={keyboard.onLayout} style={[{flex: 1, backgroundColor: colors.bg}, padding, padded && {paddingHorizontal: 16}, style]}>
      {grid ? <GridBackdrop /> : null}
      {children}
    </View>
  );
}

export function LargeTitle({title, subtitle, right, eyebrow}: {title: string; subtitle?: string; right?: React.ReactNode; eyebrow?: string}) {
  const glow = useGlow('accent', 12);
  return (
    <YStack paddingTop="$5" paddingBottom="$3">
      <XStack alignItems="center" gap="$2" marginBottom="$1.5">
        <PulseDot />
        <Text variant="label" tone="accent" numberOfLines={1}>{'FORGE://' + (eyebrow ?? title).toUpperCase().replace(/\s+/g, '_')}</Text>
      </XStack>
      <XStack alignItems="flex-end" gap="$3">
        <YStack flex={1}>
          <Text variant="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={glow}>{title}</Text>
          {subtitle ? <Text variant="small" tone="muted" marginTop="$1">{subtitle}</Text> : null}
        </YStack>
        {right ? <XStack alignItems="center" gap="$1.5">{right}</XStack> : null}
      </XStack>
      <XStack alignItems="center" marginTop="$2.5" gap={4}>
        <YStack width={28} height={2} backgroundColor="$accent" />
        <YStack width={4} height={2} backgroundColor="$accent" opacity={0.6} />
        <YStack flex={1} height={1} backgroundColor="$line" />
      </XStack>
    </YStack>
  );
}

export function IconButton({icon: Icon, onPress, label, tone = 'text', size = 22, filled, disabled, style}: {icon: LucideIcon; onPress?: () => void; label: string; tone?: Tone; size?: number; filled?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>}) {
  const {colors} = useTheme();
  return (
    <Tap accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} disabled={disabled}
      width={40} height={40} borderRadius="$2" alignItems="center" justifyContent="center"
      backgroundColor={filled ? '$accentSoft' : 'transparent'} borderWidth={filled ? 1 : 0} borderColor="$accentLine" style={style}>
      <Icon size={size} color={colors[tone]} strokeWidth={1.6} />
    </Tap>
  );
}

const ButtonFrame = styled(XStack, {
  name: 'Button',
  height: 50,
  paddingHorizontal: '$5',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$2',
  animation: 'quick',
  pressStyle: {opacity: 0.78},
  variants: {
    compact: {true: {height: 40, paddingHorizontal: '$3.5'}},
  } as const,
});

export function Button({title, onPress, kind = 'primary', icon: Icon, loading, disabled, style, compact}: {title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: LucideIcon; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean}) {
  const {colors} = useTheme();
  const foreground = kind === 'primary' ? colors.accentInk : kind === 'danger' ? colors.danger : kind === 'ghost' ? colors.accent : colors.text;
  const fill = kind === 'primary' ? colors.accent : kind === 'danger' ? colors.dangerSoft : kind === 'secondary' ? colors.surface : null;
  const stroke = kind === 'primary' ? colors.accent : kind === 'danger' ? alpha(colors.danger, 0.55) : colors.lineStrong;
  const off = disabled || loading;
  return (
    <ButtonFrame accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled: !!off}} compact={compact} hitSlop={compact ? 6 : 0}
      onPress={off ? undefined : onPress} opacity={disabled ? 0.45 : 1} style={style}>
      {fill ? <Chamfer fill={fill} stroke={stroke} cut={compact ? 7 : 10} /> : null}
      {loading ? <ActivityIndicator color={foreground} size="small" /> : Icon ? <Icon size={compact ? 16 : 18} color={foreground} strokeWidth={1.9} /> : null}
      <Text variant="hud" fontSize={compact ? 13 : 14.5} letterSpacing={1.6} numberOfLines={1} flexShrink={1} style={{color: foreground}}>{title}</Text>
    </ButtonFrame>
  );
}

export function Section({title, action, children, style}: React.PropsWithChildren<{title: string; action?: React.ReactNode; style?: StyleProp<ViewStyle>}>) {
  return (
    <YStack marginTop="$6" style={style}>
      <HudLabel title={title} action={action} />
      {children}
    </YStack>
  );
}

export function Group({title, footer, children, style}: React.PropsWithChildren<{title?: string; footer?: string; style?: StyleProp<ViewStyle>}>) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <YStack marginTop="$6" style={style}>
      {title ? <HudLabel title={title} /> : null}
      <YStack backgroundColor="$surface" borderRadius="$2" borderWidth={1} borderColor="$line" overflow="hidden">
        {items.map((child, index) => (
          <YStack key={index}>
            {index > 0 ? <YStack height={1} backgroundColor="$line" marginLeft="$4" /> : null}
            {child}
          </YStack>
        ))}
        <Corners size={8} />
      </YStack>
      {footer ? <Text variant="caption" tone="faint" marginTop="$2" marginHorizontal="$1">{footer}</Text> : null}
    </YStack>
  );
}

const iconTint: Partial<Record<Tone, ['accent' | 'info' | 'success' | 'danger' | 'violet' | 'muted' | 'warn', string]>> = {
  accent: ['accent', 'accentSoft'], info: ['info', 'infoSoft'], success: ['success', 'successSoft'], danger: ['danger', 'dangerSoft'], violet: ['violet', 'violetSoft'],
};

export function IconTile({icon: Icon, tone = 'muted', size = 32}: {icon: LucideIcon; tone?: Tone; size?: number}) {
  const {colors} = useTheme();
  const tint = iconTint[tone];
  const fg = tint ? colors[tint[0] as keyof typeof colors] as string : colors.muted;
  const bg = tint ? colors[tint[1] as keyof typeof colors] as string : colors.raised;
  return (
    <YStack width={size} height={size} borderRadius={2} alignItems="center" justifyContent="center" style={{backgroundColor: bg, borderWidth: 1, borderColor: tint ? alpha(fg, 0.35) : colors.line}}>
      <Icon size={size * 0.54} color={fg} strokeWidth={1.6} />
      <YStack position="absolute" top={-1} left={-1} width={4} height={4} style={{borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: fg}} />
      <YStack position="absolute" bottom={-1} right={-1} width={4} height={4} style={{borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: fg}} />
    </YStack>
  );
}

export function Row({icon, iconTone = 'muted', title, subtitle, value, onPress, right, chevron, destructive, numberOfLines = 2}: {icon?: LucideIcon; iconTone?: Tone; title: string; subtitle?: string; value?: string; onPress?: () => void; right?: React.ReactNode; chevron?: boolean; destructive?: boolean; numberOfLines?: number}) {
  const {colors} = useTheme();
  return (
    <XStack alignItems="center" paddingHorizontal="$4" paddingVertical="$3" minHeight={56} gap="$3"
      onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}
      pressStyle={onPress ? {backgroundColor: '$accentSoft'} : undefined}>
      {icon ? <IconTile icon={icon} tone={destructive ? 'danger' : iconTone} /> : null}
      <YStack flex={1}>
        <Text variant="body" tone={destructive ? 'danger' : 'text'} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="small" tone="muted" numberOfLines={numberOfLines} marginTop={1}>{subtitle}</Text> : null}
      </YStack>
      {value ? <Text variant="hud" tone="accent" numberOfLines={1} maxWidth="45%">{value}</Text> : null}
      {right}
      {chevron ? <ChevronRight size={18} color={colors.accent} strokeWidth={1.6} opacity={0.7} /> : null}
    </XStack>
  );
}

export function Toggle({value, onChange, label}: {value: boolean; onChange: (value: boolean) => void; label: string}) {
  return (
    <Switch unstyled accessibilityLabel={label} checked={value} onCheckedChange={onChange} hitSlop={10}
      width={46} height={26} borderRadius={2} padding={3} justifyContent="center" borderWidth={1}
      borderColor={value ? '$accent' : '$lineStrong'} backgroundColor={value ? '$accentSoft' : '$sunken'}>
      <Switch.Thumb unstyled animation="quick" width={18} height={18} borderRadius={1} backgroundColor={value ? '$accent' : '$faint'} />
    </Switch>
  );
}

export function Field({label, hint, style, multiline, onFocus, onBlur, ...props}: TextInputProps & {label?: string; hint?: string}) {
  const {colors} = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <YStack marginTop="$3">
      {label ? <Text variant="label" tone="muted" marginBottom="$1.5">{label}</Text> : null}
      <TextInput {...props} multiline={multiline}
        placeholderTextColor={colors.faint} selectionColor={colors.accent} cursorColor={colors.accent}
        onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[{backgroundColor: focused ? colors.accentSoft : colors.sunken, color: colors.text, borderWidth: 1, borderColor: focused ? colors.accent : colors.lineStrong, borderRadius: 2,
          paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0, height: multiline ? undefined : 50, minHeight: multiline ? 104 : undefined, fontFamily: fonts.regular, fontSize: 16}, style]} />
      {hint ? <Text variant="caption" tone="faint" marginTop="$1.5">{hint}</Text> : null}
    </YStack>
  );
}

export function Segmented<T extends string>({options, value, onChange}: {options: {value: T; label: string}[]; value: T; onChange: (value: T) => void}) {
  return (
    <XStack backgroundColor="$sunken" borderRadius="$2" padding={3} borderWidth={1} borderColor="$line" accessibilityRole="tablist" gap={3}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <YStack key={option.value} flex={1} alignItems="center" justifyContent="center" minHeight={38} borderRadius={1} accessibilityRole="tab" accessibilityState={{selected: active}}
            onPress={() => onChange(option.value)}
            backgroundColor={active ? '$accentSoft' : 'transparent'} borderWidth={1} borderColor={active ? '$accentLine' : 'transparent'}>
            <Text variant="hud" fontSize={12.5} tone={active ? 'accent' : 'muted'}>{option.label}</Text>
            {active ? <YStack position="absolute" bottom={-1} left="30%" right="30%" height={2} backgroundColor="$accent" /> : null}
          </YStack>
        );
      })}
    </XStack>
  );
}

export function Tag({label, tone = 'muted', icon: Icon}: {label: string; tone?: Tone; icon?: LucideIcon}) {
  const {colors} = useTheme();
  const tint = iconTint[tone];
  const fg = colors[tone as keyof typeof colors] as string;
  const bg = tint ? colors[tint[1] as keyof typeof colors] as string : colors.raised;
  return (
    <XStack paddingHorizontal="$2" paddingVertical={2} borderRadius={2} alignSelf="flex-start" alignItems="center" gap={4} style={{backgroundColor: bg, borderWidth: 1, borderColor: tint ? alpha(fg, 0.4) : colors.line}}>
      {Icon ? <Icon size={12} color={fg} strokeWidth={1.8} /> : null}
      <Text variant="hud" fontSize={11.5} lineHeight={15} letterSpacing={1} tone={tone}>{label}</Text>
    </XStack>
  );
}

export function Progress({value, tone = 'accent', height = 6}: {value: number; tone?: Tone; height?: number}) {
  const {colors} = useTheme();
  return (
    <YStack height={height} overflow="hidden" backgroundColor="$raised" borderWidth={0}>
      <YStack animation="lazy" height="100%" width={Math.round(Math.min(1, Math.max(0, value)) * 100) + '%'} style={{backgroundColor: colors[tone]}} />
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(tick => <YStack key={tick} position="absolute" top={0} bottom={0} left={tick * 10 + '%'} width={2} style={{backgroundColor: colors.bg}} />)}
    </YStack>
  );
}

export function Empty({icon: Icon, title, body, action}: {icon: LucideIcon; title: string; body: string; action?: React.ReactNode}) {
  const {colors} = useTheme();
  return (
    <YStack alignItems="center" justifyContent="center" paddingVertical={56} paddingHorizontal="$6">
      <YStack width={72} height={72} alignItems="center" justifyContent="center" marginBottom="$4" backgroundColor="$accentSoft" borderWidth={1} borderColor="$line">
        <Icon size={28} color={colors.accent} strokeWidth={1.4} />
        <Corners color={colors.accent} size={10} />
      </YStack>
      <Text variant="title" fontSize={16} letterSpacing={1.4} textTransform="uppercase" textAlign="center">{title}</Text>
      <Text variant="small" tone="muted" textAlign="center" marginTop="$1.5" maxWidth={300}>{body}</Text>
      {action ? <YStack marginTop="$4">{action}</YStack> : null}
    </YStack>
  );
}

export function NavHeader({title, onBack, right, backIcon, subtitle}: {title?: string; onBack?: () => void; right?: React.ReactNode; backIcon: LucideIcon; subtitle?: string}) {
  const insets = useSafeAreaInsets();
  return (
    <YStack backgroundColor="$bg">
      <XStack alignItems="center" paddingHorizontal="$2" paddingBottom="$2" paddingTop={insets.top + 4} gap="$1">
        {onBack ? <IconButton icon={backIcon} label="Back" onPress={onBack} tone="accent" /> : <YStack width={8} />}
        <YStack flex={1} marginLeft="$1">
          <Text variant="hud" fontSize={15.5} lineHeight={20} letterSpacing={1.4} numberOfLines={1}>{title ?? ''}</Text>
          {subtitle ? <Text variant="label" fontSize={11} tone="muted" numberOfLines={1}>{subtitle}</Text> : null}
        </YStack>
        <XStack alignItems="center" gap="$1">{right}</XStack>
      </XStack>
      <XStack alignItems="center">
        <YStack width={36} height={2} backgroundColor="$accent" />
        <YStack flex={1} height={1} backgroundColor="$line" />
      </XStack>
    </YStack>
  );
}

export function Stat({label, value, hint, tone = 'text', icon}: {label: string; value: string; hint?: string; tone?: Tone; icon?: LucideIcon}) {
  const glow = useGlow(tone === 'text' ? 'accent' : tone, 9);
  return (
    <Card flex={1} padding="$3.5" gap="$1.5">
      <XStack alignItems="center" gap="$2">
        {icon ? <IconTile icon={icon} tone={tone === 'text' ? 'muted' : tone} size={24} /> : null}
        <Text variant="label" fontSize={11} tone="muted" numberOfLines={1}>{label}</Text>
      </XStack>
      <Text variant="metric" tone={tone} numberOfLines={1} adjustsFontSizeToFit style={glow}>{value}</Text>
      {hint ? <Text variant="caption" tone="faint" numberOfLines={1}>{hint}</Text> : null}
    </Card>
  );
}
