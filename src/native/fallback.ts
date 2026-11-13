import type {DirEntry, ForgeNativeApi} from './index';

export function createFallback(): ForgeNativeApi {
  const files = new Map<string, string>();
  const dirs = new Set<string>(['/data', '/data/workspace', '/data/models', '/data/cache']);
  const secure = new Map<string, string>();
  const parent = (path: string) => path.replace(/\/[^/]+$/, '') || '/';
  const ensure = (path: string) => { let current = path; while (current && current !== '/' && !dirs.has(current)) { dirs.add(current); current = parent(current); } };
  const entries = (path: string): DirEntry[] => {
    const prefix = path.endsWith('/') ? path : path + '/';
    const seen = new Map<string, DirEntry>();
    for (const dir of dirs) if (dir.startsWith(prefix) && !dir.slice(prefix.length).includes('/') && dir !== path) seen.set(dir, {name: dir.slice(prefix.length), path: dir, isDir: true, size: 0, mtime: Date.now()});
    for (const [file, content] of files) if (file.startsWith(prefix) && !file.slice(prefix.length).includes('/')) seen.set(file, {name: file.slice(prefix.length), path: file, isDir: false, size: content.length, mtime: Date.now()});
    return [...seen.values()].sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  };
  const unavailable = () => Promise.reject(new Error('This feature needs the Android app.'));
  return {
    filesDir: '/data', cacheDir: '/data/cache', workspaceDir: '/data/workspace', rootfsDir: '/data/linux/rootfs', modelsDir: '/data/models',
    abi: 'web', sdkInt: 0, device: 'Browser preview', appVersion: '4.0.0', storageKey: '', storageKeyFresh: false,
    readFile: async path => { const value = files.get(path); if (value === undefined) throw new Error('File not found'); return value; },
    writeFile: async (path, content) => { ensure(parent(path)); files.set(path, content); return true; },
    listDir: async path => entries(path),
    stat: async path => files.has(path) ? {isDir: false, size: files.get(path)!.length, mtime: Date.now()} : dirs.has(path) ? {isDir: true, size: 0, mtime: Date.now()} : null,
    mkdir: async path => { ensure(path); return true; },
    remove: async path => { files.delete(path); for (const key of [...files.keys()]) if (key.startsWith(path + '/')) files.delete(key); for (const dir of [...dirs]) if (dir === path || dir.startsWith(path + '/')) dirs.delete(dir); return true; },
    rename: async (from, to) => { const value = files.get(from); if (value !== undefined) { files.delete(from); ensure(parent(to)); files.set(to, value); } return true; },
    dirSize: async path => [...files].filter(([key]) => key.startsWith(path)).reduce((sum, [, value]) => sum + value.length, 0),
    storageInfo: async () => ({free: 48e9, total: 128e9, ramAvailable: 3.2e9, ramTotal: 8e9}),
    download: unavailable, cancelDownload: async () => true, extractTarGz: unavailable,
    linuxStatus: async () => ({runtime: false, installed: false, release: null}),
    exec: unavailable, kill: async () => true,
    secureSet: async (key, value) => { secure.set(key, value); return true; },
    secureGet: async key => secure.get(key) ?? null,
    secureDelete: async key => secure.delete(key),
    secureClear: async () => { secure.clear(); return true; },
    setAgentService: async () => false,
    copyText: async text => { try { await (globalThis as any).navigator?.clipboard?.writeText(text); } catch {} return true; },
    pickImage: unavailable, readBase64: unavailable,
    copyFile: async (from, to) => { const value = files.get(from); if (value === undefined) throw new Error('File not found'); ensure(parent(to)); files.set(to, value); return true; },
    zipDir: unavailable, unzip: unavailable, saveDocument: unavailable, openDocument: unavailable,
    encryptFile: unavailable, decryptFile: unavailable, notify: async () => false, spawn: unavailable,
  };
}
