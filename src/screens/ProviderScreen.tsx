import React, {useMemo, useState} from 'react';
import {Linking, ScrollView} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft, Check, ExternalLink, ListFilter, Plug} from 'lucide-react-native';
import {XStack} from '@tamagui/stacks';
import type {RootStackParamList} from '../navigation/types';
import {listModels, providerById, testConnection, type ModelInfo} from '../engine/providers';
import {useSettings, providerKey} from '../stores/settings';
import {useTheme} from '../theme/ThemeProvider';
import {Button, Field, Group, NavHeader, Row, Screen, Tag, Text} from '../ui';

export default function ProviderScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'Provider'>>();
  const {colors} = useTheme();
  const provider = providerById(params.providerId);
  const settings = useSettings();
  const config = settings.providers[provider.id];
  const [key, setKey] = useState('');
  const [model, setModel] = useState(config?.model ?? provider.defaultModel);
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? provider.baseUrl);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<'models' | 'test' | null>(null);
  const [message, setMessage] = useState<{tone: 'success' | 'danger'; text: string} | null>(null);
  const shown = useMemo(() => (models ?? []).filter(item => !filter || item.id.toLowerCase().includes(filter.toLowerCase()) || item.label.toLowerCase().includes(filter.toLowerCase())).slice(0, 80), [models, filter]);

  const persist = async () => {
    if (key.trim()) { await settings.saveKey(provider.id, key); setKey(''); }
    settings.updateProvider(provider.id, {model: model.trim(), baseUrl: baseUrl.trim()});
  };
  const currentKey = async () => key.trim() || (await providerKey(provider.id)) || undefined;
  const browse = async () => {
    setBusy('models'); setMessage(null);
    try { setModels(await listModels(provider.id, baseUrl, await currentKey())); }
    catch (error) { setMessage({tone: 'danger', text: error instanceof Error ? error.message : String(error)}); }
    finally { setBusy(null); }
  };
  const test = async () => {
    setBusy('test'); setMessage(null);
    try { await persist(); const reply = await testConnection(provider.id, baseUrl, model, await currentKey()); setMessage({tone: 'success', text: `Connected. The model replied: “${reply}”`}); }
    catch (error) { setMessage({tone: 'danger', text: error instanceof Error ? error.message : String(error)}); }
    finally { setBusy(null); }
  };
  const use = async () => {
    await persist();
    settings.set({activeProvider: provider.id});
    navigation.goBack();
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title={provider.name} backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, paddingBottom: 48}}>
        <Text variant="small" tone="muted">{provider.blurb}.</Text>
        {provider.keyUrl ? <Button title="Get a free API key" kind="ghost" icon={ExternalLink} compact style={{alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 4}} onPress={() => Linking.openURL(provider.keyUrl!)} /> : null}
        {provider.needsKey ? (
          <Field label="API key" value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false}
            placeholder={config?.hasKey ? 'Saved. Paste a new key to replace it' : 'Paste your key'}
            hint={config?.hasKey ? 'A key is saved and encrypted on this device.' : 'Stored encrypted with Android Keystore. Never leaves the device except to call this provider.'} />
        ) : null}
        {provider.editableUrl ? <Field label="Server URL" value={baseUrl} onChangeText={setBaseUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
          hint={provider.id === 'ollama' ? 'Runs on this phone, for example Ollama inside the Linux tab: apk add ollama, then ollama serve.' : 'Must speak the OpenAI chat completions format over HTTPS.'} /> : null}
        <Field label="Model" value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} placeholder="model id" />
        <XStack gap="$2" marginTop="$3">
          <Button title="Browse models" kind="secondary" icon={ListFilter} compact loading={busy === 'models'} onPress={browse} style={{flex: 1}} />
          <Button title="Test" kind="secondary" icon={Plug} compact loading={busy === 'test'} onPress={test} style={{flex: 1}} />
        </XStack>
        {message ? <Text variant="small" tone={message.tone} marginTop="$3" padding="$3" borderRadius="$2" backgroundColor={message.tone === 'danger' ? '$dangerSoft' : '$successSoft'}>{message.text}</Text> : null}
        {models ? (
          <>
            <Field value={filter} onChangeText={setFilter} placeholder={`Filter ${models.length} models`} autoCapitalize="none" />
            <Group>
              {shown.map(item => (
                <Row key={item.id} title={item.label} subtitle={item.label !== item.id ? item.id : item.context ? `${Math.round(item.context / 1000)}k context` : undefined}
                  onPress={() => setModel(item.id)}
                  right={<XStack alignItems="center" gap="$2">
                    {provider.id === 'openrouter' && item.free ? <Tag label="Free" tone="accent" /> : null}
                    {item.id === model ? <Check size={18} color={colors.accent} /> : null}
                  </XStack>} />
              ))}
            </Group>
          </>
        ) : null}
        <Button title={`Use ${provider.name}`} onPress={use} style={{marginTop: 24}} disabled={provider.needsKey && !config?.hasKey && !key.trim()} />
        {config?.hasKey ? <Button title="Remove saved key" kind="danger" compact onPress={() => void settings.removeKey(provider.id)} style={{marginTop: 12}} /> : null}
      </ScrollView>
    </Screen>
  );
}
