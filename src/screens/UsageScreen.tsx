import React, {useMemo, useState} from 'react';

import {XStack, YStack} from '@tamagui/stacks';
import Svg, {Circle, G, Path, Rect} from 'react-native-svg';
import {alert} from '../ui/dialog';
import {ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Activity, ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, ChartColumn, Gauge, RotateCcw, Timer, Zap} from 'lucide-react-native';
import {useUsage, dayKey, sumRows, tokensOn, type UsageRow} from '../stores/usage';
import {useSettings} from '../stores/settings';
import {providerById} from '../engine/providers';
import {useTheme} from '../theme/ThemeProvider';
import {Card, Empty, Group, IconButton, NavHeader, Row, Screen, Segmented, Spread, Stat, Text, Toggle, useGlow} from '../ui';

type Range = '1' | '7' | '30';

const compact = (value: number) => value >= 1e6 ? `${(value / 1e6).toFixed(value >= 1e7 ? 0 : 1)}M` : value >= 1e3 ? `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}k` : String(Math.round(value));
const lastDays = (count: number) => Array.from({length: count}, (_, index) => dayKey(Date.now() - (count - 1 - index) * 86400000));
const weekday = (key: string) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(key + 'T12:00:00').getDay()];
const BUDGETS = [{value: '0', label: 'Off'}, {value: '50000', label: '50k'}, {value: '200000', label: '200k'}, {value: '1000000', label: '1M'}];

function Ring({value, size = 104, stroke = 7, color, track}: {value: number; size?: number; stroke?: number; color: string; track: string}) {
  const c = size / 2;
  const r = c - 10 - stroke / 2;
  const length = 2 * Math.PI * r;
  const ticks = Array.from({length: 48}, (_, index) => index);
  return (
    <Svg width={size} height={size}>
      {ticks.map(index => {
        const angle = (index / 48) * Math.PI * 2;
        const major = index % 6 === 0;
        const inner = c - (major ? 7 : 4);
        const lit = index / 48 < Math.min(1, value);
        return <Path key={index} d={'M ' + (c + inner * Math.sin(angle)) + ' ' + (c - inner * Math.cos(angle)) + ' L ' + (c + (c - 1) * Math.sin(angle)) + ' ' + (c - (c - 1) * Math.cos(angle))} stroke={lit ? color : track} strokeWidth={major ? 1.5 : 1} />;
      })}
      <G rotation={-90} origin={c + ', ' + c}>
        <Circle cx={c} cy={c} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="butt" strokeDasharray={(length * Math.min(1, value)) + ' ' + length} />
      </G>
    </Svg>
  );
}

function Donut({parts, size = 120}: {parts: {value: number; color: string}[]; size?: number}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  const r = size / 2 - 10;
  let angle = -Math.PI / 2;
  const arcs = parts.map((part, index) => {
    const sweep = Math.max(0.0001, (part.value / total) * Math.PI * 2 - (parts.length > 1 ? 0.06 : 0));
    const start = angle;
    angle += (part.value / total) * Math.PI * 2;
    if (parts.length === 1) return <Circle key={index} cx={size / 2} cy={size / 2} r={r} stroke={part.color} strokeWidth={14} fill="none" />;
    const end = start + sweep;
    const x1 = size / 2 + r * Math.cos(start), y1 = size / 2 + r * Math.sin(start);
    const x2 = size / 2 + r * Math.cos(end), y2 = size / 2 + r * Math.sin(end);
    return <Path key={index} d={`M ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}`} stroke={part.color} strokeWidth={14} fill="none" strokeLinecap="butt" />;
  });
  return <Svg width={size} height={size}>{arcs}</Svg>;
}

