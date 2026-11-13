import React, {useEffect, useState} from 'react';
import {ScrollView} from 'react-native';
import {alert} from '../ui/dialog';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft, Check, Download, Trash2, X} from 'lucide-react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {LOCAL_MODELS, cancelModelDownload, downloadModel, modelPath, unloadModel} from '../engine/local';
import {useLibrary, type LocalModel} from '../stores/library';
import {useSettings} from '../stores/settings';
import {forgeNative, nativeAvailable} from '../native';
import {useTheme} from '../theme/ThemeProvider';
import {Button, Card, Field, Group, IconButton, NavHeader, Progress, Screen, Tag, Text} from '../ui';
import {formatBytes} from '../utils/format';

export default function LocalModelsScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {models, downloads, addModel, removeModel, setDownload} = useLibrary();
  const settings = useSettings();
  const [ram, setRam] = useState(0);
  const [free, setFree] = useState(0);
  const [customUrl, setCustomUrl] = useState('');
  useEffect(() => { forgeNative.storageInfo().then(info => { setRam(info.ramTotal); setFree(info.free); }).catch(() => undefined); }, []);

  const start = async (model: LocalModel) => {
    if (!nativeAvailable) { alert('Android only', 'On-device models run in the Android app.'); return; }
    if (free && model.size > free - 500e6) { alert('Not enough space', `This model needs ${formatBytes(model.size)} and only ${formatBytes(free)} is free.`); return; }
    setDownload(model.id, {progress: 0});
    try {
      await downloadModel(model, progress => setDownload(model.id, {progress}));
      addModel(model);
      setDownload(model.id, undefined);
      if (!settings.localModelId) settings.set({localModelId: model.id});
    } catch (error) {
      setDownload(model.id, {progress: 0, error: error instanceof Error ? error.message : String(error)});
    }
  };
  const remove = (model: LocalModel) => alert(`Delete ${model.name}?`, `Frees ${formatBytes(model.size)}.`, [
    {text: 'Cancel', style: 'cancel'},
    {text: 'Delete', style: 'destructive', onPress: async () => {
      await unloadModel();
      await forgeNative.remove(modelPath(model.file)).catch(() => undefined);
      removeModel(model.id);
      if (settings.localModelId === model.id) settings.set({localModelId: null});
    }},
  ]);
  const addCustom = () => {
    const url = customUrl.trim();
    if (!/^https:\/\/huggingface\.co\/.+\.gguf(\?.*)?$/i.test(url)) { alert('Use a Hugging Face GGUF link', 'For example https://huggingface.co/org/repo/resolve/main/model-Q4_K_M.gguf'); return; }
    const file = decodeURIComponent(url.split('?')[0].split('/').pop()!);
    setCustomUrl('');
    void start({id: `custom-${file}`, name: file.replace(/\.gguf$/i, ''), file, size: 0, url, custom: true});
  };
  const catalog: LocalModel[] = [...LOCAL_MODELS.map(model => ({id: model.id, name: model.name, file: model.file, size: model.size, url: model.url, sha256: model.sha256})), ...models.filter(model => model.custom)];

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="On-device models" backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, paddingBottom: 48}}>
        <Text variant="small" tone="muted">These run entirely on your phone with llama.cpp. Nothing you type leaves the device. They are slower and less capable than cloud models. Turn on tools in Settings to let models that support tool calling work with files and Linux.</Text>
        {ram ? <Text variant="caption" tone="faint" marginTop="$2">This phone: {formatBytes(ram)} memory, {formatBytes(free)} free storage.</Text> : null}
        <YStack gap="$2.5" marginTop="$4">
          {catalog.map(model => {
            const def = LOCAL_MODELS.find(item => item.id === model.id);
            const installed = models.some(item => item.id === model.id);
            const download = downloads[model.id];
            const active = settings.localModelId === model.id;
            const tooBig = def && ram && ram < def.minRamGb * 0.9e9;
            return (
              <Card key={model.id} padding="$3.5" borderColor={active ? '$accent' : '$line'}>
                <XStack alignItems="center" gap="$2">
                  <YStack flex={1}>
                    <Text variant="bodyMedium">{model.name}</Text>
                    <Text variant="caption" tone="muted">{model.size ? formatBytes(model.size) : 'Custom'}{def ? ` · needs ${def.minRamGb} GB memory` : ''}</Text>
                  </YStack>
                  {installed ? (
                    <>
                      {active ? <Tag label="In use" tone="accent" /> : <Button title="Use" compact kind="secondary" onPress={() => settings.set({localModelId: model.id, activeProvider: 'ondevice'})} />}
                      <IconButton icon={Trash2} label={`Delete ${model.name}`} tone="faint" size={18} onPress={() => remove(model)} />
                    </>
                  ) : download && !download.error ? (
                    <IconButton icon={X} label="Cancel download" onPress={() => { void cancelModelDownload(model.id); setDownload(model.id, undefined); }} />
                  ) : (
                    <IconButton icon={Download} label={`Download ${model.name}`} tone="accent" onPress={() => void start(model)} />
                  )}
                </XStack>
                {def ? <Text variant="small" tone="muted" marginTop="$1.5">{def.note}{tooBig ? ' May be too large for this phone.' : ''}</Text> : null}
                {download && !download.error ? <YStack marginTop="$2" gap="$1"><Progress value={download.progress} /><Text variant="caption" tone="faint">{Math.round(download.progress * 100)}%</Text></YStack> : null}
                {download?.error ? <Text variant="caption" tone="danger" marginTop="$1.5">{download.error}</Text> : null}
                {installed && active ? <XStack alignItems="center" gap="$1" marginTop="$1.5"><Check size={14} color={colors.success} /><Text variant="caption" tone="success">Selected for “On this phone”</Text></XStack> : null}
              </Card>
            );
          })}
        </YStack>
        <Group title="Add any GGUF model">
          <YStack padding="$3.5" paddingTop={0}>
            <Field value={customUrl} onChangeText={setCustomUrl} placeholder="https://huggingface.co/…/model.gguf" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <Button title="Download" kind="secondary" compact onPress={addCustom} style={{marginTop: 8}} disabled={!customUrl.trim()} />
          </YStack>
        </Group>
      </ScrollView>
    </Screen>
  );
}
