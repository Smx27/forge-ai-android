import {forgeNative} from '../native';
import {useSettings} from '../stores/settings';
import {runInLinux} from './linux';

const TOKEN_KEY = 'github.token';

export async function verifyGitHubToken(token: string): Promise<{login: string; name: string | null; email: string | null}> {
  const response = await fetch('https://api.github.com/user', {headers: {Authorization: `Bearer ${token.trim()}`, Accept: 'application/vnd.github+json'}});
  if (response.status === 401) throw new Error('GitHub rejected this token. Check that you copied all of it and that it has not expired.');
  if (!response.ok) throw new Error(`GitHub answered HTTP ${response.status}. Try again in a moment.`);
  const user = await response.json();
  return {login: user.login, name: user.name ?? null, email: user.email ?? null};
}

export async function connectGitHub(token: string): Promise<string> {
  const user = await verifyGitHubToken(token);
  await forgeNative.secureSet(TOKEN_KEY, token.trim());
  const settings = useSettings.getState();
  settings.set({githubLogin: user.login, gitName: settings.gitName || user.name || user.login, gitEmail: settings.gitEmail || user.email || `${user.login}@users.noreply.github.com`});
  await applyGitConfig();
  return user.login;
}

export async function disconnectGitHub(): Promise<void> {
  await forgeNative.secureDelete(TOKEN_KEY);
  useSettings.getState().set({githubLogin: null});
  await applyGitConfig();
}

export async function applyGitConfig(): Promise<void> {
  const status = await forgeNative.linuxStatus().catch(() => null);
  if (!status?.installed) return;
  const {gitName, gitEmail, githubLogin} = useSettings.getState();
  const home = `${forgeNative.rootfsDir}/root`;
  const clean = (value: string) => value.replace(/[\n\r"\\]/g, '').trim();
  const lines = ['[init]', '\tdefaultBranch = main', '[safe]', '\tdirectory = *', '[pull]', '\trebase = false'];
  if (gitName || gitEmail) lines.push('[user]', ...(gitName ? [`\tname = ${clean(gitName)}`] : []), ...(gitEmail ? [`\temail = ${clean(gitEmail)}`] : []));
  const token = githubLogin ? await forgeNative.secureGet(TOKEN_KEY) : null;
  if (token) lines.push('[credential]', '\thelper = store');
  await forgeNative.writeFile(`${home}/.gitconfig`, lines.join('\n') + '\n');
  if (token && githubLogin) await forgeNative.writeFile(`${home}/.git-credentials`, `https://${encodeURIComponent(githubLogin)}:${encodeURIComponent(token)}@github.com\n`);
  else await forgeNative.remove(`${home}/.git-credentials`).catch(() => undefined);
}

export function repoFolder(url: string): string {
  return url.replace(/\.git$/, '').replace(/\/+$/, '').split('/').pop() || 'repo';
}

export async function cloneRepository(url: string, onData: (chunk: string) => void, signal?: AbortSignal): Promise<{ok: boolean; folder: string; output: string}> {
  const clean = url.trim();
  if (!/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9._\/-]+$/.test(clean)) throw new Error('Use an HTTPS link like https://github.com/owner/repo');
  await applyGitConfig();
  const folder = repoFolder(clean);
  const result = await runInLinux(`command -v git >/dev/null 2>&1 || apk add --no-progress git >/dev/null 2>&1 || { echo "Could not install git. Run apk update first."; exit 1; }
git clone --progress '${clean}' 2>&1`, {onData, signal, timeoutMs: 15 * 60 * 1000});
  return {ok: result.exitCode === 0, folder, output: result.output};
}
