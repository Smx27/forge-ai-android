import {forgeNative} from '../native';
import {useChats} from '../stores/chats';
import {useSettings} from '../stores/settings';
import {useLibrary} from '../stores/library';
import {useUsage} from '../stores/usage';
import {usePrompts, type SavedPrompt} from '../stores/prompts';
import {PROVIDERS} from './providers';
import {applyGitConfig} from './git';

interface BackupFile {
  format: 'forge-backup';
  version: 1;
  createdAt: number;
  app: string;
  chats: {chats: ReturnType<typeof useChats.getState>['chats']; messages: ReturnType<typeof useChats.getState>['messages']};
  settings: Record<string, unknown>;
  memory: ReturnType<typeof useLibrary.getState>['memory'];
  servers: {id: string; name: string; url: string; enabled: boolean}[];
  usage: ReturnType<typeof useUsage.getState>['days'];
  prompts?: SavedPrompt[];
  keys?: Record<string, string>;
}

const SETTINGS_KEYS = ['theme', 'activeProvider', 'providers', 'localModelId', 'approvalMode', 'webTools', 'memoryEnabled', 'maxSteps', 'temperature', 'systemPrompt', 'gitName', 'gitEmail', 'githubLogin', 'localTools', 'notifyWhenDone'] as const;

function secretKeys(): string[] {
  return [...PROVIDERS.map(provider => `provider.${provider.id}`), ...useLibrary.getState().servers.map(server => `mcp.${server.id}`), 'github.token'];
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportBackup(password: string, includeKeys: boolean): Promise<string | null> {
  if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
  const chats = useChats.getState();
  const settings = useSettings.getState() as unknown as Record<string, unknown>;
  const library = useLibrary.getState();
  const data: BackupFile = {
    format: 'forge-backup', version: 1, createdAt: Date.now(), app: forgeNative.appVersion,
    chats: {chats: chats.chats, messages: chats.messages},
    settings: Object.fromEntries(SETTINGS_KEYS.map(key => [key, settings[key]])),
    memory: library.memory,
    servers: library.servers.map(server => ({id: server.id, name: server.name, url: server.url, enabled: server.enabled})),
    usage: useUsage.getState().days,
    prompts: usePrompts.getState().prompts,
  };
  if (includeKeys) {
    const keys: Record<string, string> = {};
    for (const key of secretKeys()) { const value = await forgeNative.secureGet(key); if (value) keys[key] = value; }
    data.keys = keys;
  }
  const plain = `${forgeNative.cacheDir}/backup/forge-backup.json`;
  const sealed = `${forgeNative.cacheDir}/backup/forge-backup.forge`;
  try {
    await forgeNative.writeFile(plain, JSON.stringify(data));
    await forgeNative.encryptFile(plain, sealed, password);
    await forgeNative.remove(plain);
    return await forgeNative.saveDocument(sealed, `forge-backup-${stamp()}.forge`, 'application/octet-stream');
  } finally {
    await forgeNative.remove(`${forgeNative.cacheDir}/backup`).catch(() => undefined);
  }
}

export async function pickBackup(): Promise<string | null> {
  const picked = await forgeNative.openDocument(['application/octet-stream', '*/*']);
  return picked?.path ?? null;
}

export async function readBackup(path: string, password: string): Promise<BackupFile> {
  const plain = `${forgeNative.cacheDir}/backup/restore.json`;
  try {
    await forgeNative.decryptFile(path, plain, password);
    const data = JSON.parse(await forgeNative.readFile(plain)) as BackupFile;
    if (data.format !== 'forge-backup' || !data.chats) throw new Error('This backup was made by an unsupported version of Forge.');
    return data;
  } finally {
    await forgeNative.remove(`${forgeNative.cacheDir}/backup`).catch(() => undefined);
  }
}

export async function applyBackup(data: BackupFile): Promise<void> {
  useChats.setState({chats: data.chats.chats ?? [], messages: data.chats.messages ?? {}});
  const current = useSettings.getState();
  const providers = {...current.providers, ...((data.settings.providers as typeof current.providers) ?? {})};
  for (const id of Object.keys(providers)) providers[id] = {...providers[id], hasKey: !!data.keys?.[`provider.${id}`] || current.providers[id]?.hasKey === true};
  useSettings.setState({...(data.settings as Partial<typeof current>), providers, githubLogin: data.keys?.['github.token'] ? (data.settings.githubLogin as string | null) : current.githubLogin, onboarded: true});
  const library = useLibrary.getState();
  const known = new Set(library.memory.map(entry => entry.text));
  useLibrary.setState({memory: [...library.memory, ...(data.memory ?? []).filter(entry => !known.has(entry.text))].slice(0, 500)});
  for (const server of data.servers ?? []) library.upsertServer({...server, hasToken: !!data.keys?.[`mcp.${server.id}`]});
  useUsage.setState({days: {...data.usage, ...useUsage.getState().days}});
  const commands = new Set(usePrompts.getState().prompts.map(item => item.command));
  usePrompts.setState({prompts: [...usePrompts.getState().prompts, ...(data.prompts ?? []).filter(item => !commands.has(item.command))]});
  for (const [key, value] of Object.entries(data.keys ?? {})) await forgeNative.secureSet(key, value);
  await applyGitConfig();
}
