import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FlatList, Image, Share, StyleSheet, View} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {alert} from '../ui/dialog';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft, ArrowLeftRight, Copy, FolderOpen, Gauge, MoreVertical, RotateCcw, ShieldAlert, Undo2} from 'lucide-react-native';
import {useSettings} from '../stores/settings';
import {useUsage, dayKey, tokensOn} from '../stores/usage';
import {useCheckpoints} from '../stores/checkpoints';
import {changesSince, discardChat, restoreSince} from '../engine/checkpoints';
import type {RootStackParamList} from '../navigation/types';
import {useChats, type ChatMessage} from '../stores/chats';
import {regenerate, sendMessage, stopAgent} from '../engine/agent';
import {useTheme} from '../theme/ThemeProvider';
import {radius, space} from '../theme/tokens';
import {Button, Corners, IconButton, NavHeader, PulseDot, Screen, Tap, Text} from '../ui';
import {Markdown} from '../components/Markdown';
import {ToolCard} from '../components/ToolCard';
import {Composer, HeatLine} from '../components/Composer';
import {forgeNative} from '../native';

type Item =
  | {kind: 'user'; message: Extract<ChatMessage, {role: 'user'}>}
  | {kind: 'assistant'; message: Extract<ChatMessage, {role: 'assistant'}>; results: Record<string, Extract<ChatMessage, {role: 'tool'}>>; last: boolean; turnId?: string; head?: boolean};

const EMPTY: ChatMessage[] = [];

function summarize(args: string): string {
  try { const value = JSON.parse(args) as Record<string, unknown>; return String(value.path ?? value.command ?? value.query ?? value.url ?? '').slice(0, 120); } catch { return ''; }
}

function ApprovalCard({chatId}: {chatId: string}) {
  const {colors} = useTheme();
  const approval = useChats(state => state.approval);
  if (!approval || approval.chatId !== chatId) return null;
  const command = approval.name === 'run_command';
  return (
    <YStack borderRadius="$2" borderWidth={1} borderColor="$accentLine" backgroundColor="$surface" padding="$3" gap="$3">
      <Corners color={colors.accent} size={8} />
      <XStack alignItems="center" gap="$2">
        <ShieldAlert size={18} color={colors.warn} strokeWidth={1.7} />
        <Text variant="hud" tone="warn">{command ? 'Authorize command' : 'Authorize change'}</Text>
      </XStack>
      <YStack borderRadius="$1" padding="$2" backgroundColor="$code" borderWidth={1} borderColor="$line">
        <Text variant="mono" numberOfLines={6}>{command ? `$ ${approval.summary}` : approval.summary}</Text>
      </YStack>
      <XStack gap="$2">
        <Button title="Decline" kind="secondary" compact style={{flex: 1}} onPress={() => approval.resolve(false)} />
        <Button title={command ? 'Run' : 'Allow'} compact style={{flex: 1}} onPress={() => approval.resolve(true)} />
      </XStack>
    </YStack>
  );
}

