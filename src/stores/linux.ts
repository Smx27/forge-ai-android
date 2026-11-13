import {create} from 'zustand';
import {forgeNative} from '../native';
import {installLinux, type InstallStage} from '../engine/linux';

interface LinuxState {
  checked: boolean;
  runtime: boolean;
  installed: boolean;
  release: string | null;
  installing: boolean;
  stage: InstallStage | null;
  progress: number;
  detail: string;
  error: string | null;
  refresh: () => Promise<void>;
  install: () => Promise<void>;
  uninstall: () => Promise<void>;
}

export const useLinux = create<LinuxState>((set, get) => ({
  checked: false, runtime: false, installed: false, release: null, installing: false, stage: null, progress: 0, detail: '', error: null,
  refresh: async () => {
    try {
      const status = await forgeNative.linuxStatus();
      set({checked: true, runtime: status.runtime, installed: status.installed, release: status.release});
    } catch { set({checked: true}); }
  },
  install: async () => {
    if (get().installing) return;
    set({installing: true, error: null, stage: 'resolving', progress: 0, detail: ''});
    try {
      await installLinux((stage, progress, detail) => set({stage, progress, detail: detail ?? ''}));
      await get().refresh();
      await (require('../engine/git') as typeof import('../engine/git')).applyGitConfig().catch(() => undefined);
    } catch (error) {
      set({error: error instanceof Error ? error.message : String(error)});
    } finally { set({installing: false}); }
  },
  uninstall: async () => {
    await forgeNative.remove(forgeNative.rootfsDir.replace(/\/rootfs$/, ''));
    set({installed: false, release: null, stage: null});
  },
}));
