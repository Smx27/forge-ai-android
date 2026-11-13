import React, {useState} from 'react';
import {ScrollView} from 'react-native';
import {YStack} from '@tamagui/stacks';
import {alert} from '../ui/dialog';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft} from 'lucide-react-native';
import {applyBackup, exportBackup, pickBackup, readBackup} from '../engine/backup';
import {Button, Field, Group, NavHeader, Row, Screen, Text, Toggle} from '../ui';

export default function BackupScreen() {
  const navigation = useNavigation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [includeKeys, setIncludeKeys] = useState(true);
  const [restorePassword, setRestorePassword] = useState('');
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<{tone: 'danger' | 'success'; text: string} | null>(null);
  const mismatch = confirm.length > 0 && confirm !== password;

  const doExport = async () => {
    setBusy('export'); setMessage(null);
    try {
      const saved = await exportBackup(password, includeKeys);
      if (saved) { setMessage({tone: 'success', text: `Saved ${saved}. Keep the password safe; without it the backup cannot be opened.`}); setPassword(''); setConfirm(''); }
    } catch (error) { setMessage({tone: 'danger', text: error instanceof Error ? error.message : String(error)}); }
    finally { setBusy(null); }
  };

  const doImport = async () => {
    setMessage(null);
    const path = await pickBackup().catch(error => { setMessage({tone: 'danger', text: String(error?.message ?? error)}); return null; });
    if (!path) return;
    setBusy('import');
    try {
      const data = await readBackup(path, restorePassword);
      const count = data.chats.chats.length;
      setBusy(null);
      alert('Restore this backup?', `From ${new Date(data.createdAt).toLocaleString()}: ${count} chat${count === 1 ? '' : 's'}, ${data.memory?.length ?? 0} memories${data.keys ? ' and saved keys' : ''}. Your current chats are replaced.`, [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Restore', style: 'destructive', onPress: async () => {
          await applyBackup(data);
          setRestorePassword('');
          setMessage({tone: 'success', text: 'Backup restored.'});
        }},
      ]);
    } catch (error) { setMessage({tone: 'danger', text: error instanceof Error ? error.message : String(error)}); }
    finally { setBusy(null); }
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Backup and restore" backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48}}>
        <Text variant="small" tone="muted">Save your chats, memory, settings and connectors to an encrypted file, then restore it on a new phone. Workspace files are not included; export project folders as zip files from Files.</Text>
        <Group title="Create a backup" footer="Encrypted with AES-256-GCM using a key derived from your password. Forge cannot recover a forgotten password.">
          <YStack padding="$3" gap="$2">
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="At least 8 characters" />
            <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />
            {mismatch ? <Text variant="caption" tone="danger">The passwords do not match.</Text> : null}
          </YStack>
          <Row title="Include API keys and tokens" right={<Toggle label="Include API keys" value={includeKeys} onChange={setIncludeKeys} />} />
          <YStack padding="$3">
            <Button title="Save backup file" loading={busy === 'export'} disabled={password.length < 8 || confirm !== password || busy !== null} onPress={() => void doExport()} />
          </YStack>
        </Group>
        <Group title="Restore">
          <YStack padding="$3" gap="$2">
            <Field label="Backup password" value={restorePassword} onChangeText={setRestorePassword} secureTextEntry autoCapitalize="none" />
            <Button title="Choose backup file" kind="secondary" loading={busy === 'import'} disabled={!restorePassword || busy !== null} onPress={() => void doImport()} />
          </YStack>
        </Group>
        {message ? <Text variant="small" tone={message.tone} marginTop="$3">{message.text}</Text> : null}
      </ScrollView>
    </Screen>
  );
}
