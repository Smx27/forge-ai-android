import React, {useMemo, useState} from 'react';
import {ScrollView} from 'react-native';
import {YStack} from '@tamagui/stacks';
import {alert} from '../ui/dialog';
import {useNavigation} from '@react-navigation/native';
import {Check, Download, Plug, Plus, Sparkles} from 'lucide-react-native';
import {SKILL_CATALOG, installSkill, parseGitHubUrl, type CatalogSkill} from '../engine/skills';
import {MCP_CATALOG, mcpListTools} from '../engine/mcp';
import {useLibrary} from '../stores/library';
import {useTheme} from '../theme/ThemeProvider';
import {Button, Field, Group, IconButton, LargeTitle, Row, Screen, Segmented, Text, Toggle} from '../ui';
import {newId} from '../stores/chats';
import {forgeNative} from '../native';

const CATEGORIES = ['Design', 'Engineering', 'Documents', 'Workflow'] as const;

export async function connectServer(id: string) {
  const library = useLibrary.getState();
  const server = library.servers.find(item => item.id === id);
  if (!server) return;
  library.patchServer(id, {status: 'connecting', error: undefined});
  try {
    const token = server.hasToken ? await forgeNative.secureGet(`mcp.${id}`) : null;
    const tools = await mcpListTools(server.url, token);
    useLibrary.getState().patchServer(id, {status: 'ready', tools});
  } catch (error) {
    useLibrary.getState().patchServer(id, {status: 'error', error: error instanceof Error ? error.message : String(error)});
  }
}

function SkillsTab() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {skills, addSkill, toggleSkill} = useLibrary();
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const installed = useMemo(() => new Set(skills.map(skill => skill.source.replace(/\/$/, ''))), [skills]);
  const isInstalled = (item: CatalogSkill) => [...installed].some(source => source.includes(item.repo) && source.endsWith(item.path));
  const install = async (key: string, source: {repo: string; ref?: string; path: string}) => {
    setBusy(key);
    try { addSkill(await installSkill(source)); }
    catch (error) { alert('Could not install', error instanceof Error ? error.message : String(error)); }
    finally { setBusy(null); }
  };
  return (
    <>
      {skills.length ? (
        <Group title="Installed" footer="Enabled skills are offered to the agent, which loads one when a task matches it.">
          {skills.map(skill => (
            <Row key={skill.slug} icon={Sparkles} iconTone="accent" title={skill.name} subtitle={skill.description} numberOfLines={1} onPress={() => navigation.navigate('SkillDetail', {slug: skill.slug})}
              right={<Toggle label={`Enable ${skill.name}`} value={skill.enabled} onChange={() => toggleSkill(skill.slug)} />} />
          ))}
        </Group>
      ) : (
        <Text variant="small" tone="muted" marginTop="$5">Skills are instruction packs that teach the agent a craft, from design taste to PDF handling. They are open source and download from GitHub.</Text>
      )}
      {CATEGORIES.map(category => (
        <Group key={category} title={category}>
          {SKILL_CATALOG.filter(item => item.category === category).map(item => {
            const done = isInstalled(item);
            return (
              <Row key={item.id} icon={Sparkles} iconTone="violet" title={item.name} subtitle={`${item.description}\nby ${item.author}`} numberOfLines={3}
                right={done ? <Check size={18} color={colors.success} /> : <IconButton icon={Download} tone="accent" size={19} label={`Install ${item.name}`} disabled={!!busy} onPress={() => void install(item.id, {repo: item.repo, path: item.path})} />} />
            );
          })}
        </Group>
      ))}
      {busy ? <Text variant="caption" tone="accent" marginTop="$3">Installing…</Text> : null}
      <Group title="Install from GitHub">
        <YStack padding="$3" paddingTop={0}>
          <Field value={url} onChangeText={setUrl} placeholder="https://github.com/owner/repo/tree/main/skills/name" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Button title="Install skill" kind="secondary" compact style={{marginTop: 8}} loading={busy === 'url'} disabled={!url.trim() || !!busy}
            onPress={() => { try { const source = parseGitHubUrl(url); void install('url', source).then(() => setUrl('')); } catch (error) { alert('Check the link', (error as Error).message); } }} />
        </YStack>
      </Group>
    </>
  );
}

function ConnectorsTab() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {servers, upsertServer, patchServer} = useLibrary();
  const add = (item: (typeof MCP_CATALOG)[number]) => {
    const id = newId();
    upsertServer({id, name: item.name.replace(/\s+/g, ''), url: item.url, enabled: true});
    void connectServer(id);
  };
  return (
    <>
      {servers.length ? (
        <Group title="Connected" footer="Tools from enabled connectors are available to the agent in every chat.">
          {servers.map(server => (
            <Row key={server.id} icon={Plug} iconTone="info" title={server.name}
              subtitle={server.status === 'ready' ? `${server.tools.length} tools` : server.status === 'connecting' ? 'Connecting…' : server.status === 'error' ? server.error : 'Not connected'}
              numberOfLines={1} onPress={() => navigation.navigate('McpDetail', {serverId: server.id})}
              right={<Toggle label={`Enable ${server.name}`} value={server.enabled} onChange={value => { patchServer(server.id, {enabled: value}); if (value && server.status !== 'ready') void connectServer(server.id); }} />} />
          ))}
        </Group>
      ) : (
        <Text variant="small" tone="muted" marginTop="$5">Connectors use the Model Context Protocol to give the agent new tools: documentation lookup, code search, model hubs and more.</Text>
      )}
      <Group title="Popular connectors">
        {MCP_CATALOG.map(item => {
          const added = servers.some(server => server.url === item.url);
          return <Row key={item.id} icon={Plug} iconTone="info" title={item.name} subtitle={item.description}
            right={added ? <Check size={18} color={colors.success} /> : <IconButton icon={Plus} tone="accent" label={`Add ${item.name}`} onPress={() => add(item)} />} />;
        })}
      </Group>
      <Button title="Add a custom connector" kind="secondary" icon={Plus} style={{marginTop: 20}} onPress={() => navigation.navigate('McpAdd')} />
    </>
  );
}

export default function StoreScreen() {
  const [tab, setTab] = useState<'skills' | 'connectors'>('skills');
  const skillCount = useLibrary(state => state.skills.length);
  const serverCount = useLibrary(state => state.servers.length);
  return (
    <Screen padded={false}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 48}} stickyHeaderIndices={[1]}>
        <LargeTitle title="Store" subtitle="Skills and connectors for your agent" />
        <YStack paddingVertical="$2" backgroundColor="$bg">
          <Segmented value={tab} onChange={setTab} options={[{value: 'skills', label: skillCount ? `Skills (${skillCount})` : 'Skills'}, {value: 'connectors', label: serverCount ? `Connectors (${serverCount})` : 'Connectors'}]} />
        </YStack>
        {tab === 'skills' ? <SkillsTab /> : <ConnectorsTab />}
      </ScrollView>
    </Screen>
  );
}
