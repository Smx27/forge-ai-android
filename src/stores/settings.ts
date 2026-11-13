import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {zustandStorage} from './storage';
import {forgeNative} from '../native';
import {PROVIDERS, providerById} from '../engine/providers';

export type ApprovalMode = 'ask' | 'edits' | 'auto';

export interface ProviderSettings {model: string; baseUrl: string; hasKey: boolean}

interface SettingsState {
  onboarded: boolean;
  theme: 'system' | 'dark' | 'light';
  activeProvider: string;
  providers: Record<string, ProviderSettings>;
  localModelId: string | null;
  approvalMode: ApprovalMode;
  webTools: boolean;
  memoryEnabled: boolean;
  maxSteps: number;
  temperature: number;
  systemPrompt: string;
  gitName: string;
  gitEmail: string;
  githubLogin: string | null;
  localTools: boolean;
  notifyWhenDone: boolean;
  autoFallback: boolean;
  dailyBudget: number;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'updateProvider' | 'saveKey' | 'removeKey'>>) => void;
  updateProvider: (id: string, patch: Partial<ProviderSettings>) => void;
  saveKey: (id: string, key: string) => Promise<void>;
  removeKey: (id: string) => Promise<void>;
}

const defaults = Object.fromEntries(PROVIDERS.map(provider => [provider.id, {model: provider.defaultModel, baseUrl: provider.baseUrl, hasKey: false}]));

export const useSettings = create<SettingsState>()(persist((set, get) => ({
  onboarded: false,
  theme: 'dark',
  activeProvider: 'openrouter',
  providers: defaults,
  localModelId: null,
  approvalMode: 'edits',
  webTools: true,
  memoryEnabled: true,
  maxSteps: 24,
  temperature: 0.4,
  systemPrompt: '',
  gitName: '',
  gitEmail: '',
  githubLogin: null,
  localTools: true,
  notifyWhenDone: true,
  autoFallback: true,
  dailyBudget: 0,
  set: patch => set(patch),
  updateProvider: (id, patch) => set({providers: {...get().providers, [id]: {...(get().providers[id] ?? defaults[id]), ...patch}}}),
  saveKey: async (id, key) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    await forgeNative.secureSet(`provider.${id}`, trimmed);
    get().updateProvider(id, {hasKey: true});
  },
  removeKey: async id => {
    await forgeNative.secureDelete(`provider.${id}`);
    get().updateProvider(id, {hasKey: false});
  },
}), {
  name: 'forge.settings',
  storage: createJSONStorage(() => zustandStorage),
  version: 1,
  merge: (persisted, current) => {
    const saved = (persisted ?? {}) as Partial<SettingsState>;
    return {...current, ...saved, providers: {...defaults, ...(saved.providers ?? {})}};
  },
}));

export function providerKey(id: string): Promise<string | null> {
  return forgeNative.secureGet(`provider.${id}`);
}

export function activeModelLabel(state: Pick<SettingsState, 'activeProvider' | 'providers' | 'localModelId'>): string {
  const provider = providerById(state.activeProvider);
  if (provider.kind === 'device') return state.localModelId ?? 'No model';
  return state.providers[provider.id]?.model || provider.defaultModel || 'Choose a model';
}
