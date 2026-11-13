import React, {useMemo, useState} from 'react';
import {FlatList} from 'react-native';
import {alert} from '../ui/dialog';
import {useNavigation} from '@react-navigation/native';
import {Code2, Compass, Pin, SquarePen, Search, CalendarCheck, Globe2, X, type LucideIcon} from 'lucide-react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {discardChat} from '../engine/checkpoints';
import {useChats, type Chat} from '../stores/chats';
import {sendMessage} from '../engine/agent';
import {useTheme} from '../theme/ThemeProvider';
import {Card, Divider, Field, IconButton, IconTile, LargeTitle, PulseDot, Screen, Tag, Text, type Tone} from '../ui';
import {Composer} from '../components/Composer';
import {relativeTime} from '../utils/format';

const STARTERS: {title: string; prompt: string; icon: LucideIcon; tone: Tone}[] = [
  {title: 'Build a landing page', icon: Globe2, tone: 'accent', prompt: 'Build a single-file landing page for a neighborhood coffee roaster in index.html, then tell me how to preview it.'},
  {title: 'Explain a GitHub repo', icon: Compass, tone: 'info', prompt: 'Explain what the repository facebook/react-native does and how its new architecture works, in plain language.'},
  {title: 'Write a Python script', icon: Code2, tone: 'violet', prompt: 'Write a Python script that renames every photo in a folder by its date, and run it on a sample folder.'},
  {title: 'Plan my week', icon: CalendarCheck, tone: 'success', prompt: 'Help me plan a focused work week. Ask me three short questions first.'},
];

function preview(chatId: string): string {
  const list = useChats.getState().messages[chatId] ?? [];
  for (let index = list.length - 1; index >= 0; index--) {
    const message = list[index];
    if ((message.role === 'assistant' || message.role === 'user') && message.text) return message.text.replace(/[#*`>_]/g, '').replace(/\s+/g, ' ').trim();
  }
  return '';
}

export default function ChatsScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const chats = useChats(state => state.chats);
  const running = useChats(state => state.running);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const sorted = useMemo(() => {
    const filtered = query ? chats.filter(chat => chat.title.toLowerCase().includes(query.toLowerCase()) || preview(chat.id).toLowerCase().includes(query.toLowerCase())) : chats;
    return [...filtered].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  }, [chats, query]);

  const start = (text: string, images: string[] = []) => {
    const chatId = useChats.getState().createChat();
    navigation.navigate('Chat', {chatId});
    void sendMessage(chatId, text, images);
  };
  const options = (chat: Chat) => alert(chat.title, undefined, [
    {text: chat.pinned ? 'Unpin' : 'Pin to top', onPress: () => useChats.getState().togglePin(chat.id)},
    {text: 'Delete', style: 'destructive', onPress: () => { useChats.getState().deleteChat(chat.id); void discardChat(chat.id); }},
    {text: 'Cancel', style: 'cancel'},
  ]);

  const renderItem = ({item}: {item: Chat}) => {
    const status = running[item.id]?.status;
    return (
      <YStack paddingHorizontal="$4" paddingVertical="$3" gap="$1" animation="quick" pressStyle={{backgroundColor: '$accentSoft'}} borderLeftWidth={2} borderLeftColor={status ? '$accent' : item.pinned ? '$accentLine' : 'transparent'}
        onPress={() => navigation.navigate('Chat', {chatId: item.id})} onLongPress={() => options(item)}
        accessibilityRole="button" accessibilityHint="Long press for options">
        <XStack alignItems="center" gap="$2">
          {item.pinned ? <Pin size={13} color={colors.accent} /> : null}
          <Text variant="bodyMedium" numberOfLines={1} flex={1}>{item.title}</Text>
          <Text variant="label" fontSize={11} tone="faint" numberOfLines={1} flexShrink={0} maxFontSizeMultiplier={1.3}>{relativeTime(item.updatedAt)}</Text>
        </XStack>
        <XStack alignItems="center" gap="$2">
          {status ? <PulseDot /> : null}
          <Text variant="small" tone={status ? 'accent' : 'muted'} numberOfLines={2} flex={1}>{status ? `${status}…` : preview(item.id) || 'No messages yet'}</Text>
        </XStack>
      </YStack>
    );
  };

  return (
    <Screen padded={false}>
      <YStack flex={1}>
        <YStack paddingHorizontal="$4">
          <LargeTitle title="Forge" eyebrow="chats" subtitle={chats.length ? `${chats.length} conversation${chats.length === 1 ? '' : 's'}` : 'Your AI workbench, in your pocket'} right={<>
            {chats.length ? <IconButton icon={searching ? X : Search} label={searching ? 'Close search' : 'Search chats'} onPress={() => { setSearching(value => !value); setQuery(''); }} /> : null}
            <IconButton icon={SquarePen} label="New chat" tone="accent" filled onPress={() => navigation.navigate('Chat', {chatId: useChats.getState().createChat()})} />
          </>} />
          {searching ? <Field autoFocus value={query} onChangeText={setQuery} placeholder="Search chats" returnKeyType="search" /> : null}
        </YStack>
        <FlatList
          data={sorted}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{paddingBottom: 16, flexGrow: 1}}
          ItemSeparatorComponent={() => <Divider marginLeft={16} />}
          ListEmptyComponent={query ? <Text tone="muted" padding="$4">No chats match “{query}”.</Text> : (
            <YStack paddingHorizontal="$4" paddingTop="$6">
              <Tag label="Agent workbench" tone="accent" />
              <Text variant="title" textTransform="uppercase" letterSpacing={1.2} maxWidth={320} marginTop="$3">What should we make?</Text>
              <Text variant="small" tone="muted" marginTop="$1.5" marginBottom="$5">Forge can write and edit files, run Linux commands, search the web and use the skills you install.</Text>
              <XStack flexWrap="wrap" gap="$2.5">
                {STARTERS.map(starter => (
                  <Card key={starter.title} pressable flexBasis="46%" flexGrow={1} minHeight={112} padding="$3.5" gap="$2.5" onPress={() => start(starter.prompt)} accessibilityRole="button">
                    <IconTile icon={starter.icon} tone={starter.tone} />
                    <YStack gap="$1">
                      <Text variant="hud" tone="accent">{starter.title}</Text>
                      <Text variant="caption" tone="muted" numberOfLines={2}>{starter.prompt}</Text>
                    </YStack>
                  </Card>
                ))}
              </XStack>
            </YStack>
          )}
        />
        <YStack paddingHorizontal="$2.5" paddingBottom="$2">
          <Composer onSend={start} onModelPress={() => navigation.navigate('ModelPicker')} />
        </YStack>
      </YStack>
    </Screen>
  );
}
