import React, {useState} from 'react';
import {FlatList} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft, Brain, Trash2} from 'lucide-react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {useLibrary} from '../stores/library';
import {Button, Divider, Empty, Field, IconButton, NavHeader, Screen, Tag, Text} from '../ui';
import {relativeTime} from '../utils/format';

export default function MemoryScreen() {
  const navigation = useNavigation();
  const {memory, remember, forget} = useLibrary();
  const [text, setText] = useState('');
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Memory" backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <FlatList
        data={memory}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{flexGrow: 1, paddingBottom: 24}}
        ListHeaderComponent={
          <YStack padding="$4" paddingTop="$3" gap="$1">
            <Text variant="small" tone="muted">Forge remembers facts and preferences across chats. Relevant memories are added to each conversation. You can add your own.</Text>
            <Field value={text} onChangeText={setText} placeholder="I prefer TypeScript and short answers" multiline />
            <Button title="Remember this" kind="secondary" compact style={{marginTop: 8, alignSelf: 'flex-start'}} disabled={!text.trim()} onPress={() => { remember(text, 'preference'); setText(''); }} />
          </YStack>
        }
        ItemSeparatorComponent={() => <Divider marginLeft="$4" />}
        renderItem={({item}) => (
          <XStack alignItems="center" gap="$2" paddingHorizontal="$4" paddingVertical="$3">
            <YStack flex={1} gap="$1.5">
              <Text>{item.text}</Text>
              <XStack gap="$1.5" alignItems="center"><Tag label={item.kind} /><Text variant="caption" tone="faint">{relativeTime(item.ts)}</Text></XStack>
            </YStack>
            <IconButton icon={Trash2} size={18} tone="faint" label="Forget" onPress={() => forget(item.id)} />
          </XStack>
        )}
        ListEmptyComponent={<Empty icon={Brain} title="Nothing remembered yet" body="When you share preferences or decisions, Forge can save them here." />}
      />
    </Screen>
  );
}
