import React, {useEffect, useRef, useState} from 'react';
import {ScrollView, TextInput} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {Box, CornerDownLeft, Globe, Square, Trash2, X} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {useProcs} from '../stores/procs';
import {useLinux} from '../stores/linux';
import {runInLinux, DEV_PACKAGES} from '../engine/linux';
import {useTheme} from '../theme/ThemeProvider';
import {fonts} from '../theme/tokens';
import {Button, Card, IconButton, IconTile, LargeTitle, Progress, Screen, Tag, Tap, Text} from '../ui';
import {nativeAvailable} from '../native';

const STAGES: Record<string, string> = {resolving: 'Finding the latest release', downloading: 'Downloading Alpine Linux', verifying: 'Verifying checksum', extracting: 'Unpacking files', configuring: 'Configuring', done: 'Ready'};
const QUICK = ['ls -la', 'apk update', `apk add ${DEV_PACKAGES}`, 'node -v && npm -v', 'python3 --version', 'df -h /', 'cat /etc/os-release'];
const MARK = '\u001fFORGE_PWD:';

function Setup() {
  const linux = useLinux();
  return (
    <Screen scroll>
      <LargeTitle title="Linux" subtitle="A real Alpine Linux shell, no root needed" />
      <Card padding="$5" marginTop="$4">
        <IconTile icon={Box} tone="accent" size={44} />
        <Text variant="title" textTransform="uppercase" letterSpacing={1} marginTop="$3">Install the Linux environment</Text>
        <Text variant="small" tone="muted" marginTop="$1.5">
          Forge downloads the official Alpine Linux root filesystem (about 4 MB), checks its SHA-256 signature and runs it with proot. You get apk, git, Node.js, Python and anything else from the Alpine repositories. The agent uses it to run code it writes.
        </Text>
        {linux.installing ? (
          <YStack marginTop="$4" gap="$1.5">
            <Text variant="hud" tone="accent">{STAGES[linux.stage ?? 'resolving']}</Text>
            <Progress value={linux.stage === 'done' ? 1 : linux.progress} />
            <Text variant="caption" tone="faint">{linux.detail || ' '}</Text>
          </YStack>
        ) : (
          <YStack marginTop="$4"><Button title={linux.error ? 'Try again' : 'Install Linux'} onPress={() => void linux.install()} disabled={!nativeAvailable || (linux.checked && !linux.runtime)} /></YStack>
        )}
        {linux.error ? <Text variant="small" tone="danger" marginTop="$3">{linux.error}</Text> : null}
        {!nativeAvailable ? <Text variant="caption" tone="faint" marginTop="$3">Linux runs in the Android app only.</Text> : linux.checked && !linux.runtime ? <Text variant="caption" tone="danger" marginTop="$3">This build has no Linux runtime for your processor.</Text> : null}
      </Card>
      <Text variant="caption" tone="faint" marginTop="$4">Runs inside the app sandbox without root. Some programs that need kernel features, like Docker, will not work.</Text>
    </Screen>
  );
}

