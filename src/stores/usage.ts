import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {zustandStorage} from './storage';

export interface UsageRow {requests: number; prompt: number; completion: number; estimated: number}
export type UsageDays = Record<string, Record<string, UsageRow>>;
export interface ModelRow extends UsageRow {provider: string}
export interface PerfRow {ms: number; timed: number; errors: number}

interface UsageState {
  days: UsageDays;
  models: Record<string, Record<string, ModelRow>>;
  hours: Record<string, number[]>;
  perf: Record<string, PerfRow>;
  budgetAlerted: string | null;
  record: (provider: string, prompt: number, completion: number, estimated: boolean, meta?: {model?: string; ms?: number}) => void;
  recordError: (provider: string) => void;
  markBudgetAlerted: (day: string) => void;
  reset: () => void;
}

export function dayKey(time = Date.now()): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const emptyRow = (): UsageRow => ({requests: 0, prompt: 0, completion: 0, estimated: 0});

export function sumRows(rows: UsageRow[]): UsageRow {
  return rows.reduce((total, row) => ({requests: total.requests + row.requests, prompt: total.prompt + row.prompt, completion: total.completion + row.completion, estimated: total.estimated + row.estimated}), emptyRow());
}

export function tokensOn(days: UsageDays, key: string): number {
  return Object.values(days[key] ?? {}).reduce((sum, row) => sum + row.prompt + row.completion, 0);
}

const add = (row: UsageRow | undefined, prompt: number, completion: number, estimated: boolean): UsageRow => {
  const base = row ?? emptyRow();
  return {requests: base.requests + 1, prompt: base.prompt + prompt, completion: base.completion + completion, estimated: base.estimated + (estimated ? 1 : 0)};
};

function keepRecent<T>(map: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(map).sort().slice(-90).map(day => [day, map[day]]));
}

export const useUsage = create<UsageState>()(persist((set, get) => ({
  days: {},
  models: {},
  hours: {},
  perf: {},
  budgetAlerted: null,
  record: (provider, prompt, completion, estimated, meta) => {
    const key = dayKey();
    const state = get();
    const today = {...(state.days[key] ?? {}), [provider]: add(state.days[key]?.[provider], prompt, completion, estimated)};
    const models = {...state.models};
    if (meta?.model) {
      const day = {...(models[key] ?? {})};
      day[meta.model] = {...add(day[meta.model], prompt, completion, estimated), provider};
      models[key] = day;
    }
    const hours = {...state.hours};
    const slots = [...(hours[key] ?? Array(24).fill(0))];
    slots[new Date().getHours()] += 1;
    hours[key] = slots;
    const perf = {...state.perf};
    const row = perf[key] ?? {ms: 0, timed: 0, errors: 0};
    perf[key] = meta?.ms ? {...row, ms: row.ms + meta.ms, timed: row.timed + 1} : row;
    set({days: keepRecent({...state.days, [key]: today}), models: keepRecent(models), hours: keepRecent(hours), perf: keepRecent(perf)});
  },
  recordError: () => {
    const key = dayKey();
    const perf = {...get().perf};
    const row = perf[key] ?? {ms: 0, timed: 0, errors: 0};
    perf[key] = {...row, errors: row.errors + 1};
    set({perf: keepRecent(perf)});
  },
  markBudgetAlerted: day => set({budgetAlerted: day}),
  reset: () => set({days: {}, models: {}, hours: {}, perf: {}, budgetAlerted: null}),
}), {name: 'forge.usage', storage: createJSONStorage(() => zustandStorage)}));
