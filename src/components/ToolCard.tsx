import React, {memo, useState} from 'react';
import {ScrollView, Text as RNText} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {BookOpen, Brain, Check, ChevronDown, ChevronRight, Circle, CircleDot, FilePen, FileText, FolderTree, Globe, ListChecks, Plug, Search, SquareTerminal, Trash2, X, type LucideIcon, CircleStop, Server} from 'lucide-react-native';
import type {ToolResult} from '../stores/chats';
import {useTheme} from '../theme/ThemeProvider';
import {fonts, type} from '../theme/tokens';
import {Text} from '../ui';
import {summarizeCall} from '../engine/tools';

const ICONS: Record<string, LucideIcon> = {
  list_files: FolderTree, read_file: FileText, write_file: FilePen, edit_file: FilePen, delete_path: Trash2,
  run_command: SquareTerminal, web_search: Search, web_fetch: Globe, remember: Brain, recall: Brain, load_skill: BookOpen, update_plan: ListChecks, start_server: Server, stop_server: CircleStop,
};

export const ToolCard = memo(function ToolCard({name, args, result}: {name: string; args: string; result?: ToolResult}) {
  const {colors} = useTheme();
  const [open, setOpen] = useState(false);
  const Icon = ICONS[name] ?? Plug;
  const summary = summarizeCall(name, args);
  const plan = result?.detail?.plan;
  if (name === 'update_plan' && plan) {
    return (
      <YStack backgroundColor="$surface" borderColor="$line" borderWidth={1} borderLeftWidth={2} borderLeftColor="$accent" borderRadius="$1" overflow="hidden" paddingBottom="$2">
        <XStack alignItems="center" gap="$2" paddingHorizontal="$3.5" paddingTop="$3" paddingBottom="$1.5"><ListChecks size={16} color={colors.accent} strokeWidth={1.7} /><Text variant="hud" tone="accent">Mission plan</Text>
          <Text variant="hud" tone="muted" marginLeft="auto">{plan.filter(step => step.status === 'done').length}/{plan.length}</Text></XStack>
        {plan.map((step, index) => (
          <XStack key={index} alignItems="flex-start" gap="$2" paddingHorizontal="$3.5" paddingVertical={5}>
            {step.status === 'done' ? <Check size={16} color={colors.success} /> : step.status === 'active' ? <CircleDot size={16} color={colors.accent} /> : <Circle size={16} color={colors.faint} />}
            <Text variant="small" tone={step.status === 'done' ? 'muted' : 'text'} style={[{flex: 1}, step.status === 'done' && {textDecorationLine: 'line-through'}]}>{step.title}</Text>
          </XStack>
        ))}
      </YStack>
    );
  }
  const status = result?.status;
  const running = result?.output === '…';
  const pending = !result;
  const diff = result?.detail?.diff;
  const isCommand = name === 'run_command';
  return (
    <YStack backgroundColor="$surface" borderColor={status === 'error' ? '$danger' : '$line'} borderWidth={1} borderLeftWidth={2} borderLeftColor={status === 'error' ? '$danger' : '$accentLine'} borderRadius="$1" overflow="hidden">
      <XStack alignItems="center" gap="$2" paddingHorizontal="$3.5" paddingVertical="$2.5" animation="quick" pressStyle={{backgroundColor: '$raised'}} accessibilityRole="button" accessibilityLabel={summary} onPress={() => setOpen(value => !value)}>
        <Icon size={16} color={status === 'error' ? colors.danger : colors.accent} strokeWidth={1.8} />
        <RNText numberOfLines={1} style={[isCommand ? {fontFamily: fonts.mono, fontSize: 13} : type.small, {color: colors.text, flex: 1}]}>{isCommand ? `$ ${summary}` : summary}</RNText>
        {result?.detail?.added !== undefined ? <Text variant="hud" fontSize={12} letterSpacing={0.4} tone="success">+{result.detail.added}</Text> : null}
        {result?.detail?.removed ? <Text variant="hud" fontSize={12} letterSpacing={0.4} tone="danger">−{result.detail.removed}</Text> : null}
        {status === 'denied' ? <X size={14} color={colors.faint} /> : null}
        {running && status !== 'denied' ? <Text variant="label" fontSize={11} tone="accent">exec</Text> : pending ? <Text variant="label" fontSize={11} tone="faint">queued</Text> : null}
        {open ? <ChevronDown size={16} color={colors.faint} /> : <ChevronRight size={16} color={colors.faint} />}
      </XStack>
      {(open || (isCommand && running)) && result ? (
        <YStack borderTopWidth={1} borderTopColor="$line" backgroundColor="$code" padding="$3">
          {diff && open ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <YStack>
                {diff.map((line, index) => (
                  <RNText key={index} style={[type.mono, {fontSize: 12, lineHeight: 17, color: line.kind === 'add' ? colors.success : line.kind === 'del' ? colors.danger : colors.muted, backgroundColor: line.kind === 'add' ? colors.successSoft : line.kind === 'del' ? colors.dangerSoft : 'transparent'}]}>
                    {line.kind === 'add' ? '+ ' : line.kind === 'del' ? '- ' : '  '}{line.text}
                  </RNText>
                ))}
              </YStack>
            </ScrollView>
          ) : (
            <ScrollView style={{maxHeight: 260}} nestedScrollEnabled>
              <RNText selectable style={[type.mono, {fontSize: 12, lineHeight: 17, color: colors.muted}]}>{result.output.slice(-6000)}</RNText>
            </ScrollView>
          )}
        </YStack>
      ) : null}
    </YStack>
  );
});
