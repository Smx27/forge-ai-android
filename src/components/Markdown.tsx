import React, {memo, useState} from 'react';
import {Linking, ScrollView, Text as RNText} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {Check, Copy} from 'lucide-react-native';
import {useTheme} from '../theme/ThemeProvider';
import {fonts, type} from '../theme/tokens';
import {Text, Tap} from '../ui';
import {forgeNative} from '../native';

type Block =
  | {kind: 'code'; lang: string; text: string}
  | {kind: 'heading'; level: number; text: string}
  | {kind: 'list'; ordered: boolean; items: string[]}
  | {kind: 'quote'; text: string}
  | {kind: 'rule'}
  | {kind: 'table'; text: string}
  | {kind: 'para'; text: string};

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w+#.-]*)/);
    if (fence) {
      const body: string[] = [];
      index++;
      while (index < lines.length && !lines[index].trim().startsWith(fence[1])) body.push(lines[index++]);
      index++;
      blocks.push({kind: 'code', lang: fence[2], text: body.join('\n')});
      continue;
    }
    if (!line.trim()) { index++; continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { blocks.push({kind: 'heading', level: heading[1].length, text: heading[2]}); index++; continue; }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { blocks.push({kind: 'rule'}); index++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) rows.push(lines[index++]);
      blocks.push({kind: 'table', text: rows.filter(row => !/^\s*\|[\s:|-]+\|\s*$/.test(row)).map(row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()).join('   ')).join('\n')});
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
      blocks.push({kind: 'quote', text: quote.join(' ')});
      continue;
    }
    const bullet = /^\s*(?:[-*+]|\d+[.)])\s+/;
    if (bullet.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (index < lines.length && (bullet.test(lines[index]) || (/^\s{2,}\S/.test(lines[index]) && items.length))) {
        if (bullet.test(lines[index])) items.push(lines[index].replace(bullet, ''));
        else items[items.length - 1] += ' ' + lines[index].trim();
        index++;
      }
      blocks.push({kind: 'list', ordered, items});
      continue;
    }
    const para: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|\s*(`{3,}|~{3,})|\s*>|\s*(?:[-*+]|\d+[.)])\s+|\s*\|)/.test(lines[index])) para.push(lines[index++]);
    if (!para.length) { para.push(lines[index++]); }
    blocks.push({kind: 'para', text: para.join(' ')});
  }
  return blocks;
}

function Inline({text, style}: {text: string; style?: object}) {
  const {colors} = useTheme();
  const parts: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('`')) parts.push(<RNText key={key++} style={{fontFamily: fonts.mono, fontSize: 14, backgroundColor: colors.raised, color: colors.text}}>{' '}{token.slice(1, -1)}{' '}</RNText>);
    else if (token.startsWith('**') || token.startsWith('__')) parts.push(<RNText key={key++} style={{fontFamily: fonts.medium}}>{token.slice(2, -2)}</RNText>);
    else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      parts.push(<RNText key={key++} style={{color: colors.info, textDecorationLine: 'underline'}} onPress={() => /^https?:/.test(link[2]) && Linking.openURL(link[2])}>{link[1]}</RNText>);
    } else parts.push(<RNText key={key++} style={{fontStyle: 'italic'}}>{token.slice(1, -1)}</RNText>);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <RNText selectable style={[type.body, {color: colors.text}, style]}>{parts}</RNText>;
}

export function CodeBlock({code, lang}: {code: string; lang?: string}) {
  const {colors} = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <YStack backgroundColor="$code" borderColor="$line" borderWidth={1} borderRadius="$1" overflow="hidden">
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$3" paddingTop="$2" paddingBottom="$1.5">
        <Text variant="label" fontSize={11} tone="accent">{'</> ' + (lang || 'text')}</Text>
        <Tap accessibilityRole="button" accessibilityLabel="Copy code" hitSlop={10} onPress={() => { void forgeNative.copyText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} flexDirection="row" alignItems="center" gap="$1">
          {copied ? <Check size={14} color={colors.success} /> : <Copy size={14} color={colors.faint} />}
          <Text variant="label" fontSize={11} tone={copied ? 'success' : 'faint'}>{copied ? 'Copied' : 'Copy'}</Text>
        </Tap>
      </XStack>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 12, paddingBottom: 12}}>
        <RNText selectable style={[type.mono, {color: colors.text}]}>{code}</RNText>
      </ScrollView>
    </YStack>
  );
}

export const Markdown = memo(function Markdown({text}: {text: string}) {
  const {colors} = useTheme();
  const blocks = parseBlocks(text);
  return (
    <YStack gap="$2.5">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'code': return <CodeBlock key={index} code={block.text} lang={block.lang} />;
          case 'heading': return <Inline key={index} text={block.text} style={block.level <= 2 ? {...type.heading, fontSize: 19, lineHeight: 26} : type.heading} />;
          case 'rule': return <YStack key={index} height={1} backgroundColor="$line" />;
          case 'quote': return <YStack key={index} borderLeftWidth={2} borderLeftColor="$accent" paddingLeft="$3"><Inline text={block.text} style={{color: colors.muted}} /></YStack>;
          case 'table': return <CodeBlock key={index} code={block.text} lang="table" />;
          case 'list': return (
            <YStack key={index} gap="$1.5">
              {block.items.map((item, itemIndex) => (
                <XStack key={itemIndex}>
                  <RNText style={[type.body, {color: colors.accent, width: block.ordered ? 24 : 16}]}>{block.ordered ? `${itemIndex + 1}.` : '▸'}</RNText>
                  <YStack flex={1}><Inline text={item.replace(/^\[( |x)\]\s*/i, match => match.includes('x') ? '✓ ' : '○ ')} /></YStack>
                </XStack>
              ))}
            </YStack>
          );
          default: return <Inline key={index} text={block.text} />;
        }
      })}
    </YStack>
  );
});