export default function TerminalScreen() {
  const {colors} = useTheme();
  const installed = useLinux(state => state.installed);
  const release = useLinux(state => state.release);
  const [output, setOutput] = useState('');
  const [command, setCommand] = useState('');
  const [cwd, setCwd] = useState('/root/workspace');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const controller = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { if (installed && !output) setOutput(`Alpine Linux ${release ?? ''}\nWorkspace is mounted at /root/workspace.\n`); }, [installed, release, output]);
  if (!installed) return <Setup />;

  const run = async (text = command) => {
    const line = text.trim();
    if (!line || busy) return;
    if (line === 'clear') { setOutput(''); setCommand(''); return; }
    if (/&\s*$/.test(line) && !/&&\s*$/.test(line)) {
      const background = line.replace(/&\s*$/, '').trim();
      setCommand('');
      setHistory(previous => [line, ...previous.filter(item => item !== line)].slice(0, 30));
      setOutput(previous => previous + '\n' + cwd.replace('/root', '~') + '$ ' + line + '\n[started in the background, see below]\n');
      void useProcs.getState().start(background, cwd);
      return;
    }
    setCommand('');
    setHistory(previous => [line, ...previous.filter(item => item !== line)].slice(0, 30));
    setOutput(previous => `${previous}\n${cwd.replace('/root', '~')}$ ${line}\n`);
    setBusy(true);
    controller.current = new AbortController();
    let pending = '';
    try {
      const result = await runInLinux(`${line}\n__s=$?; printf '\\n\\037FORGE_PWD:%s' "$PWD"; exit $__s`, {
        cwd, timeoutMs: 30 * 60 * 1000, signal: controller.current.signal,
        onData: chunk => {
          pending += chunk;
          const cut = pending.lastIndexOf('\n');
          if (cut >= 0 && !pending.includes(MARK)) { const ready = pending.slice(0, cut + 1); pending = pending.slice(cut + 1); setOutput(previous => (previous + ready).slice(-60000)); }
        },
      });
      const markAt = result.output.lastIndexOf(MARK);
      if (markAt >= 0) setCwd(result.output.slice(markAt + MARK.length).trim() || cwd);
      const tail = pending.includes(MARK) ? pending.slice(0, pending.indexOf(MARK)).replace(/\n$/, '') : pending;
      setOutput(previous => (previous + tail + (result.exitCode !== 0 ? `\n[exit ${result.timedOut ? 'timeout' : result.exitCode}]` : '')).slice(-60000));
    } catch (error) {
      setOutput(previous => previous + `\n${error instanceof Error ? error.message : String(error)}\n`);
    } finally { setBusy(false); controller.current = null; }
  };

  return (
    <Screen padded={false}>
      <YStack flex={1}>
        <YStack paddingHorizontal="$4">
          <LargeTitle title="Linux" subtitle={`Alpine ${release ?? ''} · ${cwd.replace('/root', '~')}`} right={<IconButton icon={Trash2} label="Clear output" onPress={() => setOutput('')} />} />
        </YStack>
        <ScrollView ref={scroll} style={{flex: 1, marginHorizontal: 16, borderRadius: 2, borderWidth: 1, backgroundColor: colors.code, borderColor: colors.lineStrong}} contentContainerStyle={{padding: 14}} onContentSizeChange={() => scroll.current?.scrollToEnd({animated: false})}>
          <Text variant="mono" selectable fontSize={12.5} lineHeight={18}>{output}</Text>
        </ScrollView>
        <Background />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{flexGrow: 0}} contentContainerStyle={{gap: 6, paddingHorizontal: 16, paddingVertical: 10}}>
          {[...history.slice(0, 3), ...QUICK.filter(item => !history.slice(0, 3).includes(item))].map(item => (
            <Tap key={item} onPress={() => void run(item)} disabled={busy} paddingHorizontal="$2.5" height={32} borderRadius={2} justifyContent="center" backgroundColor="$accentSoft" borderWidth={1} borderColor="$accentLine" accessibilityRole="button">
              <Text variant="mono" tone="muted" fontSize={12} numberOfLines={1} maxWidth={220}>{item}</Text>
            </Tap>
          ))}
        </ScrollView>
        <XStack alignItems="center" gap="$2" marginHorizontal="$4" marginBottom="$2" paddingLeft="$3" borderRadius={2} borderWidth={1} borderColor="$lineStrong" backgroundColor="$sunken">
          <Text variant="mono" tone="accent" fontSize={14}>$</Text>
          <TextInput value={command} onChangeText={setCommand} onSubmitEditing={() => void run()} placeholder="Type a command" placeholderTextColor={colors.faint}
            autoCapitalize="none" autoCorrect={false} spellCheck={false} returnKeyType="send" blurOnSubmit={false} accessibilityLabel="Shell command"
            style={{flex: 1, fontFamily: fonts.mono, fontSize: 14, color: colors.text, paddingVertical: 10}} selectionColor={colors.accent} />
          {busy ? <IconButton icon={Square} label="Stop command" tone="danger" size={18} onPress={() => controller.current?.abort()} />
            : <IconButton icon={CornerDownLeft} label="Run" tone="accent" size={18} onPress={() => void run()} />}
        </XStack>
      </YStack>
    </Screen>
  );
}

function Background() {
  const navigation = useNavigation();
  const procs = useProcs(state => state.procs);
  if (!procs.length) return null;
  return (
    <YStack paddingHorizontal="$4" paddingTop="$2" gap="$1.5">
      {procs.map(proc => {
        const last = proc.output.trim().split('\n').pop() ?? '';
        return (
          <XStack key={proc.id} alignItems="center" gap="$2.5" paddingLeft="$3" paddingRight="$1" borderRadius={2} borderWidth={1} borderColor="$line" backgroundColor="$surface">
            <YStack width={8} height={8} backgroundColor={proc.running ? '$success' : '$faint'} />
            <YStack flex={1} paddingVertical="$2" gap={2}>
              <XStack alignItems="center" gap="$2">
                <Text variant="mono" fontSize={12.5} numberOfLines={1} flexShrink={1}>{proc.command}</Text>
                {proc.running && proc.port ? <Tag label={String(proc.port)} tone="success" /> : null}
              </XStack>
              <Text variant="caption" tone="faint" numberOfLines={1}>{proc.running ? (proc.port ? 'Listening on port ' + proc.port : last || 'Running') : 'Exited ' + (proc.exitCode ?? '')}</Text>
            </YStack>
            {proc.running && proc.port ? <IconButton icon={Globe} size={18} tone="accent" label={'Open port ' + proc.port} onPress={() => navigation.navigate('Preview', {uri: 'http://127.0.0.1:' + proc.port, title: 'localhost:' + proc.port})} /> : null}
            {proc.running
              ? <IconButton icon={Square} size={16} tone="danger" label="Stop process" onPress={() => void useProcs.getState().stop(proc.id)} />
              : <IconButton icon={X} size={16} tone="faint" label="Dismiss" onPress={() => useProcs.getState().clear(proc.id)} />}
          </XStack>
        );
      })}
    </YStack>
  );
}
