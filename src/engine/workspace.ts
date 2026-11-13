import {forgeNative} from '../native';

export const WORKSPACE = forgeNative.workspaceDir;

export function resolveWorkspacePath(relative: string | undefined): string {
  const cleaned = String(relative ?? '').trim().replace(/^\/root\/workspace\/?/, '').replace(/^\.\/?/, '');
  const parts: string[] = [];
  for (const part of cleaned.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') throw new Error('Paths must stay inside the workspace.');
    parts.push(part);
  }
  return parts.length ? `${WORKSPACE}/${parts.join('/')}` : WORKSPACE;
}

export function toRelative(absolute: string): string {
  return absolute.startsWith(WORKSPACE) ? absolute.slice(WORKSPACE.length).replace(/^\//, '') || '.' : absolute;
}

export async function listTree(relative = '', depth = 2, limit = 300): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, level: number) => {
    if (out.length >= limit) return;
    let entries;
    try { entries = await forgeNative.listDir(dir); } catch { return; }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (entry.name === 'node_modules' || entry.name === '.git') { out.push(toRelative(entry.path) + '/ (skipped)'); continue; }
      out.push(toRelative(entry.path) + (entry.isDir ? '/' : `  (${entry.size} B)`));
      if (entry.isDir && level < depth) await walk(entry.path, level + 1);
    }
  };
  await walk(resolveWorkspacePath(relative), 1);
  return out;
}

export async function readText(relative: string): Promise<string> {
  return forgeNative.readFile(resolveWorkspacePath(relative));
}

export async function writeText(relative: string, content: string): Promise<void> {
  await forgeNative.writeFile(resolveWorkspacePath(relative), content);
}

export async function exists(relative: string): Promise<boolean> {
  return !!(await forgeNative.stat(resolveWorkspacePath(relative)));
}
