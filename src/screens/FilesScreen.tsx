import React, {useCallback, useEffect, useState} from 'react';
import {alert} from '../ui/dialog';
import {FlatList, RefreshControl, ScrollView} from 'react-native';
import {XStack, YStack} from '@tamagui/stacks';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {ChevronRight, File, FileCode, FilePlus, Folder, FolderPlus, FolderOpen, Image as ImageIcon, Import} from 'lucide-react-native';
import {forgeNative, type DirEntry} from '../native';
import {WORKSPACE, resolveWorkspacePath, toRelative} from '../engine/workspace';
import {useTheme} from '../theme/ThemeProvider';
import {Divider, Empty, Field, IconButton, IconTile, LargeTitle, Screen, Tap, Text, Button} from '../ui';
import {formatBytes, relativeTime} from '../utils/format';

const CODE = /\.(tsx?|jsx?|py|sh|json|html?|css|md|ya?ml|toml|rs|go|java|kt|c|cpp|h|rb|php|sql|xml)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

export default function FilesScreen() {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [dir, setDir] = useState(WORKSPACE);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [name, setName] = useState('');

  const load = useCallback(async (target = dir) => {
    setLoading(true);
    try { await forgeNative.mkdir(WORKSPACE); setEntries(await forgeNative.listDir(target)); } catch { setEntries([]); } finally { setLoading(false); }
  }, [dir]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(dir); }, [dir, load]);

  const relative = toRelative(dir);
  const crumbs = relative === '.' ? [] : relative.split('/');
  const create = async () => {
    const clean = name.trim();
    if (!clean || clean.includes('..')) return;
    const target = resolveWorkspacePath(`${relative === '.' ? '' : relative + '/'}${clean}`);
    if (creating === 'folder') await forgeNative.mkdir(target); else await forgeNative.writeFile(target, '');
    setCreating(null); setName('');
    await load();
    if (creating === 'file') navigation.navigate('FileView', {path: target});
  };
  const exportEntry = async (entry: DirEntry) => {
    try {
      if (entry.isDir) {
        const archive = forgeNative.cacheDir + '/exports/' + entry.name + '.zip';
        await forgeNative.zipDir(entry.path, archive);
        const saved = await forgeNative.saveDocument(archive, entry.name + '.zip', 'application/zip');
        await forgeNative.remove(forgeNative.cacheDir + '/exports').catch(() => undefined);
        if (saved) alert('Exported', 'Saved ' + saved + '. node_modules folders are skipped.');
      } else {
        const saved = await forgeNative.saveDocument(entry.path, entry.name, 'application/octet-stream');
        if (saved) alert('Saved', 'Saved a copy as ' + saved + '.');
      }
    } catch (error) { alert('Could not export', error instanceof Error ? error.message : String(error)); }
  };
  const importZip = async () => {
    try {
      const picked = await forgeNative.openDocument(['application/zip', 'application/x-zip-compressed', 'application/octet-stream']);
      if (!picked) return;
      if (!/\.zip$/i.test(picked.name)) { alert('Not a zip file', 'Choose a .zip archive to import it as a folder.'); return; }
      const base = picked.name.replace(/\.zip$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-') || 'import';
      let target = dir + '/' + base;
      for (let index = 2; await forgeNative.stat(target); index++) target = dir + '/' + base + '-' + index;
      const count = await forgeNative.unzip(picked.path, target);
      await forgeNative.remove(picked.path).catch(() => undefined);
      await load();
      alert('Imported', count + ' file' + (count === 1 ? '' : 's') + ' unpacked into ' + target.split('/').pop() + '.');
    } catch (error) { alert('Could not import', error instanceof Error ? error.message : String(error)); }
  };
  const options = (entry: DirEntry) => alert(entry.name, entry.isDir ? 'Folder' : formatBytes(entry.size), [
    {text: entry.isDir ? 'Export as zip' : 'Save a copy', onPress: () => void exportEntry(entry)},
    ...(entry.isDir ? [{text: 'Push to GitHub', onPress: () => navigation.navigate('Publish', {path: entry.path})}] : []),
    {text: 'Delete', style: 'destructive', onPress: () => alert(`Delete ${entry.name}?`, 'This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => { await forgeNative.remove(entry.path); await load(); }},
    ])},
    {text: 'Cancel', style: 'cancel'},
  ]);

  return (
    <Screen padded={false}>
      <YStack paddingHorizontal="$4">
        <LargeTitle title="Files" subtitle="Your workspace, shared with the agent and Linux" right={<>
          <IconButton icon={FilePlus} label="New file" onPress={() => setCreating('file')} />
          <IconButton icon={FolderPlus} label="New folder" onPress={() => setCreating('folder')} />
          <IconButton icon={Import} label="Import zip" onPress={() => void importZip()} />
        </>} />
      </YStack>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow: 0}} contentContainerStyle={{alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 8}}>
        <Tap onPress={() => setDir(WORKSPACE)} accessibilityRole="button"><Text variant="hud" tone={crumbs.length ? 'muted' : 'accent'}>workspace</Text></Tap>
        {crumbs.map((crumb, index) => (
          <XStack key={index} alignItems="center">
            <ChevronRight size={14} color={colors.faint} />
            <Tap onPress={() => setDir(resolveWorkspacePath(crumbs.slice(0, index + 1).join('/')))} accessibilityRole="button">
              <Text variant="hud" textTransform="none" letterSpacing={0.6} tone={index === crumbs.length - 1 ? 'accent' : 'muted'}>{crumb}</Text>
            </Tap>
          </XStack>
        ))}
      </ScrollView>
      {creating ? (
        <YStack paddingHorizontal="$4">
          <Field autoFocus value={name} onChangeText={setName} onSubmitEditing={create} placeholder={creating === 'file' ? 'index.html' : 'my-project'} autoCapitalize="none" autoCorrect={false} />
          <XStack gap="$2" marginTop="$2">
            <Button title="Cancel" kind="secondary" compact style={{flex: 1}} onPress={() => { setCreating(null); setName(''); }} />
            <Button title={creating === 'file' ? 'Create file' : 'Create folder'} compact style={{flex: 1}} onPress={create} disabled={!name.trim()} />
          </XStack>
        </YStack>
      ) : null}
      <FlatList
        data={entries}
        keyExtractor={item => item.path}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.accent} colors={[colors.accent]} />}
        contentContainerStyle={{flexGrow: 1, paddingBottom: 32}}
        ItemSeparatorComponent={() => <Divider marginLeft={68} />}
        renderItem={({item}) => {
          const Icon = item.isDir ? Folder : IMAGE.test(item.name) ? ImageIcon : CODE.test(item.name) ? FileCode : File;
          return (
            <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingVertical="$3" animation="quick" pressStyle={{backgroundColor: '$raised'}}
              accessibilityRole="button" onLongPress={() => options(item)}
              onPress={() => item.isDir ? setDir(item.path) : navigation.navigate('FileView', {path: item.path})}>
              <IconTile icon={Icon} tone={item.isDir ? 'accent' : IMAGE.test(item.name) ? 'violet' : CODE.test(item.name) ? 'info' : 'muted'} />
              <YStack flex={1}>
                <Text numberOfLines={1}>{item.name}</Text>
                <Text variant="caption" tone="faint">{item.isDir ? 'Folder' : formatBytes(item.size)} · {relativeTime(item.mtime)}</Text>
              </YStack>
              {item.isDir ? <ChevronRight size={18} color={colors.faint} /> : null}
            </XStack>
          );
        }}
        ListEmptyComponent={loading ? null : <Empty icon={FolderOpen} title={crumbs.length ? 'This folder is empty' : 'No files yet'} body="Ask Forge to build something and the files land here. You can also create them yourself." />}
      />
    </Screen>
  );
}
