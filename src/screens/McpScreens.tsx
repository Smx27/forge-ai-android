import React, {useState} from 'react';
import {ScrollView} from 'react-native';
import {YStack} from '@tamagui/stacks';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft, RefreshCw, Trash2, X} from 'lucide-react-native';
import type {RootStackParamList} from '../navigation/types';
import {useLibrary} from '../stores/library';
import {newId} from '../stores/chats';
import {forgeNative} from '../native';
import {resetMcpSession} from '../engine/mcp';
import {connectServer} from './StoreScreen';
import {Button, Field, Group, IconButton, NavHeader, Row, Screen, Text} from '../ui';

export function McpAddScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const save = async () => {
    if (!/^https:\/\/[^\s/]+/.test(url.trim())) { setError('Use an https:// URL for a Streamable HTTP MCP server.'); return; }
    const id = newId();
    if (token.trim()) await forgeNative.secureSet(`mcp.${id}`, token.trim());
    useLibrary.getState().upsertServer({id, name: (name.trim() || new URL(url.trim()).hostname.split('.')[0]).replace(/\s+/g, ''), url: url.trim(), enabled: true, hasToken: !!token.trim()});
    void connectServer(id);
    navigation.goBack();
  };
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Add connector" backIcon={X} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, paddingBottom: 40}}>
        <Text variant="small" tone="muted">Forge connects to remote MCP servers over Streamable HTTP. Local command-line servers can run inside the Linux tab behind an HTTP adapter.</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="github" autoCapitalize="none" />
        <Field label="Server URL" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Field label="Access token (optional)" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" hint="Sent as a Bearer token. Stored encrypted on this device." />
        {error ? <Text variant="small" tone="danger" marginTop="$3">{error}</Text> : null}
        <Button title="Connect" onPress={save} style={{marginTop: 32}} />
      </ScrollView>
    </Screen>
  );
}

export function McpDetailScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'McpDetail'>>();
  const server = useLibrary(state => state.servers.find(item => item.id === params.serverId));
  const [token, setToken] = useState('');
  if (!server) return null;
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title={server.name} backIcon={ArrowLeft} onBack={() => navigation.goBack()} right={<IconButton icon={RefreshCw} label="Reconnect" onPress={() => { resetMcpSession(server.url); void connectServer(server.id); }} />} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, paddingBottom: 48}}>
        <Text variant="small" tone="muted" selectable>{server.url}</Text>
        <Text variant="small" tone={server.status === 'error' ? 'danger' : server.status === 'ready' ? 'success' : 'muted'} marginTop="$1.5">
          {server.status === 'ready' ? 'Connected' : server.status === 'connecting' ? 'Connecting…' : server.status === 'error' ? server.error : 'Not connected'}
        </Text>
        {server.tools.length ? (
          <Group title={`${server.tools.length} tools`}>
            {server.tools.map(tool => <Row key={tool.name} title={tool.name} subtitle={tool.description} numberOfLines={3} />)}
          </Group>
        ) : null}
        <Group title="Access token">
          <YStack padding="$3" paddingTop={0}>
            <Field value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" placeholder={server.hasToken ? 'Saved. Paste to replace' : 'Optional bearer token'} />
            <Button title="Save token" kind="secondary" compact style={{marginTop: 8}} disabled={!token.trim()} onPress={async () => {
              await forgeNative.secureSet(`mcp.${server.id}`, token.trim()); setToken('');
              useLibrary.getState().patchServer(server.id, {hasToken: true}); resetMcpSession(server.url); void connectServer(server.id);
            }} />
          </YStack>
        </Group>
        <Button title="Remove connector" kind="danger" icon={Trash2} style={{marginTop: 32}} onPress={() => { useLibrary.getState().removeServer(server.id); navigation.goBack(); }} />
      </ScrollView>
    </Screen>
  );
}
