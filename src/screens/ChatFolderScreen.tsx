import React, {useEffect, useState} from 'react';
import {ScrollView} from 'react-native';
import {YStack} from '@tamagui/stacks';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {Check, Folder, FolderRoot, X} from 'lucide-react-native';
import type {RootStackParamList} from '../navigation/types';
import {useChats} from '../stores/chats';
import {forgeNative} from '../native';
import {WORKSPACE, resolveWorkspacePath} from '../engine/workspace';
import {useTheme} from '../theme/ThemeProvider';
import {Button, Field, Group, NavHeader, Row, Screen, Text} from '../ui';

export default function ChatFolderScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {params} = useRoute<RouteProp<RootStackParamList, 'ChatFolder'>>();
  const chat = useChats(state => state.chats.find(item => item.id === params.chatId));
  const [folders, setFolders] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    forgeNative.mkdir(WORKSPACE).then(() => forgeNative.listDir(WORKSPACE)).then(entries => setFolders(entries.filter(entry => entry.isDir).map(entry => entry.name))).catch(() => setFolders([]));
  }, []);

  const choose = (folder?: string) => { useChats.getState().setFolder(params.chatId, folder); navigation.goBack(); };
  const create = async () => {
    const clean = name.trim().replace(/\s+/g, '-');
    if (!/^[A-Za-z0-9._-]+$/.test(clean) || clean.startsWith('.')) { setError('Use letters, numbers, dots, dashes or underscores.'); return; }
    await forgeNative.mkdir(resolveWorkspacePath(clean));
    choose(clean);
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Project folder" backIcon={X} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, paddingTop: 12, paddingBottom: 40}}>
        <Text variant="small" tone="muted">The agent reads, writes and runs commands inside this folder, so each project stays separate. Other chats are not affected.</Text>
        <Group title="Work in">
          <Row icon={FolderRoot} title="Whole workspace" right={!chat?.folder ? <Check size={18} color={colors.success} /> : undefined} onPress={() => choose(undefined)} />
          {folders.map(folder => (
            <Row key={folder} icon={Folder} title={folder} right={chat?.folder === folder ? <Check size={18} color={colors.success} /> : undefined} onPress={() => choose(folder)} />
          ))}
        </Group>
        <Group title="New project">
          <YStack padding="$3" gap="$2">
            <Field value={name} onChangeText={text => { setName(text); setError(''); }} placeholder="my-app" autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => void create()} />
            {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
            <Button title="Create and use" kind="secondary" compact disabled={!name.trim()} onPress={() => void create()} />
          </YStack>
        </Group>
      </ScrollView>
    </Screen>
  );
}