const AssistantBlock = React.memo(function AssistantBlock({item, chatId, running}: {item: Extract<Item, {kind: 'assistant'}>; chatId: string; running: boolean}) {
  const {colors} = useTheme();
  const {message, results, last, turnId, head} = item;
  const hasCheckpoint = useCheckpoints(state => !!turnId && !!state.byChat[chatId]?.some(checkpoint => checkpoint.turnId === turnId && checkpoint.entries.length));
  const undo = () => {
    if (!turnId) return;
    const {turns, files} = changesSince(chatId, turnId);
    alert('Undo file changes?', `Restores ${files} file${files === 1 ? '' : 's'} to the state before this request${turns > 1 ? `, including changes from ${turns - 1} later request${turns > 2 ? 's' : ''}` : ''}. Commands run in Linux are not undone.`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Undo', style: 'destructive', onPress: async () => {
        try { const restored = await restoreSince(chatId, turnId); alert('Changes undone', `Restored ${restored} item${restored === 1 ? '' : 's'}.`); }
        catch (error) { alert('Could not undo', error instanceof Error ? error.message : String(error)); }
      }},
    ]);
  };
  return (
    <View style={{gap: 10}}>
      {head ? (
        <XStack alignItems="center" gap={6}>
          <Text variant="label" tone="accent">FORGE ▸</Text>
          <YStack flex={1} height={1} backgroundColor="$line" />
        </XStack>
      ) : null}
      {message.note ? (
        <XStack alignSelf="flex-start" alignItems="center" gap={6} paddingHorizontal={10} paddingVertical={5} borderRadius={2} borderWidth={1} borderColor="$infoSoft" borderLeftWidth={2} borderLeftColor="$info" backgroundColor="$infoSoft" maxWidth="100%">
          <ArrowLeftRight size={12} color={colors.info} />
          <Text variant="caption" tone="info" flexShrink={1}>{message.note}</Text>
        </XStack>
      ) : null}
      {message.text ? <Markdown text={message.text} /> : null}
      {message.toolCalls?.map(call => <ToolCard key={call.id} name={call.name} args={call.arguments} result={results[call.id]?.result} />)}
      {message.error ? (
        <View style={[styles.error, {borderColor: colors.danger}]}>
          <Text variant="small" tone="danger">{message.error}</Text>
          {last && !running ? <Button title="Try again" kind="ghost" compact icon={RotateCcw} onPress={() => void regenerate(chatId)} style={{alignSelf: 'flex-start', paddingHorizontal: 0}} /> : null}
        </View>
      ) : null}
      {!running && hasCheckpoint && !last ? (
        <View style={{flexDirection: 'row', marginLeft: -8}}>
          <IconButton icon={Undo2} size={16} tone="faint" label="Undo file changes" onPress={undo} />
        </View>
      ) : null}
      {last && !running && message.text ? (
        <View style={{flexDirection: 'row', gap: 4, marginLeft: -8}}>
          <IconButton icon={Copy} size={16} tone="faint" label="Copy answer" onPress={() => void forgeNative.copyText(message.text)} />
          <IconButton icon={RotateCcw} size={16} tone="faint" label="Regenerate" onPress={() => void regenerate(chatId)} />
          {hasCheckpoint ? <IconButton icon={Undo2} size={16} tone="faint" label="Undo file changes" onPress={undo} /> : null}
          {message.model ? <Text variant="label" fontSize={11} tone="faint" style={{alignSelf: 'center', marginLeft: 4}}>{'MDL:' + message.model.split('/').pop()}</Text> : null}
        </View>
      ) : null}
    </View>
  );
});

