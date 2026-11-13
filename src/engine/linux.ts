import {forgeNative, onNativeEvent, type ExecResult} from '../native';

export interface RootfsRelease {version: string; file: string; url: string; sha256: string; size: number}

function alpineArch(): string {
  if (forgeNative.abi.startsWith('arm64')) return 'aarch64';
  if (forgeNative.abi.startsWith('x86_64')) return 'x86_64';
  if (forgeNative.abi.startsWith('armeabi')) return 'armv7';
  throw new Error(`Unsupported processor: ${forgeNative.abi}`);
}

export async function resolveAlpine(): Promise<RootfsRelease> {
  const arch = alpineArch();
  const base = `https://dl-cdn.alpinelinux.org/alpine/latest-stable/releases/${arch}`;
  const response = await fetch(`${base}/latest-releases.yaml`);
  if (!response.ok) throw new Error('Could not reach the Alpine Linux mirror.');
  const yaml = await response.text();
  const entry = yaml.split(/\n-\n/).find(block => /flavor:\s*alpine-minirootfs/.test(block));
  if (!entry) throw new Error('The mirror did not list a mini root filesystem.');
  const field = (name: string) => entry.match(new RegExp(`\\n\\s*${name}:\\s*(.+)`))?.[1].trim() ?? '';
  const file = field('file');
  return {version: field('version'), file, url: `${base}/${file}`, sha256: field('sha256'), size: Number(field('size')) || 0};
}

export type InstallStage = 'resolving' | 'downloading' | 'verifying' | 'extracting' | 'configuring' | 'done';

export async function installLinux(onStage: (stage: InstallStage, progress: number, detail?: string) => void): Promise<string> {
  onStage('resolving', 0);
  const release = await resolveAlpine();
  const archive = `${forgeNative.cacheDir}/${release.file}`;
  const off = onNativeEvent('ForgeDownload', event => {
    if (event.id === 'rootfs' && event.total > 0) onStage('downloading', event.received / event.total, `${(event.received / 1e6).toFixed(1)} of ${(event.total / 1e6).toFixed(1)} MB`);
  });
  try {
    onStage('downloading', 0, `Alpine Linux ${release.version}`);
    await forgeNative.download('rootfs', release.url, archive, release.sha256 || null);
  } finally { off(); }
  onStage('extracting', 0);
  const offExtract = onNativeEvent('ForgeExtract', event => onStage('extracting', Math.min(0.95, event.files / 500), `${event.files} files`));
  try { await forgeNative.extractTarGz(archive, forgeNative.rootfsDir); } finally { offExtract(); }
  await forgeNative.remove(archive).catch(() => undefined);
  onStage('configuring', 0.5);
  const root = forgeNative.rootfsDir;
  await forgeNative.writeFile(`${root}/etc/resolv.conf`, 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n');
  await forgeNative.writeFile(`${root}/etc/hosts`, '127.0.0.1 localhost\n::1 localhost\n');
  await forgeNative.writeFile(`${root}/etc/profile.d/forge.sh`, 'export PS1="forge:\\w$ "\nexport EDITOR=vi\nalias ll="ls -la"\n');
  await forgeNative.mkdir(`${root}/root/workspace`);
  await forgeNative.mkdir(`${root}/tmp`);
  const check = await forgeNative.exec(`probe-${Date.now()}`, 'cat /etc/alpine-release && uname -m', {timeoutMs: 30000});
  if (check.exitCode !== 0) throw new Error(`Linux started but failed a self-test: ${check.output.slice(-300)}`);
  onStage('done', 1, check.output.trim().split('\n')[0]);
  return release.version;
}

export const DEV_PACKAGES = 'bash git nodejs npm python3 py3-pip curl openssh-client build-base';

let execCounter = 0;

export async function runInLinux(command: string, options: {cwd?: string; timeoutMs?: number; onData?: (chunk: string) => void; env?: Record<string, string>; signal?: AbortSignal} = {}): Promise<ExecResult> {
  const id = `exec-${Date.now()}-${++execCounter}`;
  const off = options.onData ? onNativeEvent('ForgeExec', event => { if (event.id === id) options.onData?.(event.data); }) : () => undefined;
  const abort = () => { void forgeNative.kill(id); };
  options.signal?.addEventListener('abort', abort);
  try {
    return await forgeNative.exec(id, command, {cwd: options.cwd, timeoutMs: options.timeoutMs ?? 120000, env: options.env});
  } finally {
    off();
    options.signal?.removeEventListener('abort', abort);
  }
}

export function guestPath(relative: string): string {
  const clean = relative.replace(/^\/+/, '').replace(/^\.$/, '');
  return clean ? `/root/workspace/${clean}` : '/root/workspace';
}
