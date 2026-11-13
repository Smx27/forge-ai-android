import React from 'react';
import {ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Check, Cloud, Cpu, Globe, KeyRound, Server, X} from 'lucide-react-native';
import {XStack} from '@tamagui/stacks';
import {PROVIDERS} from '../engine/providers';
import {useSettings} from '../stores/settings';
import {useLibrary} from '../stores/library';
import {useTheme} from '../theme/ThemeProvider';
import {Group, NavHeader, Row, Screen, Tag, Text} from '../ui';

export default function ModelPickerScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const settings = useSettings();
  const models = useLibrary(state => state.models);
  const choose = (id: string) => { settings.set({activeProvider: id}); navigation.goBack(); };
  const ready = (id: string) => {
    const provider = PROVIDERS.find(item => item.id === id)!;
    if (provider.kind === 'device') return !!settings.localModelId && models.some(model => model.id === settings.localModelId);
    return !provider.needsKey || settings.providers[id]?.hasKey;
  };
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Choose a model" backIcon={X} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{padding: 16, paddingTop: 0, paddingBottom: 48}}>
        <Group title="Ready to use" footer="Tap a provider to switch. Use the key icon to set a key or a different model.">
          {PROVIDERS.filter(provider => ready(provider.id)).map(provider => (
            <Row key={provider.id} icon={provider.kind === 'device' ? Cpu : provider.id === 'ollama' ? Server : provider.id === 'custom' ? Globe : Cloud}
              title={provider.name}
              subtitle={provider.kind === 'device' ? models.find(model => model.id === settings.localModelId)?.name : settings.providers[provider.id]?.model}
              onPress={() => choose(provider.id)}
              right={<XStack alignItems="center" gap="$2.5">
                {settings.activeProvider === provider.id ? <Check size={18} color={colors.accent} /> : null}
                <KeyRound size={17} color={colors.faint} onPress={() => provider.kind === 'device' ? navigation.navigate('LocalModels') : navigation.navigate('Provider', {providerId: provider.id})} />
              </XStack>} />
          ))}
        </Group>
        {PROVIDERS.some(provider => !ready(provider.id)) ? (
          <Group title="Set up">
            {PROVIDERS.filter(provider => !ready(provider.id)).map(provider => (
              <Row key={provider.id} title={provider.name} subtitle={provider.blurb} chevron
                right={provider.free ? <Tag label="Free" tone="accent" /> : null}
                onPress={() => provider.kind === 'device' ? navigation.navigate('LocalModels') : navigation.navigate('Provider', {providerId: provider.id})} />
            ))}
          </Group>
        ) : null}
        <Text variant="caption" tone="faint" marginTop="$4" marginHorizontal="$1">Keys are stored with Android Keystore encryption and are only sent to the provider you pick.</Text>
      </ScrollView>
    </Screen>
  );
}
