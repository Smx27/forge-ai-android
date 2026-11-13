export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Chat: {chatId: string; prefill?: string};
  ModelPicker: undefined;
  Provider: {providerId: string};
  LocalModels: undefined;
  SkillDetail: {slug: string};
  McpDetail: {serverId: string};
  McpAdd: {catalogId?: string} | undefined;
  Memory: undefined;
  Personalize: undefined;
  FileView: {path: string};
  Preview: {uri: string; title: string; editable?: boolean};
  Legal: {doc: 'privacy' | 'terms'};
  Licenses: undefined;
  LicenseDetail: {name: string};
  ChatFolder: {chatId: string};
  Git: undefined;
  Publish: {path?: string} | undefined;
  Usage: undefined;
  Backup: undefined;
  Prompts: undefined;
};

export type TabParamList = {
  Chats: undefined;
  Files: {path?: string} | undefined;
  Terminal: undefined;
  Store: undefined;
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
