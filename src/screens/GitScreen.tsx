import React, {useRef, useState} from 'react';
import {Linking, ScrollView} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft, Github, LogOut, UploadCloud} from 'lucide-react-native';
import {useSettings} from '../stores/settings';
import {useLinux} from '../stores/linux';
import {applyGitConfig, cloneRepository, connectGitHub, disconnectGitHub} from '../engine/git';
import {Button, Field, Group, NavHeader, Row, Screen, Text} from '../ui';

export default function GitScreen() {
  const navigation = useNavigation();
  const settings = useSettings();
  const linuxInstalled = useLinux(state => state.installed);
  const [token, setToken] = useState('');
  const [name, setName] = useState(settings.gitName);
  const [email, setEmail] = useState(settings.gitEmail);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<'connect' | 'identity' | 'clone' | null>(null);
  const [message, setMessage] = useState<{tone: 'danger' | 'success'; text: string} | null>(null);
  const [log, setLog] = useState('');
  const controller = useRef<AbortController | null>(null);

  const run = async (kind: 'connect' | 'identity' | 'clone', action: () => Promise<string>) => {
    setBusy(kind); setMessage(null);
    try { setMessage({tone: 'success', text: await action()}); }
    catch (error) { setMessage({tone: 'danger', text: error instanceof Error ? error.message : String(error)}); }
    finally { setBusy(null); }
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Git and GitHub" backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, paddingTop: 12, paddingBottom: 48}}>
        <Text variant="small" tone="muted">Connect GitHub so you and the agent can clone, commit and push from the Linux environment.</Text>
        {!linuxInstalled ? <Text variant="small" tone="danger" marginTop="$2">Install Linux from the Linux tab first. Git runs there.</Text> : null}
        <Group title="GitHub account" footer={settings.githubLogin ? 'The token is encrypted on this phone and written to the git credential store inside Forge\'s private Linux environment.' : 'Create a fine-grained token with Contents: read and write. To create repositories from Forge, also allow Administration: read and write.'}>
          {settings.githubLogin ? (
            <>
              <Row icon={Github} title={settings.githubLogin} subtitle="Connected" />
              <Row icon={LogOut} title="Disconnect" destructive onPress={() => void run('connect', async () => { await disconnectGitHub(); return 'Disconnected from GitHub.'; })} />
            </>
          ) : (
            <YStack padding="$3" gap="$2">
              <Field value={token} onChangeText={setToken} placeholder="github_pat_…" secureTextEntry autoCapitalize="none" autoCorrect={false} />
              <XStack gap="$2">
                <Button title="Create a token" kind="secondary" compact style={{flex: 1}} onPress={() => void Linking.openURL('https://github.com/settings/personal-access-tokens/new')} />
                <Button title="Connect" compact style={{flex: 1}} loading={busy === 'connect'} disabled={!token.trim()} onPress={() => void run('connect', async () => { const login = await connectGitHub(token); setToken(''); const next = useSettings.getState(); setName(next.gitName); setEmail(next.gitEmail); return `Connected as ${login}.`; })} />
              </XStack>
            </YStack>
          )}
        </Group>
        <Group title="Publish a project" footer="Import a zip or pick a workspace folder. Forge adds a .gitignore if it is missing, suggests a description and topics, and creates a private or public repository.">
          <Row icon={UploadCloud} iconTone="accent" title="Push to GitHub" subtitle="Create a repository from your source code" chevron onPress={() => navigation.navigate('Publish')} />
        </Group>
        <Group title="Commit identity">
          <YStack padding="$3" gap="$2">
            <Field label="Name" value={name} onChangeText={setName} placeholder="Ada Lovelace" />
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="ada@example.com" autoCapitalize="none" keyboardType="email-address" />
            <Button title="Save" kind="secondary" compact loading={busy === 'identity'} onPress={() => void run('identity', async () => { settings.set({gitName: name.trim(), gitEmail: email.trim()}); await applyGitConfig(); return 'Saved. New commits use this name and email.'; })} />
          </YStack>
        </Group>
        <Group title="Clone a repository">
          <YStack padding="$3" gap="$2">
            <Field value={url} onChangeText={setUrl} placeholder="https://github.com/owner/repo" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            {busy === 'clone'
              ? <Button title="Cancel" kind="danger" compact onPress={() => controller.current?.abort()} />
              : <Button title="Clone into workspace" compact disabled={!url.trim() || !linuxInstalled} onPress={() => void run('clone', async () => {
                  setLog('');
                  controller.current = new AbortController();
                  const result = await cloneRepository(url, chunk => setLog(previous => (previous + chunk.replace(/\r/g, '\n')).slice(-6000)), controller.current.signal);
                  if (!result.ok) throw new Error('Clone failed. See the output below.');
                  return `Cloned into ${result.folder}. Open it in Files or set it as a chat's project folder.`;
                })} />}
            {log ? <Text variant="mono" selectable tone="muted" fontSize={11.5} backgroundColor="$code" borderRadius="$2" padding="$2" borderWidth={1} borderColor="$line">{log.trim()}</Text> : null}
          </YStack>
        </Group>
        {message ? <Text variant="small" tone={message.tone} marginTop="$3">{message.text}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
