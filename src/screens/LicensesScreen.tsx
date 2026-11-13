import React, {useMemo, useState} from 'react';
import {Linking, ScrollView, SectionList} from 'react-native';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {ArrowLeft, ExternalLink, Scale} from 'lucide-react-native';
import {XStack, YStack} from '@tamagui/stacks';
import type {RootStackParamList} from '../navigation/types';
import {Button, Card, Divider, Empty, Field, HudLabel, NavHeader, Screen, Tag, Tap, Text} from '../ui';
import data from '../licenses/data.json';

type Item = {name: string; version: string; license: string; url: string; text?: number; notice?: number; note?: string};
const sections = data.sections as {title: string; items: Item[]}[];
const total = sections.reduce((n, s) => n + s.items.length, 0);

function shortLicense(license: string) {
  return license.replace(/^\((.*)\)$/, '$1').replace(/-only$/, '').replace(/ AND /g, ' + ').replace(/ OR /g, ' / ');
}

export default function LicensesScreen() {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections
      .map(s => ({title: s.title, data: q ? s.items.filter(i => (i.name + ' ' + i.license).toLowerCase().includes(q)) : s.items}))
      .filter(s => s.data.length);
  }, [query]);
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title="Open-source licenses" subtitle={total + ' components'} backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <SectionList
        sections={shown}
        keyExtractor={(item, index) => item.name + index}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        contentContainerStyle={{paddingBottom: 32, flexGrow: 1}}
        ListHeaderComponent={
          <YStack paddingHorizontal="$4" paddingTop="$3" gap="$2">
            <Text variant="small" tone="muted">
              Forge is built on open-source software. Every component that ships in this app is listed here with its license. Thank you to all the people who made it.
            </Text>
            <Field value={query} onChangeText={setQuery} placeholder="Search packages or licenses" autoCorrect={false} autoCapitalize="none" />
          </YStack>
        }
        renderSectionHeader={({section}) => (
          <YStack paddingHorizontal="$4" marginTop="$5">
            <HudLabel title={section.title + ' · ' + section.data.length} />
          </YStack>
        )}
        ItemSeparatorComponent={() => <Divider marginLeft="$4" />}
        renderItem={({item}) => (
          <Tap onPress={() => navigation.navigate('LicenseDetail', {name: item.name})}>
            <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingVertical="$2.5">
              <YStack flex={1} gap={2}>
                <Text variant="smallMedium" numberOfLines={1}>{item.name}</Text>
                <Text variant="mono" fontSize={11.5} lineHeight={16} tone="faint" numberOfLines={1}>{item.version}</Text>
              </YStack>
              <Tag label={shortLicense(item.license)} tone={/GPL/.test(item.license) ? 'warn' : 'muted'} />
            </XStack>
          </Tap>
        )}
        ListEmptyComponent={<Empty icon={Scale} title="No matches" body="Try a package name like react or a license like MIT." />}
        ListFooterComponent={
          <Text variant="caption" tone="faint" marginHorizontal="$4" marginTop="$5">
            The Linux system, packages, skills and model weights you download are not part of the app and come with their own licenses. PRoot, talloc and libandroid-shmem are unmodified Termux builds that run as separate programs; their source code is linked on their pages.
          </Text>
        }
      />
    </Screen>
  );
}

export function LicenseDetailScreen() {
  const navigation = useNavigation();
  const {params} = useRoute<RouteProp<RootStackParamList, 'LicenseDetail'>>();
  const item = useMemo(() => sections.flatMap(s => s.items).find(i => i.name === params.name), [params.name]);
  if (!item) return null;
  const text = item.text === undefined ? undefined : data.texts[item.text];
  const notice = item.notice === undefined ? undefined : data.texts[item.notice];
  return (
    <Screen padded={false} edges={['bottom']}>
      <NavHeader title={item.name} subtitle={shortLicense(item.license)} backIcon={ArrowLeft} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 48, gap: 16}}>
        <Card padding="$4" gap="$2">
          <Text variant="label" tone="muted">Version</Text>
          <Text variant="mono">{item.version}</Text>
          <XStack gap="$2" marginTop="$1" flexWrap="wrap"><Tag label={item.license} tone="accent" /></XStack>
          {item.note ? <Text variant="small" tone="muted" marginTop="$1">{item.note}</Text> : null}
          <Button title="Project page" kind="secondary" compact icon={ExternalLink} style={{alignSelf: 'flex-start', marginTop: 8}} onPress={() => Linking.openURL(item.url)} />
        </Card>
        {notice ? (
          <YStack>
            <HudLabel title="Notice" />
            <Text variant="mono" fontSize={12} lineHeight={18} tone="muted" selectable>{notice}</Text>
          </YStack>
        ) : null}
        <YStack>
          <HudLabel title="License text" />
          {text
            ? <Text variant="mono" fontSize={12} lineHeight={18} tone="muted" selectable>{text}</Text>
            : <Text variant="small" tone="muted">See the project page for the full license.</Text>}
        </YStack>
      </ScrollView>
    </Screen>
  );
}
