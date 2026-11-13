import {forgeNative} from '../native';
import {useCheckpoints} from '../stores/checkpoints';

const root = (chatId: string) => `${forgeNative.filesDir}/checkpoints/${chatId}`;
const busy = new Map<string, Promise<void>>();

export async function captureBefore(chatId: string, turnId: string, path: string): Promise<void> {
  const key = `${chatId}:${turnId}:${path}`;
  const running = busy.get(key);
  if (running) return running;
  const work = (async () => {
    const turn = (useCheckpoints.getState().byChat[chatId] ?? []).find(item => item.turnId === turnId);
    if (turn?.entries.some(entry => entry.path === path || ((entry.kind === 'dir' || entry.kind === 'none') && path.startsWith(entry.path + '/')))) return;
    const stat = await forgeNative.stat(path);
    const store = useCheckpoints.getState();
    if (!stat) { store.add(chatId, turnId, {path, kind: 'none'}); return; }
    const backup = `${root(chatId)}/${turnId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (stat.isDir) { await forgeNative.zipDir(path, backup + '.zip'); store.add(chatId, turnId, {path, kind: 'dir', backup: backup + '.zip'}); }
    else { await forgeNative.copyFile(path, backup); store.add(chatId, turnId, {path, kind: 'file', backup}); }
  })();
  busy.set(key, work);
  try { await work; } finally { busy.delete(key); }
}

export function changesSince(chatId: string, turnId: string): {turns: number; files: number} {
  const list = useCheckpoints.getState().byChat[chatId] ?? [];
  const index = list.findIndex(item => item.turnId === turnId);
  if (index < 0) return {turns: 0, files: 0};
  const later = list.slice(index);
  return {turns: later.length, files: later.reduce((sum, item) => sum + item.entries.length, 0)};
}

export async function restoreSince(chatId: string, turnId: string): Promise<number> {
  const list = useCheckpoints.getState().byChat[chatId] ?? [];
  const index = list.findIndex(item => item.turnId === turnId);
  if (index < 0) return 0;
  const later = list.slice(index).reverse();
  let restored = 0;
  for (const checkpoint of later) {
    for (const entry of [...checkpoint.entries].reverse()) {
      if (entry.kind === 'none') await forgeNative.remove(entry.path).catch(() => undefined);
      else if (entry.kind === 'file' && entry.backup) await forgeNative.copyFile(entry.backup, entry.path);
      else if (entry.kind === 'dir' && entry.backup) { await forgeNative.remove(entry.path).catch(() => undefined); await forgeNative.unzip(entry.backup, entry.path); }
      restored++;
    }
    await forgeNative.remove(`${root(chatId)}/${checkpoint.turnId}`).catch(() => undefined);
  }
  useCheckpoints.getState().drop(chatId, later.map(item => item.turnId));
  return restored;
}

export async function discardChat(chatId: string) {
  useCheckpoints.getState().dropChat(chatId);
  await forgeNative.remove(root(chatId)).catch(() => undefined);
}
