import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {zustandStorage} from './storage';
import type {SkillMeta} from '../engine/skills';
import type {McpToolInfo} from '../engine/mcp';
import type {MemoryEntry} from '../engine/memory';
import {newId} from './chats';
import {forgeNative} from '../native';

export interface McpServer {id: string; name: string; url: string; enabled: boolean; hasToken: boolean; tools: McpToolInfo[]; status: 'idle' | 'connecting' | 'ready' | 'error'; error?: string}

export interface LocalModel {id: string; name: string; file: string; size: number; url: string; sha256?: string; custom?: boolean}

interface LibraryState {
  skills: SkillMeta[];
  servers: McpServer[];
  memory: MemoryEntry[];
  models: LocalModel[];
  downloads: Record<string, {progress: number; error?: string} | undefined>;
  addSkill: (skill: SkillMeta) => void;
  toggleSkill: (slug: string) => void;
  removeSkill: (slug: string) => void;
  upsertServer: (server: Omit<McpServer, 'tools' | 'status' | 'hasToken'> & Partial<McpServer>) => void;
  patchServer: (id: string, patch: Partial<McpServer>) => void;
  removeServer: (id: string) => void;
  remember: (text: string, kind: MemoryEntry['kind']) => MemoryEntry;
  forget: (id: string) => void;
  addModel: (model: LocalModel) => void;
  removeModel: (id: string) => void;
  setDownload: (id: string, value: {progress: number; error?: string} | undefined) => void;
}

export const useLibrary = create<LibraryState>()(persist((set, get) => ({
  skills: [],
  servers: [],
  memory: [],
  models: [],
  downloads: {},
  addSkill: skill => set({skills: [skill, ...get().skills.filter(item => item.slug !== skill.slug)]}),
  toggleSkill: slug => set({skills: get().skills.map(skill => skill.slug === slug ? {...skill, enabled: !skill.enabled} : skill)}),
  removeSkill: slug => set({skills: get().skills.filter(skill => skill.slug !== slug)}),
  upsertServer: server => {
    const existing = get().servers.find(item => item.id === server.id);
    const next: McpServer = {tools: [], status: 'idle', hasToken: false, ...existing, ...server};
    set({servers: existing ? get().servers.map(item => item.id === server.id ? next : item) : [...get().servers, next]});
  },
  patchServer: (id, patch) => set({servers: get().servers.map(server => server.id === id ? {...server, ...patch} : server)}),
  removeServer: id => { void forgeNative.secureDelete(`mcp.${id}`); set({servers: get().servers.filter(server => server.id !== id)}); },
  remember: (text, kind) => {
    const entry = {id: newId(), text: text.trim().slice(0, 2000), kind, ts: Date.now()};
    set({memory: [entry, ...get().memory].slice(0, 500)});
    return entry;
  },
  forget: id => set({memory: get().memory.filter(entry => entry.id !== id)}),
  addModel: model => set({models: [...get().models.filter(item => item.id !== model.id), model]}),
  removeModel: id => set({models: get().models.filter(model => model.id !== id)}),
  setDownload: (id, value) => set({downloads: {...get().downloads, [id]: value}}),
}), {
  name: 'forge.library',
  storage: createJSONStorage(() => zustandStorage),
  partialize: state => ({skills: state.skills, servers: state.servers.map(server => ({...server, status: 'idle' as const, error: undefined})), memory: state.memory, models: state.models}),
}));
