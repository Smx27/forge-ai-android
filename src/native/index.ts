import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {createFallback} from './fallback';

export interface DirEntry {name: string; path: string; isDir: boolean; size: number; mtime: number}
export interface ExecResult {exitCode: number; timedOut: boolean; output: string}
export interface ExecOptions {cwd?: string; timeoutMs?: number; env?: Record<string, string>}
export interface StorageInfo {free: number; total: number; ramAvailable: number; ramTotal: number}

export interface ForgeNativeApi {
  filesDir: string; cacheDir: string; workspaceDir: string; rootfsDir: string; modelsDir: string;
  abi: string; sdkInt: number; device: string; appVersion: string; storageKey: string; storageKeyFresh: boolean;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<boolean>;
  listDir(path: string): Promise<DirEntry[]>;
  stat(path: string): Promise<{isDir: boolean; size: number; mtime: number} | null>;
  mkdir(path: string): Promise<boolean>;
  remove(path: string): Promise<boolean>;
  rename(from: string, to: string): Promise<boolean>;
  dirSize(path: string): Promise<number>;
  storageInfo(): Promise<StorageInfo>;
  download(id: string, url: string, dest: string, sha256: string | null): Promise<string>;
  cancelDownload(id: string): Promise<boolean>;
  extractTarGz(archive: string, dest: string): Promise<number>;
  linuxStatus(): Promise<{runtime: boolean; installed: boolean; release: string | null}>;
  exec(id: string, command: string, options: ExecOptions): Promise<ExecResult>;
  kill(id: string): Promise<boolean>;
  secureSet(key: string, value: string): Promise<boolean>;
  secureGet(key: string): Promise<string | null>;
  secureDelete(key: string): Promise<boolean>;
  secureClear(): Promise<boolean>;
  setAgentService(active: boolean, title: string): Promise<boolean>;
  copyText(text: string): Promise<boolean>;
  pickImage(): Promise<{path: string; width: number; height: number} | null>;
  readBase64(path: string): Promise<string>;
  copyFile(from: string, to: string): Promise<boolean>;
  zipDir(source: string, dest: string): Promise<number>;
  unzip(archive: string, dest: string): Promise<number>;
  saveDocument(source: string, name: string, mime: string): Promise<string | null>;
  openDocument(mimes: string[]): Promise<{path: string; name: string; size: number} | null>;
  encryptFile(source: string, dest: string, password: string): Promise<boolean>;
  decryptFile(source: string, dest: string, password: string): Promise<boolean>;
  notify(title: string, body: string, chatId: string | null): Promise<boolean>;
  spawn(id: string, command: string, options: {cwd?: string; env?: Record<string, string>}): Promise<boolean>;
}

const module = NativeModules.ForgeNative as (ForgeNativeApi & {getConstants?: () => Partial<ForgeNativeApi>}) | undefined;

const METHODS = ['readFile', 'writeFile', 'listDir', 'stat', 'mkdir', 'remove', 'rename', 'dirSize', 'storageInfo', 'download', 'cancelDownload', 'extractTarGz', 'linuxStatus', 'exec', 'kill', 'secureSet', 'secureGet', 'secureDelete', 'secureClear', 'setAgentService', 'copyText', 'pickImage', 'readBase64', 'copyFile', 'zipDir', 'unzip', 'saveDocument', 'openDocument', 'encryptFile', 'decryptFile', 'notify', 'spawn'] as const;
const CONSTANTS = ['filesDir', 'cacheDir', 'workspaceDir', 'rootfsDir', 'modelsDir', 'abi', 'sdkInt', 'device', 'appVersion', 'storageKey', 'storageKeyFresh'] as const;

function bind(native: NonNullable<typeof module>): ForgeNativeApi {
  const constants: Partial<ForgeNativeApi> = typeof native.getConstants === 'function' ? native.getConstants() : {};
  const api: Record<string, unknown> = {};
  for (const name of CONSTANTS) api[name] = constants[name] ?? native[name];
  for (const name of METHODS) api[name] = (...args: unknown[]) => (native[name] as (...input: unknown[]) => Promise<unknown>)(...args);
  return api as unknown as ForgeNativeApi;
}

export const forgeNative: ForgeNativeApi = module ? bind(module) : createFallback();
export const nativeAvailable = !!module;
export const isAndroid = Platform.OS === 'android';

type Listener = (payload: any) => void;
const emitter = module ? new NativeEventEmitter(NativeModules.ForgeNative) : null;
const localListeners = new Map<string, Set<Listener>>();

export function onNativeEvent(name: 'ForgeDownload' | 'ForgeExec' | 'ForgeExtract' | 'ForgeProcExit', listener: Listener): () => void {
  if (emitter) {
    const subscription = emitter.addListener(name, listener);
    return () => subscription.remove();
  }
  const set = localListeners.get(name) ?? new Set<Listener>();
  set.add(listener);
  localListeners.set(name, set);
  return () => set.delete(listener);
}

export function emitLocal(name: string, payload: unknown) {
  localListeners.get(name)?.forEach(listener => listener(payload));
}
