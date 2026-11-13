import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {zustandStorage} from './storage';

export interface CheckpointEntry {path: string; kind: 'file' | 'none' | 'dir'; backup?: string}
export interface Checkpoint {turnId: string; createdAt: number; entries: CheckpointEntry[]}

interface CheckpointState {
  byChat: Record<string, Checkpoint[]>;
  add: (chatId: string, turnId: string, entry: CheckpointEntry) => void;
  drop: (chatId: string, turnIds: string[]) => void;
  dropChat: (chatId: string) => void;
}

export const useCheckpoints = create<CheckpointState>()(persist((set, get) => ({
  byChat: {},
  add: (chatId, turnId, entry) => {
    const list = get().byChat[chatId] ?? [];
    const existing = list.find(item => item.turnId === turnId);
    const next = existing
      ? list.map(item => item.turnId === turnId ? {...item, entries: [...item.entries, entry]} : item)
      : [...list, {turnId, createdAt: Date.now(), entries: [entry]}].slice(-30);
    set({byChat: {...get().byChat, [chatId]: next}});
  },
  drop: (chatId, turnIds) => set({byChat: {...get().byChat, [chatId]: (get().byChat[chatId] ?? []).filter(item => !turnIds.includes(item.turnId))}}),
  dropChat: chatId => { const byChat = {...get().byChat}; delete byChat[chatId]; set({byChat}); },
}), {name: 'forge.checkpoints', storage: createJSONStorage(() => zustandStorage)}));
