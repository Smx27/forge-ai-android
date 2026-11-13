import React, {useState} from 'react';
import {ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft} from 'lucide-react-native';
import {useSettings} from '../stores/settings';
import {Button, Field, Group, NavHeader, Screen, Segmented, Text} from '../ui';

export default function PersonalizeScreen() {
  const navigation = useNavigation();
  const settings = useSettings();
  const [prompt, setPrompt] = useState(settings.systemPrompt);
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Custom instructions" backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: 16, paddingBottom: 40}}>
        <Text variant="small" tone="muted">Added to every conversation. Describe who you are, what you build and how you like answers.</Text>
        <Field value={prompt} onChangeText={setPrompt} multiline placeholder="I'm a frontend developer. Use TypeScript, keep answers short, explain trade-offs." style={{minHeight: 180}} maxLength={4000} />
        <Group title="Creativity" footer="Lower is more precise and repeatable. Higher is more varied.">
          <Segmented value={String(settings.temperature)} onChange={value => settings.set({temperature: Number(value)})}
            options={[{value: '0.2', label: 'Precise'}, {value: '0.4', label: 'Balanced'}, {value: '0.8', label: 'Creative'}]} />
        </Group>
        <Group title="Steps per task" footer="How many tool calls the agent may make before it stops to check in.">
          <Segmented value={String(settings.maxSteps)} onChange={value => settings.set({maxSteps: Number(value)})}
            options={[{value: '12', label: '12'}, {value: '24', label: '24'}, {value: '48', label: '48'}]} />
        </Group>
        <Button title="Save" style={{marginTop: 32}} onPress={() => { settings.set({systemPrompt: prompt.trim()}); navigation.goBack(); }} />
      </ScrollView>
    </Screen>
  );
}
