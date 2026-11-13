import React, {useState} from 'react';
import {Linking, ScrollView} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Box, Check, Cpu, ExternalLink, Hammer} from 'lucide-react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {PROVIDERS, providerById, testConnection} from '../engine/providers';
import {useSettings} from '../stores/settings';
import {useLinux} from '../stores/linux';
import {nativeAvailable} from '../native';
import {useTheme} from '../theme/ThemeProvider';
import {Button, Card, Corners, Field, IconTile, Progress, Text, useKeyboardInset} from '../ui';

const PICKS = ['openrouter', 'gemini', 'groq', 'nvidia'];

function Dots({step}: {step: number}) {
  return (
    <XStack gap="$1.5" accessibilityLabel={`Step ${step + 1} of 3`}>
      {[0, 1, 2].map(index => <YStack key={index} width={index === step ? 22 : 6} height={4} backgroundColor={index === step ? '$accent' : '$lineStrong'} />)}
    </XStack>
  );
}

function Mark({icon: Icon, size}: {icon: typeof Hammer; size: number}) {
  const {colors} = useTheme();
  return (
    <YStack width={64} height={64} borderRadius={2} alignItems="center" justifyContent="center" backgroundColor="$accentSoft" borderWidth={1} borderColor="$accentLine">
      <Icon size={size} color={colors.accent} strokeWidth={1.5} />
      <Corners color={colors.accent} size={10} />
    </YStack>
  );
}

export default function OnboardingScreen() {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const settings = useSettings();
  const linux = useLinux();
  const [step, setStep] = useState(0);
  const [providerId, setProviderId] = useState('openrouter');
  const [key, setKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const provider = providerById(providerId);
  const finish = () => settings.set({onboarded: true});

  const connect = async () => {
    setChecking(true); setError('');
    try {
      const config = settings.providers[providerId];
      await testConnection(providerId, config.baseUrl, config.model, key.trim());
      await settings.saveKey(providerId, key);
      settings.set({activeProvider: providerId});
      setStep(2);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally { setChecking(false); }
  };

  return (
    <YStack ref={keyboard.ref as never} onLayout={keyboard.onLayout} flex={1} backgroundColor="$bg" paddingTop={insets.top + 16} paddingBottom={Math.max(insets.bottom + 12, keyboard.inset)}>
      <XStack paddingHorizontal="$5" justifyContent="space-between" alignItems="center" minHeight={24}>
        <Dots step={step} />
        {step > 0 ? <Text variant="smallMedium" tone="muted" onPress={step === 1 ? () => setStep(2) : finish} accessibilityRole="button">Skip</Text> : null}
      </XStack>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{flexGrow: 1, paddingHorizontal: 20, paddingTop: 32}}>
        {step === 0 ? (
          <YStack flex={1}>
            <Mark icon={Hammer} size={30} />
            <Text variant="display" marginTop="$6" fontSize={27} lineHeight={36}>Build with AI,{'\n'}wherever you are.</Text>
            <Text tone="muted" marginTop="$4">Forge is an AI engineer that lives on your phone. It writes and edits real files, runs them in a real Linux shell, searches the web and learns new skills.</Text>
            <Card marginTop="$6" gap="$3.5">
              {['Free models from OpenRouter, Gemini, Groq, NVIDIA and more', 'Private on-device models that work offline', 'Your keys and files never leave the phone unless you ask'].map(line => (
                <XStack key={line} gap="$3" alignItems="flex-start">
                  <YStack width={22} height={22} borderRadius={2} borderWidth={1} borderColor="$accentLine" backgroundColor="$accentSoft" alignItems="center" justifyContent="center" marginTop={1}><Check size={13} color={colors.accent} strokeWidth={2.4} /></YStack>
                  <Text variant="small" flex={1}>{line}</Text>
                </XStack>
              ))}
            </Card>
          </YStack>
        ) : step === 1 ? (
          <YStack>
            <Text variant="title">Connect a model</Text>
            <Text variant="small" tone="muted" marginTop="$1.5">Pick a free provider and paste a key. It takes a minute and you can add more later.</Text>
            <XStack flexWrap="wrap" gap="$2.5" marginTop="$4">
              {PICKS.map(id => {
                const item = providerById(id);
                const active = id === providerId;
                return (
                  <Card key={id} pressable flexBasis="47%" flexGrow={1} minHeight={84} padding="$3.5" borderColor={active ? '$accent' : '$line'} backgroundColor={active ? '$accentSoft' : '$surface'}
                    onPress={() => { setProviderId(id); setError(''); }} accessibilityRole="radio" accessibilityState={{selected: active}}>
                    <Text variant="smallMedium">{item.name}</Text>
                    <Text variant="caption" tone="muted" marginTop="$0.5">{item.blurb}</Text>
                  </Card>
                );
              })}
            </XStack>
            <Button title={`Get a free ${provider.name} key`} kind="ghost" icon={ExternalLink} compact style={{alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 8}} onPress={() => provider.keyUrl && Linking.openURL(provider.keyUrl)} />
            <Field label={`${provider.name} API key`} value={key} onChangeText={setKey} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Paste your key" hint="Encrypted with Android Keystore. Sent only to this provider." />
            {error ? <Text variant="small" tone="danger" marginTop="$3">{error}</Text> : null}
            <Button title="Connect" loading={checking} disabled={!key.trim()} onPress={connect} style={{marginTop: 16}} />
            <Card pressable marginTop="$5" flexDirection="row" alignItems="center" gap="$3" padding="$3.5" onPress={() => { settings.set({activeProvider: 'ondevice'}); setStep(2); }} accessibilityRole="button">
              <IconTile icon={Cpu} />
              <YStack flex={1}>
                <Text variant="smallMedium">Use an on-device model instead</Text>
                <Text variant="caption" tone="muted">Fully offline. Download one from Settings → On-device models.</Text>
              </YStack>
            </Card>
            {PROVIDERS.length > PICKS.length ? <Text variant="caption" tone="faint" marginTop="$3">Cerebras, Mistral, Hugging Face, GitHub Models and local servers are in Settings.</Text> : null}
          </YStack>
        ) : (
          <YStack>
            <Mark icon={Box} size={28} />
            <Text variant="title" marginTop="$6">Add a Linux shell</Text>
            <Text tone="muted" marginTop="$2">Forge can set up Alpine Linux inside the app. It is a 4 MB download, needs no root, and lets the agent run the code it writes with Node.js, Python, git and thousands of other packages.</Text>
            {linux.installed ? (
              <XStack gap="$2" alignItems="center" marginTop="$6"><Check size={20} color={colors.success} /><Text tone="success">Alpine Linux {linux.release} is ready</Text></XStack>
            ) : linux.installing ? (
              <YStack marginTop="$6" gap="$1.5">
                <Progress value={linux.progress} />
                <Text variant="caption" tone="faint">{linux.detail || 'Starting…'}</Text>
              </YStack>
            ) : (
              <Button title="Install Linux" kind="secondary" style={{marginTop: 24}} onPress={() => void linux.install()} disabled={!nativeAvailable} />
            )}
            {linux.error ? <Text variant="small" tone="danger" marginTop="$3">{linux.error}</Text> : null}
            <Text variant="caption" tone="faint" marginTop="$3">You can also do this later from the Linux tab. Installation continues if you move on.</Text>
          </YStack>
        )}
      </ScrollView>
      <YStack paddingHorizontal="$5">
        {step === 0 ? <Button title="Get started" onPress={() => setStep(1)} /> : step === 2 ? <Button title="Start building" onPress={finish} /> : null}
      </YStack>
    </YStack>
  );
}