export default function UsageScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {days, models, hours, perf, reset} = useUsage();
  const settings = useSettings();
  const [range, setRange] = useState<Range>('7');
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const keys = useMemo(() => lastDays(Number(range)), [range]);
  const today = dayKey();
  const yesterday = dayKey(Date.now() - 86400000);
  const todayTokens = tokensOn(days, today);
  const yesterdayTokens = tokensOn(days, yesterday);
  const delta = yesterdayTokens ? Math.round(((todayTokens - yesterdayTokens) / yesterdayTokens) * 100) : null;

  const series = useMemo(() => keys.map(key => sumRows(Object.values(days[key] ?? {}))), [days, keys]);
  const hourly = useMemo(() => hours[today] ?? Array(24).fill(0), [hours, today]);
  const total = sumRows(series);
  const perfTotal = keys.reduce((sum, key) => ({ms: sum.ms + (perf[key]?.ms ?? 0), timed: sum.timed + (perf[key]?.timed ?? 0), errors: sum.errors + (perf[key]?.errors ?? 0)}), {ms: 0, timed: 0, errors: 0});
  const avgMs = perfTotal.timed ? perfTotal.ms / perfTotal.timed : 0;
  const success = total.requests + perfTotal.errors ? Math.round((total.requests / (total.requests + perfTotal.errors)) * 100) : 100;

  const byProvider = useMemo(() => {
    const totals: Record<string, UsageRow[]> = {};
    for (const key of keys) for (const [provider, row] of Object.entries(days[key] ?? {})) (totals[provider] ??= []).push(row);
    return Object.entries(totals).map(([provider, rows]) => ({provider, row: sumRows(rows)})).sort((a, b) => (b.row.prompt + b.row.completion) - (a.row.prompt + a.row.completion));
  }, [days, keys]);
  const topModels = useMemo(() => {
    const totals: Record<string, {tokens: number; requests: number; provider: string}> = {};
    for (const key of keys) for (const [name, row] of Object.entries(models[key] ?? {})) {
      const item = totals[name] ??= {tokens: 0, requests: 0, provider: row.provider};
      item.tokens += row.prompt + row.completion; item.requests += row.requests;
    }
    return Object.entries(totals).map(([name, item]) => ({name, ...item})).sort((a, b) => b.tokens - a.tokens).slice(0, 5);
  }, [models, keys]);
  const heat = useMemo(() => lastDays(7).map(key => ({key, slots: hours[key] ?? Array(24).fill(0)})), [hours]);
  const heatMax = Math.max(1, ...heat.flatMap(item => item.slots));
  const palette = [colors.accent, colors.info, colors.violet, colors.success, colors.warn, colors.danger];

  const budget = settings.dailyBudget;
  const ratio = budget ? todayTokens / budget : 0;
  const ringColor = ratio >= 1 ? colors.danger : ratio >= 0.8 ? colors.warn : colors.accent;

  const hourlyMode = range === '1';
  const bars: {label: string; prompt: number; completion: number}[] = hourlyMode
    ? hourly.map((count: number, hour: number) => ({label: `${hour}:00`, prompt: count, completion: 0}))
    : keys.map((key, index) => ({label: range === '7' ? weekday(key) : key.slice(5).replace('-', '/'), prompt: series[index].prompt, completion: series[index].completion}));
  const chartH = 140;
  const maxBar = Math.max(1, ...bars.map(bar => bar.prompt + bar.completion));
  const gap = bars.length > 14 ? 3 : 8;
  const barW = width ? (width - gap * (bars.length - 1)) / bars.length : 0;
  const active = selected != null && bars[selected] ? bars[selected] : null;

  const glow = useGlow('accent', 14);
  const confirmReset = () => alert('Reset usage?', 'Clears every usage counter on this phone.', [{text: 'Cancel', style: 'cancel'}, {text: 'Reset', style: 'destructive', onPress: reset}]);

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Usage" subtitle="Tracked on this phone" backIcon={ArrowLeft} onBack={() => navigation.goBack()} right={<IconButton icon={RotateCcw} label="Reset usage" tone="muted" size={19} onPress={confirmReset} />} />
      <ScrollView contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 40}}>

      <Card padding="$5" marginTop="$2" overflow="hidden" tone="sunken">
        <XStack alignItems="center" gap="$4">
          <YStack flex={1} gap="$1">
            <Text variant="label" tone="faint">Today</Text>
            <XStack alignItems="baseline" gap="$2">
              <Text fontFamily="$display" fontWeight="700" fontSize={38} lineHeight={46} letterSpacing={1} tone="accent" style={glow}>{compact(todayTokens)}</Text>
              <Text variant="label" tone="muted">tokens</Text>
            </XStack>
            <XStack alignItems="center" gap="$2" marginTop="$1">
              {delta != null ? (
                <XStack alignItems="center" gap={3} paddingHorizontal={8} height={22} borderRadius={2} borderWidth={1} borderColor={delta > 0 ? '$accentLine' : '$success'} backgroundColor={delta > 0 ? '$accentSoft' : '$successSoft'}>
                  {delta > 0 ? <ArrowUpRight size={12} color={colors.accent} /> : <ArrowDownLeft size={12} color={colors.success} />}
                  <Text variant="hud" fontSize={12} tone={delta > 0 ? 'accent' : 'success'}>{Math.abs(delta)}%</Text>
                </XStack>
              ) : null}
              <Text variant="caption" tone="faint">{delta != null ? 'vs yesterday' : `${(days[today] ? Object.values(days[today]).reduce((s, r) => s + r.requests, 0) : 0)} requests so far`}</Text>
            </XStack>
          </YStack>
          <YStack width={104} height={104} alignItems="center" justifyContent="center">
            <Ring value={budget ? ratio : 0} color={ringColor} track={colors.raised} />
            <YStack position="absolute" alignItems="center">
              {budget ? (
                <>
                  <Text variant="metric" fontSize={18} lineHeight={22} tone={ratio >= 1 ? 'danger' : 'text'}>{Math.round(ratio * 100)}%</Text>
                  <Text variant="label" tone="faint" fontSize={10}>of {compact(budget)}</Text>
                </>
              ) : (
                <>
                  <Gauge size={18} color={colors.faint} />
                  <Text variant="label" tone="faint" fontSize={10}>no budget</Text>
                </>
              )}
            </YStack>
          </YStack>
        </XStack>
      </Card>

      <YStack marginTop="$4">
        <Segmented value={range} onChange={value => { setRange(value); setSelected(null); }} options={[{value: '1', label: 'Today'}, {value: '7', label: '7 days'}, {value: '30', label: '30 days'}]} />
      </YStack>

      {total.requests === 0 && perfTotal.errors === 0 ? (
        <YStack marginTop="$6"><Empty icon={ChartColumn} title="No requests yet" body="Token counts, latency and provider mix appear here after your first chat." /></YStack>
      ) : (
        <>
          <XStack gap="$3" marginTop="$4">
            <Stat icon={Zap} tone="accent" label="Requests" value={compact(total.requests)} hint={perfTotal.errors ? `${perfTotal.errors} failed` : 'none failed'} />
            <Stat icon={Activity} tone="success" label="Success rate" value={`${success}%`} hint={total.estimated ? `${total.estimated} estimated` : 'exact counts'} />
          </XStack>
          <XStack gap="$3" marginTop="$3">
            <Stat icon={ArrowUpRight} tone="info" label="Tokens in" value={compact(total.prompt)} hint="prompt and context" />
            <Stat icon={Timer} tone="violet" label="Avg response" value={avgMs ? `${(avgMs / 1000).toFixed(1)}s` : '—'} hint={`${compact(total.completion)} tokens out`} />
          </XStack>

          <Card marginTop="$4" gap="$3">
            <Spread>
              <YStack>
                <Text variant="hud" tone="accent">{hourlyMode ? 'Requests by hour' : 'Tokens per day'}</Text>
                <Text variant="caption" tone="faint">{active ? active.label : hourlyMode ? 'Today' : 'Tap a bar for details'}</Text>
              </YStack>
              {active ? (
                <YStack alignItems="flex-end">
                  <Text variant="hud" tone="accent">{hourlyMode ? `${active.prompt} req` : compact(active.prompt + active.completion)}</Text>
                  {!hourlyMode ? <Text variant="caption" tone="faint">{compact(active.prompt)} in · {compact(active.completion)} out</Text> : null}
                </YStack>
              ) : !hourlyMode ? (
                <XStack gap="$3">
                  <XStack alignItems="center" gap={5}><YStack width={8} height={8} borderRadius={2} backgroundColor="$accent" /><Text variant="caption" tone="muted">In</Text></XStack>
                  <XStack alignItems="center" gap={5}><YStack width={8} height={8} borderRadius={2} backgroundColor="$info" /><Text variant="caption" tone="muted">Out</Text></XStack>
                </XStack>
              ) : null}
            </Spread>
            <YStack height={chartH} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
              {width ? (
                <Svg width={width} height={chartH}>
                  {[0.25, 0.5, 0.75].map(line => <Rect key={line} x={0} y={chartH * line} width={width} height={1} fill={colors.line} />)}
                  {bars.map((bar, index) => {
                    const x = index * (barW + gap);
                    const inH = (bar.prompt / maxBar) * (chartH - 6);
                    const outH = (bar.completion / maxBar) * (chartH - 6);
                    const dim = selected != null && selected !== index ? 0.35 : 1;
                    return (
                      <G key={index} opacity={dim} onPress={() => setSelected(selected === index ? null : index)}>
                        <Rect x={x} y={0} width={barW} height={chartH} fill="transparent" />
                        <Rect x={x} y={chartH - inH} width={barW} height={Math.max(inH, bar.prompt ? 2 : 0)} fill={colors.accent} opacity={0.85} />
                        {outH ? <Rect x={x} y={chartH - inH - outH - 2} width={barW} height={outH} fill={colors.info} opacity={0.85} /> : null}
                        {!bar.prompt && !bar.completion ? <Rect x={x} y={chartH - 2} width={barW} height={2} rx={1} fill={colors.raised} /> : null}
                      </G>
                    );
                  })}
                </Svg>
              ) : null}
            </YStack>
            <XStack justifyContent="space-between">
              {(hourlyMode ? ['0:00', '6:00', '12:00', '18:00', '23:00'] : range === '7' ? bars.map(bar => bar.label) : [bars[0].label, bars[10].label, bars[20].label, bars[29].label]).map(label => <Text key={label} variant="caption" tone="faint" fontSize={11}>{label}</Text>)}
            </XStack>
          </Card>

          <Card marginTop="$3" gap="$3">
            <Spread>
              <Text variant="hud" tone="accent">When you work</Text>
              <Text variant="caption" tone="faint">Last 7 days</Text>
            </Spread>
            <YStack gap={4}>
              {heat.map(row => (
                <XStack key={row.key} alignItems="center" gap={4}>
                  <Text variant="caption" tone="faint" width={30} fontSize={11}>{weekday(row.key)}</Text>
                  {row.slots.map((count: number, hour: number) => (
                    <YStack key={hour} flex={1} height={14} borderRadius={1} style={{backgroundColor: count ? colors.accent : colors.raised, opacity: count ? 0.25 + 0.75 * (count / heatMax) : 1}} />
                  ))}
                </XStack>
              ))}
              <XStack paddingLeft={34} justifyContent="space-between">
                {['12a', '6a', '12p', '6p', '11p'].map(label => <Text key={label} variant="caption" tone="faint" fontSize={10.5}>{label}</Text>)}
              </XStack>
            </YStack>
          </Card>

          {byProvider.length ? (
            <Card marginTop="$3" gap="$3">
              <Text variant="hud" tone="accent">Providers</Text>
              <XStack alignItems="center" gap="$4">
                <YStack width={120} height={120} alignItems="center" justifyContent="center">
                  <Donut parts={byProvider.map((item, index) => ({value: item.row.prompt + item.row.completion || item.row.requests, color: palette[index % palette.length]}))} />
                  <YStack position="absolute" alignItems="center">
                    <Text variant="metric" fontSize={18} lineHeight={24}>{compact(total.prompt + total.completion)}</Text>
                    <Text variant="caption" tone="faint" fontSize={10.5}>tokens</Text>
                  </YStack>
                </YStack>
                <YStack flex={1} gap="$2.5">
                  {byProvider.slice(0, 6).map((item, index) => {
                    const tokens = item.row.prompt + item.row.completion;
                    return (
                      <XStack key={item.provider} alignItems="center" gap="$2">
                        <YStack width={8} height={8} borderRadius={1} style={{backgroundColor: palette[index % palette.length]}} />
                        <Text variant="small" flex={1} numberOfLines={1}>{providerById(item.provider).name}</Text>
                        <Text variant="caption" tone="muted">{Math.round((tokens / Math.max(1, total.prompt + total.completion)) * 100)}%</Text>
                      </XStack>
                    );
                  })}
                </YStack>
              </XStack>
            </Card>
          ) : null}

          {topModels.length ? (
            <Card marginTop="$3" gap="$3.5">
              <Text variant="hud" tone="accent">Top models</Text>
              {topModels.map((item, index) => (
                <YStack key={item.name} gap={6}>
                  <Spread>
                    <XStack alignItems="center" gap="$2" flex={1}>
                      <Text variant="caption" tone="faint" width={14}>{index + 1}</Text>
                      <Text variant="small" numberOfLines={1} flex={1}>{item.name.split('/').pop()}</Text>
                    </XStack>
                    <Text variant="caption" tone="muted">{compact(item.tokens)} · {item.requests} req</Text>
                  </Spread>
                  <YStack height={4} backgroundColor="$raised" marginLeft={22} overflow="hidden">
                    <YStack height={4} backgroundColor={index === 0 ? '$accent' : '$lineStrong'} width={`${Math.max(3, (item.tokens / Math.max(1, topModels[0].tokens)) * 100)}%`} />
                  </YStack>
                </YStack>
              ))}
            </Card>
          ) : null}
        </>
      )}

      <Group title="Limits" footer="Counts come from the provider when it reports them and are estimated otherwise. Nothing leaves your phone.">
        <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$3">
          <Spread>
            <YStack flex={1}>
              <Text>Daily token budget</Text>
              <Text variant="small" tone="muted">Get a notification when today goes over</Text>
            </YStack>
          </Spread>
          <Segmented value={String(budget)} onChange={value => settings.set({dailyBudget: Number(value)})} options={BUDGETS.some(item => item.value === String(budget)) ? BUDGETS : [...BUDGETS, {value: String(budget), label: compact(budget)}]} />
        </YStack>
        <Row icon={ArrowLeftRight} iconTone="info" title="Switch provider on rate limits" subtitle="When one is rate limited or down, retry with another that has a key" numberOfLines={3} right={<Toggle label="Automatic fallback" value={settings.autoFallback} onChange={autoFallback => settings.set({autoFallback})} />} />
      </Group>
      </ScrollView>
    </Screen>
  );
}
