import React, {useEffect, useState} from 'react';
import {Linking, ScrollView} from 'react-native';
import {YStack} from '@tamagui/stacks';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft, ExternalLink, Trash2} from 'lucide-react-native';
import type {RootStackParamList} from '../navigation/types';
import {useLibrary} from '../stores/library';
import {parseFrontmatter, readSkillFile, SKILLS_DIR} from '../engine/skills';
import {forgeNative} from '../native';
import {Spread} from '../ui';
import {Button, Card, IconButton, NavHeader, Screen, Text, Toggle} from '../ui';
import {Markdown} from '../components/Markdown';

export default function SkillDetailScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'SkillDetail'>>();
  const skill = useLibrary(state => state.skills.find(item => item.slug === params.slug));
  const [body, setBody] = useState('');
  useEffect(() => { readSkillFile(params.slug).then(text => setBody(parseFrontmatter(text).body)).catch(() => setBody('The skill files are missing. Reinstall it from the Store.')); }, [params.slug]);
  if (!skill) return null;
  const remove = async () => {
    await forgeNative.remove(`${SKILLS_DIR}/${skill.slug}`).catch(() => undefined);
    useLibrary.getState().removeSkill(skill.slug);
    navigation.goBack();
  };
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title={skill.name} backIcon={ArrowLeft} onBack={() => navigation.goBack()} right={<IconButton icon={ExternalLink} label="Open source" onPress={() => Linking.openURL(skill.source)} />} />
      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 48}}>
        <Text tone="muted">{skill.description}</Text>
        <Card marginTop="$5" gap="$2">
          <Spread>
            <Text variant="bodyMedium">Available to the agent</Text>
            <Toggle label="Enable skill" value={skill.enabled} onChange={() => useLibrary.getState().toggleSkill(skill.slug)} />
          </Spread>
          <Text variant="caption" tone="faint">{skill.files.length} file{skill.files.length === 1 ? '' : 's'}: {skill.files.slice(0, 8).join(', ')}{skill.files.length > 8 ? '…' : ''}</Text>
        </Card>
        <YStack marginTop="$7"><Markdown text={body.slice(0, 20000)} /></YStack>
        <Button title="Remove skill" kind="danger" icon={Trash2} style={{marginTop: 32}} onPress={remove} />
      </ScrollView>
    </Screen>
  );
}
