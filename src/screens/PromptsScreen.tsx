import React, {useState} from 'react';
import {FlatList} from 'react-native';
import {alert} from '../ui/dialog';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft, Pencil, Plus, Trash2, Zap} from 'lucide-react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {usePrompts, slug, type SavedPrompt} from '../stores/prompts';
import {Button, Card, Divider, Empty, Field, IconButton, IconTile, NavHeader, Screen, Text} from '../ui';

type Draft = {id?: string; title: string; command: string; body: string};

export default function PromptsScreen() {
  const navigation = useNavigation();
  const {prompts, save, remove} = usePrompts();
  const [draft, setDraft] = useState<Draft | null>(null);
  const valid = !!draft && draft.title.trim().length > 0 && draft.body.trim().length > 0;
  const taken = !!draft && prompts.some(item => item.id !== draft.id && item.command === slug(draft.command || draft.title));
  const commit = () => {
    if (!draft || !valid || taken) return;
    save({id: draft.id, title: draft.title.trim(), command: draft.command, body: draft.body.trim()});
    setDraft(null);
  };
  const confirmRemove = (item: SavedPrompt) => alert(`Delete /${item.command}?`, undefined, [{text: 'Cancel', style: 'cancel'}, {text: 'Delete', style: 'destructive', onPress: () => remove(item.id)}]);

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Prompts" subtitle={`${prompts.length} saved`} backIcon={ArrowLeft} onBack={() => navigation.goBack()} right={draft ? null : <IconButton icon={Plus} label="New prompt" tone="accent" onPress={() => setDraft({title: '', command: '', body: ''})} />} />
      <FlatList
        data={prompts}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{flexGrow: 1, paddingBottom: 32}}
        ListHeaderComponent={
          <YStack padding="$4" paddingTop="$2" gap="$3">
            <Text variant="small" tone="muted">Type / in any chat to insert a saved prompt. The most used ones show first.</Text>
            {draft ? (
              <Card gap="$2" tone="accent">
                <Text variant="smallMedium">{draft.id ? 'Edit prompt' : 'New prompt'}</Text>
                <Field label="Title" value={draft.title} onChangeText={title => setDraft({...draft, title})} placeholder="Fix lint errors" />
                <Field label="Command" value={draft.command} onChangeText={command => setDraft({...draft, command})} placeholder={slug(draft.title) || 'lint'} autoCapitalize="none" hint={taken ? 'Another prompt already uses this command.' : `Type /${slug(draft.command || draft.title) || 'command'} to use it`} />
                <Field label="Prompt" value={draft.body} onChangeText={body => setDraft({...draft, body})} placeholder="Run the linter, then fix every error it reports." multiline />
                <XStack gap="$2" marginTop="$2">
                  <Button title="Cancel" kind="secondary" compact style={{flex: 1}} onPress={() => setDraft(null)} />
                  <Button title="Save" compact style={{flex: 1}} disabled={!valid || taken} onPress={commit} />
                </XStack>
              </Card>
            ) : null}
          </YStack>
        }
        ItemSeparatorComponent={() => <Divider marginLeft={64} />}
        renderItem={({item}) => (
          <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingVertical="$3">
            <IconTile icon={Zap} tone="accent" />
            <YStack flex={1} gap={2}>
              <XStack alignItems="center" gap="$2">
                <Text variant="mono" tone="accent">/{item.command}</Text>
                {item.uses ? <Text variant="caption" tone="faint">used {item.uses}×</Text> : null}
              </XStack>
              <Text variant="smallMedium" numberOfLines={1}>{item.title}</Text>
              <Text variant="caption" tone="muted" numberOfLines={2}>{item.body}</Text>
            </YStack>
            <IconButton icon={Pencil} size={17} tone="faint" label={`Edit ${item.title}`} onPress={() => setDraft({id: item.id, title: item.title, command: item.command, body: item.body})} />
            <IconButton icon={Trash2} size={17} tone="faint" label={`Delete ${item.title}`} onPress={() => confirmRemove(item)} />
          </XStack>
        )}
        ListEmptyComponent={<Empty icon={Zap} title="No saved prompts" body="Save instructions you repeat often and call them with a slash command." />}
      />
    </Screen>
  );
}
