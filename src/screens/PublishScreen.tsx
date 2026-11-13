import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Linking, ScrollView} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {useFocusEffect, useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft, ExternalLink, FileArchive, Folder, Github, Copy, ShieldAlert, Sparkles} from 'lucide-react-native';
import type {RootStackParamList} from '../navigation/types';
import {forgeNative, type DirEntry} from '../native';
import {WORKSPACE} from '../engine/workspace';
import {useSettings} from '../stores/settings';
import {useLinux} from '../stores/linux';
import {cleanTopics, draftRepoDetails, importZipProject, inspectProject, publishToGitHub, slugify, type ProjectInfo, type PublishResult, type RepoDraft} from '../engine/publish';
import {fonts} from '../theme/tokens';
import {Button, Empty, Field, Group, NavHeader, Row, Screen, Segmented, Tag, Text} from '../ui';

type Step = 'source' | 'analyzing' | 'review' | 'pushing' | 'done';

export default function PublishScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'Publish'>>();
  const githubLogin = useSettings(state => state.githubLogin);
  const linuxInstalled = useLinux(state => state.installed);
  const [step, setStep] = useState<Step>('source');
  const [folders, setFolders] = useState<DirEntry[]>([]);
  const [info, setInfo] = useState<ProjectInfo | null>(null);
  const [draft, setDraft] = useState<RepoDraft | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topics, setTopics] = useState('');
  const [gitignore, setGitignore] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState('');
  const [result, setResult] = useState<PublishResult | null>(null);
  const controller = useRef<AbortController | null>(null);

  const loadFolders = useCallback(async () => {
    try { await forgeNative.mkdir(WORKSPACE); setFolders((await forgeNative.listDir(WORKSPACE)).filter(entry => entry.isDir)); } catch { setFolders([]); }
  }, []);
  useFocusEffect(useCallback(() => { void loadFolders(); }, [loadFolders]));

  const analyze = useCallback(async (dir: string) => {
    setError(null); setStep('analyzing');
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      const project = await inspectProject(dir);
      setInfo(project);
      const next = await draftRepoDetails(project, controller.current.signal);
      setDraft(next);
      setName(next.name); setDescription(next.description); setTopics(next.topics.join(', ')); setGitignore(next.gitignore ?? '');
      setStep('review');
    } catch (failure) {
      if (controller.current?.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : String(failure));
      setStep('source');
    }
  }, []);

  useEffect(() => { if (params?.path) void analyze(params.path); return () => controller.current?.abort(); }, [params?.path, analyze]);

  const importZip = async () => {
    setError(null);
    try { const dir = await importZipProject(); if (dir) { await loadFolders(); await analyze(dir); } }
    catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };

  const push = async () => {
    if (!info || !draft) return;
    setError(null); setLog(''); setStep('pushing');
    try {
      const done = await publishToGitHub(info, {...draft, name, description, topics: cleanTopics(topics.split(',')), gitignore: info.hasGitignore ? null : gitignore, isPrivate: visibility === 'private'},
        line => { if (line) setLog(previous => (previous + line + '\n').slice(-8000)); });
      setResult(done); setStep('done');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setStep('review');
    }
  };

  const topicList = cleanTopics(topics.split(','));
  const blocked = !githubLogin ? 'Connect your GitHub account first.' : !linuxInstalled ? 'Install Linux from the Terminal tab first. Git runs there.' : null;

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Push to GitHub" backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, paddingTop: 12, paddingBottom: 48}}>
        {blocked ? (
          <Group title="Before you start" footer={!githubLogin ? 'Use a token that can create repositories: fine-grained with Administration and Contents set to Read and write, or classic with the repo scope.' : undefined}>
            <Row icon={Github} iconTone="danger" title={blocked} chevron={!githubLogin} onPress={!githubLogin ? () => navigation.navigate('Git') : undefined} />
          </Group>
        ) : null}

        {step === 'source' ? (
          <>
            <Text variant="small" tone="muted">Pick your source code. Forge checks the project, writes a .gitignore if it is missing, suggests a description and topics, then creates the repository and pushes it.</Text>
            <Group title="From a zip">
              <Row icon={FileArchive} iconTone="accent" title="Import a zip" subtitle="Unpacked into your workspace, then prepared for GitHub" chevron onPress={() => void importZip()} />
            </Group>
            <Group title="From your workspace">
              {folders.length
                ? folders.map(folder => <Row key={folder.path} icon={Folder} title={folder.name} chevron onPress={() => void analyze(folder.path)} />)
                : <Empty icon={Folder} title="No folders yet" body="Import a zip above, or ask Forge to build something first." />}
            </Group>
          </>
        ) : null}

        {step === 'analyzing' ? (
          <Group title="Preparing">
            <YStack padding="$3" gap="$3">
              <Button title="Reading the project and asking the AI" kind="secondary" loading disabled />
              <Text variant="small" tone="muted">Forge reads the file tree, manifests and README, then drafts the details. Nothing is uploaded yet.</Text>
              <Button title="Cancel" kind="ghost" compact onPress={() => { controller.current?.abort(); setStep('source'); }} />
            </YStack>
          </Group>
        ) : null}

        {(step === 'review' || step === 'pushing') && info && draft ? (
          <>
            {draft.note ? <Text variant="small" tone="warn" marginBottom="$2">{draft.note}</Text> : null}
            <Group title="Repository" footer={'Project: ' + info.folder + (info.stacks.length ? ' · ' + info.stacks.join(', ') : '')}>
              <YStack paddingHorizontal="$3" paddingBottom="$3">
                <Field label="Name" value={name} onChangeText={setName} onBlur={() => setName(slugify(name))} autoCapitalize="none" autoCorrect={false} hint={githubLogin ? 'github.com/' + githubLogin + '/' + slugify(name) : undefined} />
                <Field label="Description" value={description} onChangeText={value => setDescription(value.slice(0, 350))} multiline hint={description.length + ' / 350'} />
                <Field label="Topics" value={topics} onChangeText={setTopics} autoCapitalize="none" autoCorrect={false} hint="Comma separated. Lowercase letters, numbers and hyphens." />
                {topicList.length ? <XStack flexWrap="wrap" gap="$1.5" marginTop="$2">{topicList.map(topic => <Tag key={topic} label={topic} tone="accent" />)}</XStack> : null}
                <Text variant="label" tone="muted" marginTop="$3" marginBottom="$1.5">Visibility</Text>
                <Segmented options={[{value: 'private', label: 'Private'}, {value: 'public', label: 'Public'}]} value={visibility} onChange={setVisibility} />
                <Text variant="caption" tone="faint" marginTop="$1.5">{visibility === 'private' ? 'Only you and people you invite can see it.' : 'Anyone on the internet can see and clone it.'}</Text>
              </YStack>
            </Group>

            <Group title=".gitignore" footer={info.hasGitignore ? undefined : 'Written to the project before the first commit. Edit it freely.'}>
              {info.hasGitignore
                ? <Row icon={Sparkles} title="Using the project's own .gitignore" subtitle="It was already in the source, so Forge leaves it as it is." />
                : (
                  <YStack paddingHorizontal="$3" paddingBottom="$3">
                    <XStack marginTop="$3"><Tag label={draft.source === 'ai' ? 'Written by AI' : 'From a template'} tone={draft.source === 'ai' ? 'violet' : 'muted'} icon={Sparkles} /></XStack>
                    <Field value={gitignore} onChangeText={setGitignore} multiline autoCapitalize="none" autoCorrect={false} style={{fontFamily: fonts.mono, fontSize: 13, minHeight: 180, maxHeight: 320}} />
                  </YStack>
                )}
            </Group>

            {info.sensitive.length ? (
              <Group title="Check before pushing" footer={info.hasGitignore ? 'These are pushed unless your .gitignore excludes them.' : 'These are listed in the .gitignore above, so they stay on your phone.'}>
                {info.sensitive.slice(0, 8).map(file => <Row key={file} icon={ShieldAlert} iconTone="warn" title={file} subtitle="Looks like a secret or signing key" />)}
              </Group>
            ) : null}

            <YStack gap="$2" marginTop="$4">
              <Button title={'Create ' + visibility + ' repository and push'} icon={Github} loading={step === 'pushing'} disabled={!!blocked || !name.trim() || step === 'pushing'} onPress={() => void push()} />
              {step === 'review' ? <Button title="Ask the AI again" kind="secondary" compact icon={Sparkles} onPress={() => void analyze(info.dir)} /> : null}
            </YStack>
          </>
        ) : null}

        {step === 'done' && result ? (
          <Group title="Published" footer={result.warnings.join(' ') || undefined}>
            <Row icon={Github} iconTone="success" title={result.fullName} subtitle={(visibility === 'private' ? 'Private' : 'Public') + ' repository, pushed'} />
            <Row icon={ExternalLink} title="Open on GitHub" chevron onPress={() => void Linking.openURL(result.url)} />
            <Row icon={Copy} title="Copy link" onPress={() => void forgeNative.copyText(result.url)} />
          </Group>
        ) : null}

        {error ? <Text variant="small" tone="danger" marginTop="$3">{error}</Text> : null}
        {log ? <Text variant="mono" selectable tone="muted" fontSize={11.5} marginTop="$3" backgroundColor="$code" borderRadius="$2" padding="$2" borderWidth={1} borderColor="$line">{log.trim()}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
