import {create} from 'zustand';
import {forgeNative, onNativeEvent} from '../native';

export interface Proc {id: string; command: string; cwd: string; startedAt: number; output: string; running: boolean; exitCode?: number; port?: number}

interface ProcState {
  procs: Proc[];
  start: (command: string, cwd: string, port?: number) => Promise<Proc>;
  stop: (id: string) => Promise<void>;
  stopAll: () => Promise<void>;
  clear: (id: string) => void;
}

const PORT = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d{2,5})|port\s+(\d{2,5})/i;
let counter = 0;
let wired = false;

function wire() {
  if (wired) return;
  wired = true;
  onNativeEvent('ForgeExec', event => {
    if (!String(event.id).startsWith('proc-')) return;
    useProcs.setState(state => ({procs: state.procs.map(proc => {
      if (proc.id !== event.id) return proc;
      const output = (proc.output + event.data).slice(-20000);
      const match = proc.port ? null : output.match(PORT);
      return {...proc, output, port: proc.port ?? (match ? Number(match[1] ?? match[2]) : undefined)};
    })}));
  });
  onNativeEvent('ForgeProcExit', event => {
    useProcs.setState(state => ({procs: state.procs.map(proc => proc.id === event.id ? {...proc, running: false, exitCode: event.exitCode} : proc)}));
  });
}

export const useProcs = create<ProcState>((set, get) => ({
  procs: [],
  start: async (command, cwd, port) => {
    wire();
    const proc: Proc = {id: `proc-${Date.now()}-${++counter}`, command, cwd, startedAt: Date.now(), output: '', running: true, port};
    set({procs: [proc, ...get().procs.filter(item => item.running).slice(0, 7)]});
    try { await forgeNative.spawn(proc.id, command, {cwd}); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({procs: get().procs.map(item => item.id === proc.id ? {...item, running: false, exitCode: -1, output: message} : item)});
    }
    return get().procs.find(item => item.id === proc.id) ?? proc;
  },
  stop: async id => { await forgeNative.kill(id).catch(() => undefined); },
  stopAll: async () => { await Promise.all(get().procs.filter(proc => proc.running).map(proc => forgeNative.kill(proc.id).catch(() => undefined))); },
  clear: id => set({procs: get().procs.filter(proc => proc.id !== id)}),
}));
