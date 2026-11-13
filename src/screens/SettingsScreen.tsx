import React, {useEffect, useState} from 'react';
import {alert} from '../ui/dialog';
import {Linking} from 'react-native';
import {YStack} from '@tamagui/stacks';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {usePrompts} from '../stores/prompts';
import {ArchiveRestore, Zap, Brain, ChartColumn, Cpu, FileText, Bell, Github, Globe, HardDrive, Info, KeyRound, Scale, Shield, Sparkles, SquareTerminal, Trash2, TriangleAlert, Wrench} from 'lucide-react-native';
import {useProcs} from '../stores/procs';
import {useSettings, activeModelLabel, type ApprovalMode} from '../stores/settings';
import {useChats} from '../stores/chats';
import {useLibrary} from '../stores/library';
import {useLinux} from '../stores/linux';
import {providerById} from '../engine/providers';
import {forgeNative} from '../native';
import {kv} from '../stores/storage';
import {Group, LargeTitle, Row, Screen, Segmented, Text, Toggle} from '../ui';
import {formatBytes} from '../utils/format';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const settings = useSettings();
  const memoryCount = useLibrary(state => state.memory.length);
  const modelCount = useLibrary(state => state.models.length);
  const promptCount = usePrompts(state => state.prompts.length);
  const linux = useLinux();
  const [usage, setUsage] = useState<{workspace: number; models: number; linux: number; free: number} | null>(null);
  const measure = async () => {
    try {
      const [workspace, models, linuxSize, info] = await Promise.all([forgeNative.dirSize(forgeNative.workspaceDir), forgeNative.dirSize(forgeNative.modelsDir), forgeNative.dirSize(forgeNative.rootfsDir), forgeNative.storageInfo()]);
      setUsage({workspace, models, linux: linuxSize, free: info.free});
    } catch {}
  };
  useFocusEffect(React.useCallback(() => { void measure(); }, []));
  useEffect(() => { void linux.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearChats = () => alert('Delete all chats?', 'Files in your workspace are kept.', [
    {text: 'Cancel', style: 'cancel'},
    {text: 'Delete', style: 'destructive', onPress: () => useChats.getState().clearAll()},
  ]);
  const eraseEverything = () => alert('Erase all data?', 'Removes chats, keys, skills, connectors, memory, downloaded models, the Linux environment and workspace files. This cannot be undone.', [
    {text: 'Cancel', style: 'cancel'},
    {text: 'Erase', style: 'destructive', onPress: async () => {
      await useProcs.getState().stopAll();
      await Promise.allSettled([forgeNative.remove(forgeNative.filesDir + '/checkpoints'), forgeNative.remove(forgeNative.filesDir + '/attachments'), forgeNative.secureClear(), forgeNative.remove(forgeNative.workspaceDir), forgeNative.remove(forgeNative.modelsDir), forgeNative.remove(`${forgeNative.filesDir}/linux`), forgeNative.remove(`${forgeNative.filesDir}/skills`)]);
      kv.clearAll();
      useChats.getState().clearAll();
      useLibrary.setState({skills: [], servers: [], memory: [], models: [], downloads: {}});
      useSettings.setState({onboarded: false, providers: Object.fromEntries(Object.entries(useSettings.getState().providers).map(([id, value]) => [id, {...value, hasKey: false}])), localModelId: null});
      await useLinux.getState().refresh();
    }},
  ]);

  return (
    <Screen scroll>
      <LargeTitle title="Settings" />
      <Group title="Models">
        <Row icon={Sparkles} iconTone="accent" title="Active model" value={`${providerById(settings.activeProvider).name}`} subtitle={activeModelLabel(settings)} chevron onPress={() => navigation.navigate('ModelPicker')} />
        <Row icon={KeyRound} iconTone="accent" title="Providers and API keys" subtitle="OpenRouter, Gemini, NVIDIA, Groq and more" chevron onPress={() => navigation.navigate('ModelPicker')} />
        <Row icon={Cpu} iconTone="accent" title="On-device models" value={modelCount ? `${modelCount} installed` : undefined} chevron onPress={() => navigation.navigate('LocalModels')} />
        <Row icon={Wrench} iconTone="accent" title="Let on-device models use tools" subtitle="Files and Linux, for models that support tool calling" right={<Toggle label="On-device tools" value={settings.localTools} onChange={localTools => settings.set({localTools})} />} />
        <Row icon={ChartColumn} iconTone="accent" title="Usage and limits" subtitle={settings.dailyBudget ? `Daily budget ${settings.dailyBudget.toLocaleString()} tokens` : 'Tokens, latency, budget and fallback'} chevron onPress={() => navigation.navigate('Usage')} />
        <Row icon={Zap} iconTone="accent" title="Saved prompts" subtitle="Slash commands for prompts you reuse" value={String(promptCount)} chevron onPress={() => navigation.navigate('Prompts')} />
      </Group>
      <Group title="Agent permissions" footer={settings.approvalMode === 'ask' ? 'Forge asks before changing files or running commands.' : settings.approvalMode === 'edits' ? 'File changes in the workspace happen automatically. Forge asks before running commands.' : 'Forge acts without asking. Use only with models and prompts you trust.'}>
        <YStack padding="$3">
          <Segmented<ApprovalMode> value={settings.approvalMode} onChange={approvalMode => settings.set({approvalMode})}
            options={[{value: 'ask', label: 'Ask first'}, {value: 'edits', label: 'Auto edits'}, {value: 'auto', label: 'Full auto'}]} />
        </YStack>
        <Row icon={Globe} iconTone="info" title="Web search and browsing" right={<Toggle label="Web tools" value={settings.webTools} onChange={webTools => settings.set({webTools})} />} />
        <Row icon={Brain} iconTone="info" title="Long-term memory" right={<Toggle label="Memory" value={settings.memoryEnabled} onChange={memoryEnabled => settings.set({memoryEnabled})} />} />
        <Row icon={Bell} iconTone="info" title="Notify when a task finishes" subtitle="While Forge is in the background" right={<Toggle label="Finish notifications" value={settings.notifyWhenDone} onChange={notifyWhenDone => settings.set({notifyWhenDone})} />} />
      </Group>
      <Group title="Personalization">
        <Row icon={FileText} iconTone="info" title="Custom instructions" subtitle={settings.systemPrompt ? settings.systemPrompt.slice(0, 60) : 'Tell Forge how to respond'} chevron onPress={() => navigation.navigate('Personalize')} />
        <Row icon={Brain} iconTone="info" title="Memory" value={`${memoryCount}`} chevron onPress={() => navigation.navigate('Memory')} />
      </Group>
      <Group title="Appearance">
        <YStack padding="$3">
          <Segmented value={settings.theme} onChange={theme => settings.set({theme})} options={[{value: 'system', label: 'System'}, {value: 'dark', label: 'Dark'}, {value: 'light', label: 'Light'}]} />
        </YStack>
      </Group>
      <Group title="Linux environment">
        <Row icon={Github} iconTone="violet" title="Git and GitHub" subtitle={settings.githubLogin ? 'Connected as ' + settings.githubLogin : 'Clone, commit and push'} chevron onPress={() => navigation.navigate('Git')} />
        <Row icon={SquareTerminal} iconTone="violet" title={linux.installed ? `Alpine Linux ${linux.release ?? ''}` : 'Not installed'} subtitle={usage ? `Uses ${formatBytes(usage.linux)}` : undefined} />
        {linux.installed ? <Row icon={Trash2} title="Remove Linux environment" destructive onPress={() => alert('Remove Linux?', 'Installed packages are deleted. Workspace files are kept.', [{text: 'Cancel', style: 'cancel'}, {text: 'Remove', style: 'destructive', onPress: () => void linux.uninstall().then(measure)}])} /> : null}
      </Group>
      <Group title="Storage">
        <Row icon={ArchiveRestore} iconTone="violet" title="Backup and restore" subtitle="Encrypted file with chats, memory and settings" chevron onPress={() => navigation.navigate('Backup')} />
        <Row icon={HardDrive} iconTone="violet" title="Workspace files" value={usage ? formatBytes(usage.workspace) : '…'} />
        <Row icon={Cpu} iconTone="violet" title="Models" value={usage ? formatBytes(usage.models) : '…'} />
        <Row icon={HardDrive} iconTone="violet" title="Free on device" value={usage ? formatBytes(usage.free) : '…'} />
        <Row icon={Trash2} title="Delete all chats" destructive onPress={clearChats} />
        <Row icon={TriangleAlert} title="Erase all data" destructive onPress={eraseEverything} />
      </Group>
      <Group title="About">
        <Row icon={Shield} iconTone="success" title="Privacy policy" chevron onPress={() => navigation.navigate('Legal', {doc: 'privacy'})} />
        <Row icon={Scale} iconTone="success" title="Terms of use" chevron onPress={() => navigation.navigate('Legal', {doc: 'terms'})} />
        <Row icon={FileText} title="Open-source licenses" chevron onPress={() => navigation.navigate('Licenses')} />
        <Row icon={Info} title="Version" value={`${forgeNative.appVersion}`} />
      </Group>
      <Text variant="caption" tone="faint" marginTop="$5" textAlign="center" onPress={() => Linking.openURL('mailto:support@forge.app')}>Forge {forgeNative.appVersion} · {forgeNative.device}</Text>
    </Screen>
  );
}