export default function ChatScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const {colors} = useTheme();
  const chatId = params.chatId;
  const chat = useChats(state => state.chats.find(item => item.id === chatId));
  const messages = useChats(state => state.messages[chatId] ?? EMPTY);
  const status = useChats(state => state.running[chatId]?.status);
  const list = useRef<FlatList<Item>>(null);
  const running = !!status;
  const [editing, setEditing] = useState<{id: string; text: string; images?: string[]} | null>(null);
  const budget = useSettings(state => state.dailyBudget);
  const overBudget = useUsage(state => budget > 0 && tokensOn(state.days, dayKey()) > budget);

  const items = useMemo(() => {
    const results: Record<string, Extract<ChatMessage, {role: 'tool'}>> = {};
    messages.forEach(message => { if (message.role === 'tool') results[message.toolCallId] = message; });
    let lastPlan = '';
    messages.forEach(message => { if (message.role === 'assistant') message.toolCalls?.forEach(call => { if (call.name === 'update_plan') lastPlan = call.id; }); });
    const out: Item[] = [];
    messages.forEach(original => {
      const message = original.role === 'assistant' && original.toolCalls?.some(call => call.name === 'update_plan' && call.id !== lastPlan)
        ? {...original, toolCalls: original.toolCalls.filter(call => call.name !== 'update_plan' || call.id === lastPlan)} : original;
      if (message.role === 'user') out.push({kind: 'user', message});
      else if (message.role === 'assistant') {
        if (!message.text && !message.toolCalls?.length && !message.error && !message.note) return;
        out.push({kind: 'assistant', message, results, last: false, head: !out.length || out[out.length - 1].kind === 'user'});
      }
    });
    let turnUser = '';
    let lastAssistant = -1;
    const close = () => { if (lastAssistant >= 0 && turnUser) { const item = out[lastAssistant]; if (item.kind === 'assistant') out[lastAssistant] = {...item, turnId: turnUser}; } };
    out.forEach((item, index) => {
      if (item.kind === 'user') { close(); turnUser = item.message.id; lastAssistant = -1; }
      else lastAssistant = index;
    });
    close();
    for (let index = out.length - 1; index >= 0; index--) { const item = out[index]; if (item.kind === 'assistant') { out[index] = {...item, last: true}; break; } if (item.kind === 'user') break; }
    return out;
  }, [messages]);

  useEffect(() => {
    if (!chat) navigation.goBack();
  }, [chat, navigation]);

  const scrollToEnd = useCallback(() => requestAnimationFrame(() => list.current?.scrollToEnd({animated: true})), []);
  useEffect(() => { if (items.length) scrollToEnd(); }, [items.length, scrollToEnd]);

  const exportMarkdown = async () => {
    const lines = [`# ${chat?.title ?? 'Chat'}`, '', `_Exported from Forge on ${new Date().toLocaleString()}_`, ''];
    messages.forEach(message => {
      if (message.role === 'user') lines.push('## You', '', message.text || '_(image)_', '');
      else if (message.role === 'assistant') {
        const calls = message.toolCalls?.map(call => `- \`${call.name}\` ${summarize(call.arguments)}`) ?? [];
        if (!message.text && !calls.length && !message.error) return;
        lines.push(`## Forge${message.model ? ` · ${message.model}` : ''}`, '');
        if (message.text) lines.push(message.text, '');
        if (calls.length) lines.push(...calls, '');
        if (message.error) lines.push(`> Error: ${message.error}`, '');
      }
    });
    const name = (chat?.title ?? 'chat').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'chat';
    const path = `${forgeNative.cacheDir}/${name}.md`;
    try {
      await forgeNative.writeFile(path, lines.join('\n'));
      const saved = await forgeNative.saveDocument(path, `${name}.md`, 'text/markdown');
      if (saved) alert('Chat exported', `Saved ${name}.md`);
    } catch (error) { alert('Could not export', error instanceof Error ? error.message : String(error)); }
  };

  const userMenu = (message: Extract<ChatMessage, {role: 'user'}>) => alert('Message', undefined, [
    ...(running ? [] : [{text: 'Edit and resend', onPress: () => setEditing({id: message.id, text: message.text, images: message.images})}]),
    {text: 'Copy', onPress: () => void forgeNative.copyText(message.text)},
    {text: 'Cancel', style: 'cancel' as const},
  ]);

  const send = (text: string, images: string[]) => {
    if (editing) {
      useChats.getState().truncateFrom(chatId, editing.id);
      const kept = images.length ? images : editing.images ?? [];
      setEditing(null);
      void sendMessage(chatId, text, kept);
      return;
    }
    void sendMessage(chatId, text, images);
  };

  const menu = () => alert(chat?.title ?? 'Chat', undefined, [
    {text: 'Export as Markdown', onPress: () => void exportMarkdown()},
    {text: 'Share transcript', onPress: () => void Share.share({message: messages.filter(message => message.role !== 'tool').map(message => `${message.role === 'user' ? 'You' : 'Forge'}: ${(message as {text: string}).text}`).join('\n\n')})},
    {text: chat?.folder ? `Project folder: ${chat.folder}` : 'Set project folder', onPress: () => navigation.navigate('ChatFolder', {chatId})},
    {text: 'Delete chat', style: 'destructive', onPress: () => { stopAgent(chatId); useChats.getState().deleteChat(chatId); void discardChat(chatId); }},
    {text: 'Cancel', style: 'cancel'},
  ]);

  const renderItem = ({item}: {item: Item}) => item.kind === 'user' ? (
    <Tap onLongPress={() => userMenu(item.message)} accessibilityLabel="Your message. Long press for options" style={[styles.user, {backgroundColor: editing?.id === item.message.id ? colors.accentSoft : colors.raised, borderColor: colors.lineStrong, borderRightColor: colors.accent}]}>
      <Text variant="label" fontSize={11} tone="accent" style={{marginBottom: 4}}>{'> YOU'}</Text>
      {item.message.images?.length ? (
        <View style={styles.images}>
          {item.message.images.map(path => <Image key={path} source={{uri: `file://${path}`}} style={[styles.image, {backgroundColor: colors.surface}]} accessibilityLabel="Attached image" />)}
        </View>
      ) : null}
      {item.message.text ? <Text>{item.message.text}</Text> : null}
    </Tap>
  ) : <AssistantBlock item={item} chatId={chatId} running={running} />;

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title={chat?.title ?? ''} backIcon={ArrowLeft} onBack={() => navigation.goBack()} right={<IconButton icon={MoreVertical} label="Chat options" onPress={menu} />} />
      {chat?.folder ? (
        <Tap onPress={() => navigation.navigate('ChatFolder', {chatId})} accessibilityRole="button" accessibilityLabel={`Project folder ${chat.folder}. Change`} style={[styles.folder, {backgroundColor: colors.accentSoft, borderColor: colors.accentLine}]}>
          <FolderOpen size={14} color={colors.accent} />
          <Text variant="hud" fontSize={12} letterSpacing={0.6} tone="accent" numberOfLines={1}>{chat.folder}</Text>
        </Tap>
      ) : null}
      <View style={{flex: 1}}>
        <FlatList
          ref={list}
          data={items}
          keyExtractor={item => item.message.id}
          renderItem={renderItem}
          onContentSizeChange={() => { if (running) scrollToEnd(); }}
          contentContainerStyle={{padding: space.lg, gap: space.lg, flexGrow: 1}}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xl}}>
              <Text variant="label" tone="accent" style={{marginBottom: 8}}>{'// AWAITING INPUT'}</Text>
              <Text variant="title" textTransform="uppercase" letterSpacing={1.4} style={{textAlign: 'center'}}>Start with a goal</Text>
              <Text variant="small" tone="muted" style={{textAlign: 'center', marginTop: 6}}>Describe what you want built or answered. Forge plans the steps and shows every file it touches.</Text>
            </View>
          }
          ListFooterComponent={running ? <XStack alignItems="center" gap="$2"><PulseDot /><Text variant="hud" tone="accent">{status}…</Text></XStack> : null}
        />
        <View style={{paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm}}>
          {overBudget ? (
            <XStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingVertical={8} borderRadius="$2" borderWidth={1} borderColor="$danger" backgroundColor="$dangerSoft">
              <Gauge size={14} color={colors.danger} />
              <Text variant="caption" tone="danger" flex={1}>You are over today's token budget of {budget.toLocaleString()}.</Text>
              <Tap accessibilityRole="button" onPress={() => navigation.navigate('Usage')}><Text variant="caption" tone="danger" fontWeight="600">Usage</Text></Tap>
            </XStack>
          ) : null}
          <ApprovalCard chatId={chatId} />
          <HeatLine active={running} />
          <Composer key={chatId} initial={params.prefill} running={running} onStop={() => stopAgent(chatId)} onSend={send} onModelPress={() => navigation.navigate('ModelPicker')} autoFocus={!messages.length} editing={editing?.text ?? null} onCancelEdit={() => setEditing(null)} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  user: {alignSelf: 'flex-end', maxWidth: '86%', borderRadius: radius.sm, borderWidth: 1, borderRightWidth: 3, paddingHorizontal: 14, paddingVertical: 10},
  images: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6},
  image: {width: 140, height: 140, borderRadius: radius.md},
  folder: {flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginLeft: space.lg, marginTop: 6, paddingHorizontal: 10, height: 28, borderRadius: radius.sm, borderWidth: 1},
  error: {borderLeftWidth: 2, paddingLeft: space.md, gap: 2},
});
