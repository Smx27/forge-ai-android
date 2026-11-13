import React, {useEffect, useState} from 'react';
import {ScrollView, Share, TextInput} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft, Eye, Pencil, Save, Share2} from 'lucide-react-native';
import type {RootStackParamList} from '../navigation/types';
import {forgeNative} from '../native';
import {toRelative} from '../engine/workspace';
import {useTheme} from '../theme/ThemeProvider';
import {fonts} from '../theme/tokens';
import {IconButton, NavHeader, Screen, Text} from '../ui';
import {Markdown} from '../components/Markdown';

export default function FileViewScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'FileView'>>();
  const {colors} = useTheme();
  const [content, setContent] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const name = params.path.split('/').pop() ?? '';
  const isHtml = /\.html?$/i.test(name);
  const isMarkdown = /\.md$/i.test(name);

  useEffect(() => {
    forgeNative.readFile(params.path).then(text => { setContent(text); setDraft(text); }).catch(failure => setError(failure instanceof Error ? failure.message : 'Could not open this file.'));
  }, [params.path]);

  const save = async () => {
    await forgeNative.writeFile(params.path, draft);
    setContent(draft); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  const lines = (content ?? '').split('\n');
  const gutter = 20 + String(Math.min(lines.length, 4000)).length * 8;

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title={name} backIcon={ArrowLeft} onBack={() => navigation.goBack()} right={<>
        {isHtml && !editing ? <IconButton icon={Eye} label="Preview page" onPress={() => navigation.navigate('Preview', {uri: `file://${params.path}`, title: name})} /> : null}
        {content !== null ? <IconButton icon={Share2} label="Share" onPress={() => void Share.share({message: content, title: name})} /> : null}
        {content !== null ? <IconButton icon={editing ? Save : Pencil} tone={editing ? 'accent' : 'text'} label={editing ? 'Save' : 'Edit'} onPress={() => editing ? void save() : setEditing(true)} /> : null}
      </>} />
      <Text variant="caption" tone={saved ? 'success' : 'faint'} paddingHorizontal="$4" paddingVertical="$1.5">{saved ? 'Saved' : toRelative(params.path)}</Text>
      {error ? <Text tone="danger" padding="$4">{error}</Text> : editing ? (
        <TextInput value={draft} onChangeText={setDraft} multiline autoCapitalize="none" autoCorrect={false} spellCheck={false} textAlignVertical="top"
          style={{flex: 1, fontFamily: fonts.mono, fontSize: 13, lineHeight: 19, color: colors.text, backgroundColor: colors.code, padding: 16}} selectionColor={colors.accent} />
      ) : isMarkdown && content !== null ? (
        <ScrollView contentContainerStyle={{padding: 16}}><Markdown text={content} /></ScrollView>
      ) : (
        <ScrollView style={{backgroundColor: colors.code}} contentContainerStyle={{paddingVertical: 12}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <YStack paddingRight="$4">
              {lines.slice(0, 4000).map((line, index) => (
                <XStack key={index}>
                  <Text variant="mono" tone="faint" fontSize={12} width={gutter} textAlign="right" paddingRight="$3">{index + 1}</Text>
                  <Text variant="mono" selectable fontSize={12}>{line || ' '}</Text>
                </XStack>
              ))}
              {lines.length > 4000 ? <Text variant="mono" tone="faint" fontSize={12} paddingLeft={gutter}>{lines.length - 4000} more lines. Open in edit mode to see all.</Text> : null}
            </YStack>
          </ScrollView>
        </ScrollView>
      )}
    </Screen>
  );
}
