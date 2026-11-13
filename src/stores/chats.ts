import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {zustandStorage} from './storage';
import type {ToolCall} from '../engine/providers';

export interface PlanStep {title: string; status: 'pending' | 'active' | 'done'}

export interface ToolResult {status: 'ok' | 'error' | 'denied'; output: string; detail?: {path?: string; added?: number; removed?: number; diff?: {kind: 'add' | 'del' | 'ctx'; text: string}[]; exitCode?: number; command?: string; hits?: {title: string; url: string}[]; plan?: PlanStep[]}}

export type ChatMessage =
  | {id: string; role: 'user'; text: string; ts: number; images?: string[]}
  | {id: string; role: 'assistant'; text: string; ts: number; toolCalls?: ToolCall[]; model?: string; error?: string; note?: string}
  | {id: string; role: 'tool'; toolCallId: string; name: string; ts: number; result: ToolResult};

export interface Chat {id: string; title: string; createdAt: number; updatedAt: number; model?: string; pinned?: boolean; folder?: string}

export interface PendingApproval {chatId: string; callId: string; name: string; summary: string; resolve: (approved: boolean) => void}

interface ChatState {
  chats: Chat[];
  messages: Record<string, ChatMessage[]>;
  running: Record<string, {status: string; startedAt: number} | undefined>;
  approval: PendingApproval | null;
  createChat: (title?: string) => string;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
  togglePin: (id: string) => void;
  setFolder: (id: string, folder: string | undefined) => void;
  append: (chatId: string, message: ChatMessage) => void;
  patchMessage: (chatId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  truncateFrom: (chatId: string, messageId: string) => void;
  setRunning: (chatId: string, status: string | null) => void;
  setApproval: (approval: PendingApproval | null) => void;
  clearAll: () => void;
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const useChats = create<ChatState>()(persist((set, get) => ({
  chats: [],
  messages: {},
  running: {},
  approval: null,
  createChat: title => {
    const id = newId();
    const now = Date.now();
    set({chats: [{id, title: title ?? 'New chat', createdAt: now, updatedAt: now}, ...get().chats], messages: {...get().messages, [id]: []}});
    return id;
  },
  renameChat: (id, title) => set({chats: get().chats.map(chat => chat.id === id ? {...chat, title: title.trim().slice(0, 80) || chat.title} : chat)}),
  deleteChat: id => {
    const messages = {...get().messages};
    delete messages[id];
    set({chats: get().chats.filter(chat => chat.id !== id), messages});
  },
  setFolder: (id, folder) => set({chats: get().chats.map(chat => chat.id === id ? {...chat, folder: folder || undefined} : chat)}),
  togglePin: id => set({chats: get().chats.map(chat => chat.id === id ? {...chat, pinned: !chat.pinned} : chat)}),
  append: (chatId, message) => set({
    messages: {...get().messages, [chatId]: [...(get().messages[chatId] ?? []), message]},
    chats: get().chats.map(chat => chat.id === chatId ? {...chat, updatedAt: Date.now()} : chat),
  }),
  patchMessage: (chatId, messageId, patch) => set({
    messages: {...get().messages, [chatId]: (get().messages[chatId] ?? []).map(message => message.id === messageId ? {...message, ...patch} as ChatMessage : message)},
  }),
  truncateFrom: (chatId, messageId) => {
    const list = get().messages[chatId] ?? [];
    const index = list.findIndex(message => message.id === messageId);
    if (index >= 0) set({messages: {...get().messages, [chatId]: list.slice(0, index)}});
  },
  setRunning: (chatId, status) => set({running: {...get().running, [chatId]: status ? {status, startedAt: get().running[chatId]?.startedAt ?? Date.now()} : undefined}}),
  setApproval: approval => set({approval}),
  clearAll: () => set({chats: [], messages: {}, running: {}, approval: null}),
}), {
  name: 'forge.chats',
  storage: createJSONStorage(() => zustandStorage),
  partialize: state => ({chats: state.chats, messages: state.messages}),
}));
