import React, {useEffect, useState} from 'react';
import {XStack, YStack} from '@tamagui/stacks';
import {onKeyboard} from '../native/keyboard';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator, type BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {FolderOpen, MessageSquare, Puzzle, Settings2, SquareTerminal} from 'lucide-react-native';
import type {RootStackParamList, TabParamList} from './types';
import {useSettings} from '../stores/settings';
import {useTheme} from '../theme/ThemeProvider';
import {Corners, Text, Tap} from '../ui';
import ChatsScreen from '../screens/ChatsScreen';
import ChatScreen from '../screens/ChatScreen';
import FilesScreen from '../screens/FilesScreen';
import FileViewScreen from '../screens/FileViewScreen';
import TerminalScreen from '../screens/TerminalScreen';
import StoreScreen from '../screens/StoreScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import ModelPickerScreen from '../screens/ModelPickerScreen';
import ProviderScreen from '../screens/ProviderScreen';
import LocalModelsScreen from '../screens/LocalModelsScreen';
import SkillDetailScreen from '../screens/SkillDetailScreen';
import {McpAddScreen, McpDetailScreen} from '../screens/McpScreens';
import MemoryScreen from '../screens/MemoryScreen';
import PersonalizeScreen from '../screens/PersonalizeScreen';
import PreviewScreen from '../screens/PreviewScreen';
import LegalScreen from '../screens/LegalScreen';
import LicensesScreen, {LicenseDetailScreen} from '../screens/LicensesScreen';
import ChatFolderScreen from '../screens/ChatFolderScreen';
import GitScreen from '../screens/GitScreen';
import PublishScreen from '../screens/PublishScreen';
import UsageScreen from '../screens/UsageScreen';
import BackupScreen from '../screens/BackupScreen';
import PromptsScreen from '../screens/PromptsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const TAB_ICONS = {Chats: MessageSquare, Files: FolderOpen, Terminal: SquareTerminal, Store: Puzzle, Settings: Settings2};
const TAB_LABELS = {Chats: 'Chats', Files: 'Files', Terminal: 'Linux', Store: 'Store', Settings: 'Settings'};

function TabBar({state, navigation}: BottomTabBarProps) {
  const {colors} = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => onKeyboard(top => setKeyboard(top !== null)), []);
  if (keyboard) return null;
  return (
    <XStack backgroundColor="$bg" borderTopWidth={1} borderTopColor="$lineStrong" paddingTop="$2" paddingHorizontal="$2" paddingBottom={Math.max(insets.bottom, 8)}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = TAB_ICONS[route.name as keyof typeof TAB_ICONS];
        return (
          <Tap key={route.key} accessibilityRole="tab" accessibilityState={{selected: focused}} accessibilityLabel={TAB_LABELS[route.name as keyof typeof TAB_LABELS]}
            onPress={() => { if (!focused) navigation.navigate(route.name); }} flex={1} alignItems="center" gap={4} minHeight={52}>
            <YStack position="absolute" top={-9} height={2} width={focused ? 34 : 0} backgroundColor="$accent" style={focused ? {shadowColor: colors.accent, shadowOpacity: 1, shadowRadius: 6, elevation: 0} : undefined} />
            <YStack width={52} height={30} alignItems="center" justifyContent="center" backgroundColor={focused ? '$accentSoft' : 'transparent'}>
              <Icon size={20} color={focused ? colors.accent : colors.faint} strokeWidth={focused ? 1.9 : 1.5} />
              {focused ? <Corners color={colors.accent} size={6} weight={1.5} /> : null}
            </YStack>
            <Text variant="label" fontSize={10.5} letterSpacing={1.4} numberOfLines={1} maxFontSizeMultiplier={1.15} tone={focused ? 'accent' : 'faint'}>{TAB_LABELS[route.name as keyof typeof TAB_LABELS]}</Text>
          </Tap>
        );
      })}
    </XStack>
  );
}

function HomeTabs() {
  return (
    <Tabs.Navigator tabBar={props => <TabBar {...props} />} screenOptions={{headerShown: false, lazy: true}}>
      <Tabs.Screen name="Chats" component={ChatsScreen} />
      <Tabs.Screen name="Files" component={FilesScreen} />
      <Tabs.Screen name="Terminal" component={TerminalScreen} />
      <Tabs.Screen name="Store" component={StoreScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export default function RootNavigator() {
  const onboarded = useSettings(state => state.onboarded);
  const {colors} = useTheme();
  return (
    <Stack.Navigator screenOptions={{headerShown: false, animation: 'slide_from_right', contentStyle: {backgroundColor: colors.bg}}}>
      {!onboarded ? <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{animation: 'fade'}} /> : null}
      <Stack.Screen name="Tabs" component={HomeTabs} options={{animation: 'fade'}} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ModelPicker" component={ModelPickerScreen} options={{animation: 'slide_from_bottom'}} />
      <Stack.Screen name="Provider" component={ProviderScreen} />
      <Stack.Screen name="LocalModels" component={LocalModelsScreen} />
      <Stack.Screen name="SkillDetail" component={SkillDetailScreen} />
      <Stack.Screen name="McpDetail" component={McpDetailScreen} />
      <Stack.Screen name="McpAdd" component={McpAddScreen} options={{animation: 'slide_from_bottom'}} />
      <Stack.Screen name="Memory" component={MemoryScreen} />
      <Stack.Screen name="Personalize" component={PersonalizeScreen} />
      <Stack.Screen name="FileView" component={FileViewScreen} />
      <Stack.Screen name="Preview" component={PreviewScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
      <Stack.Screen name="Licenses" component={LicensesScreen} />
      <Stack.Screen name="LicenseDetail" component={LicenseDetailScreen} />
      <Stack.Screen name="ChatFolder" component={ChatFolderScreen} options={{animation: 'slide_from_bottom'}} />
      <Stack.Screen name="Git" component={GitScreen} />
      <Stack.Screen name="Publish" component={PublishScreen} />
      <Stack.Screen name="Usage" component={UsageScreen} />
      <Stack.Screen name="Prompts" component={PromptsScreen} />
      <Stack.Screen name="Backup" component={BackupScreen} />
    </Stack.Navigator>
  );
}
