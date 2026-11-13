import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {zustandStorage} from './storage';
import {newId} from './chats';

export interface SavedPrompt {id: string; command: string; title: string; body: string; uses: number}

const DEFAULTS: SavedPrompt[] = [
  {id: 'p-review', command: 'review', title: 'Review my code', body: 'Review the code in this project for bugs, security issues and unclear parts. List the problems by severity, then fix the important ones.', uses: 0},
  {id: 'p-explain', command: 'explain', title: 'Explain this project', body: 'Read the files in this project and explain what it does, how it is structured and how to run it. Keep it short.', uses: 0},
  {id: 'p-tests', command: 'tests', title: 'Write tests', body: 'Add tests for the main logic in this project, run them in Linux and fix anything that fails.', uses: 0},
  {id: 'p-readme', command: 'readme', title: 'Write a README', body: 'Write a clear README.md for this project with what it does, how to install it, how to run it and an example.', uses: 0},
  {id: 'p-commit', command: 'commit', title: 'Commit and push', body: 'Look at the changes in this git repository, write a good commit message, commit them and push to the current branch.', uses: 0},
];

interface PromptState {
  prompts: SavedPrompt[];
  save: (prompt: Omit<SavedPrompt, 'id' | 'uses'> & {id?: string}) => void;
  remove: (id: string) => void;
  used: (id: string) => void;
}

export const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);

export const usePrompts = create<PromptState>()(persist((set, get) => ({
  prompts: DEFAULTS,
  save: prompt => {
    const command = slug(prompt.command || prompt.title) || 'prompt';
    if (prompt.id) set({prompts: get().prompts.map(item => item.id === prompt.id ? {...item, ...prompt, command} : item)});
    else set({prompts: [{id: newId(), uses: 0, title: prompt.title, body: prompt.body, command}, ...get().prompts]});
  },
  remove: id => set({prompts: get().prompts.filter(item => item.id !== id)}),
  used: id => set({prompts: get().prompts.map(item => item.id === id ? {...item, uses: item.uses + 1} : item)}),
}), {name: 'forge.prompts', storage: createJSONStorage(() => zustandStorage)}));

export function matchPrompts(prompts: SavedPrompt[], text: string): SavedPrompt[] {
  const match = /^\/([a-z0-9-]*)$/i.exec(text.trim());
  if (!match) return [];
  const query = match[1].toLowerCase();
  return prompts.filter(item => item.command.startsWith(query) || item.title.toLowerCase().includes(query)).sort((a, b) => b.uses - a.uses).slice(0, 5);
}
