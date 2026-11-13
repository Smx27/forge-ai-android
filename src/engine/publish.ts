import {forgeNative} from '../native';
import {useSettings} from '../stores/settings';
import {completeOnce} from './agent';
import {applyGitConfig} from './git';
import {guestPath, runInLinux} from './linux';
import {WORKSPACE, toRelative} from './workspace';

export interface ProjectInfo {
  dir: string;
  folder: string;
  files: string[];
  hasGitignore: boolean;
  stacks: string[];
  sensitive: string[];
  heavy: string[];
  manifests: Record<string, string>;
  readme: string;
}

export interface RepoDraft {
  name: string;
  description: string;
  topics: string[];
  gitignore: string | null;
  source: 'ai' | 'project';
  note?: string;
}

const SKIP = new Set(['.git', 'node_modules', '.gradle', 'build', 'dist', 'out', 'target', '.next', '.nuxt', 'venv', '.venv', 'env', '__pycache__', 'Pods', '.dart_tool', '.idea', '.vscode', 'coverage', '.cache', '.expo']);
const MANIFESTS = ['package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'pubspec.yaml', 'composer.json', 'Gemfile', 'Package.swift', 'CMakeLists.txt', 'app.json'];
const SENSITIVE = [/(^|\/)\.env(\.[^/]*)?$/, /\.(jks|keystore|p12|pfx|pem|key)$/i, /(^|\/)google-services\.json$/, /(^|\/)GoogleService-Info\.plist$/, /(^|\/)id_(rsa|ed25519|ecdsa)$/, /(^|\/)(credentials|service-account[^/]*|secrets?)\.json$/i, /(^|\/)\.npmrc$/, /(^|\/)keystore\.properties$/];
const SAFE_EXAMPLE = /\.(example|sample|template|dist)$/i;

export async function importZipProject(): Promise<string | null> {
  const picked = await forgeNative.openDocument(['application/zip', 'application/x-zip-compressed', 'application/octet-stream']);
  if (!picked) return null;
  if (!/\.zip$/i.test(picked.name)) throw new Error('Choose a .zip archive with your source code.');
  const base = picked.name.replace(/\.zip$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'project';
  await forgeNative.mkdir(WORKSPACE);
  let target = WORKSPACE + '/' + base;
  for (let index = 2; await forgeNative.stat(target); index++) target = WORKSPACE + '/' + base + '-' + index;
  try { await forgeNative.unzip(picked.path, target); } finally { await forgeNative.remove(picked.path).catch(() => undefined); }
  await forgeNative.remove(target + '/__MACOSX').catch(() => undefined);
  const entries = await forgeNative.listDir(target);
  if (entries.length === 1 && entries[0].isDir) {
    const moved = target + '.unwrap';
    await forgeNative.rename(entries[0].path, moved);
    await forgeNative.remove(target);
    await forgeNative.rename(moved, target);
  }
  return target;
}

export async function inspectProject(dir: string): Promise<ProjectInfo> {
  const files: string[] = [];
  const heavy = new Set<string>();
  const walk = async (path: string, prefix: string, depth: number) => {
    let entries;
    try { entries = await forgeNative.listDir(path); } catch { return; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix + entry.name;
      if (entry.isDir && SKIP.has(entry.name)) { heavy.add(entry.name); continue; }
      if (files.length < 600) files.push(rel + (entry.isDir ? '/' : ''));
      if (entry.isDir && depth < 5) await walk(entry.path, rel + '/', depth + 1);
    }
  };
  await walk(dir, '', 1);
  const manifests: Record<string, string> = {};
  for (const name of MANIFESTS) {
    const path = files.find(file => file === name || (file.endsWith('/' + name) && file.split('/').length <= 3));
    if (path) manifests[path] = (await forgeNative.readFile(dir + '/' + path).catch(() => '')).slice(0, 1500);
  }
  const readmePath = files.find(file => /^readme(\.(md|rst|txt))?$/i.test(file));
  const readme = readmePath ? (await forgeNative.readFile(dir + '/' + readmePath).catch(() => '')).slice(0, 1500) : '';
  const has = (test: RegExp) => files.some(file => test.test(file));
  const stacks = [
    has(/(^|\/)package\.json$/) && 'node',
    has(/\.tsx?$/) && 'typescript',
    has(/(^|\/)(pyproject\.toml|requirements\.txt|setup\.py)$|\.py$/) && 'python',
    has(/(^|\/)(build\.gradle(\.kts)?|settings\.gradle(\.kts)?)$/) && 'gradle',
    has(/AndroidManifest\.xml$/) && 'android',
    has(/(^|\/)app\.json$/) && has(/(^|\/)package\.json$/) && Object.values(manifests).some(text => /react-native|expo/.test(text)) && 'react-native',
    has(/(^|\/)pom\.xml$/) && 'maven',
    has(/(^|\/)Cargo\.toml$/) && 'rust',
    has(/(^|\/)go\.mod$/) && 'go',
    has(/(^|\/)pubspec\.yaml$/) && 'flutter',
    has(/\.(swift|xcodeproj\/)$/) && 'ios',
    has(/(^|\/)composer\.json$/) && 'php',
    has(/(^|\/)Gemfile$/) && 'ruby',
    has(/\.(c|cpp|cc|h|hpp)$/) && 'c-cpp',
    has(/\.html?$/) && 'web',
  ].filter(Boolean) as string[];
  return {
    dir, folder: dir.split('/').pop() || 'project', files, heavy: [...heavy], stacks, manifests, readme,
    hasGitignore: files.includes('.gitignore'),
    sensitive: files.filter(file => !file.endsWith('/') && !SAFE_EXAMPLE.test(file) && SENSITIVE.some(test => test.test(file))),
  };
}

const TEMPLATES: Record<string, string[]> = {
  base: ['# OS and editors', '.DS_Store', 'Thumbs.db', '.idea/', '.vscode/', '*.swp', '', '# Secrets', '.env', '.env.*', '!.env.example', '*.pem', '*.key', '', '# Logs', '*.log'],
  node: ['', '# Node', 'node_modules/', 'npm-debug.log*', 'yarn-error.log*', '.pnpm-store/', 'dist/', 'build/', 'coverage/', '.next/', '.expo/'],
  python: ['', '# Python', '__pycache__/', '*.py[cod]', '.venv/', 'venv/', 'env/', '*.egg-info/', '.pytest_cache/', '.mypy_cache/', 'dist/', 'build/'],
  gradle: ['', '# Gradle / Android', '.gradle/', 'build/', 'local.properties', '*.iml', 'captures/', '.externalNativeBuild/', '.cxx/', '*.apk', '*.aab', '*.jks', '*.keystore', 'keystore.properties'],
  ios: ['', '# Xcode', 'DerivedData/', 'Pods/', 'xcuserdata/', '*.xcuserstate'],
  maven: ['', '# Maven', 'target/'],
  rust: ['', '# Rust', 'target/'],
  go: ['', '# Go', 'bin/', '*.exe', '*.test', 'vendor/'],
  flutter: ['', '# Flutter', '.dart_tool/', '.flutter-plugins*', 'build/', '.packages'],
  php: ['', '# PHP', 'vendor/'],
  ruby: ['', '# Ruby', '.bundle/', 'vendor/bundle/'],
  'c-cpp': ['', '# C / C++', '*.o', '*.obj', '*.so', '*.a', 'cmake-build-*/'],
};

function templateGitignore(info: ProjectInfo): string {
  const lines = [...TEMPLATES.base];
  for (const stack of info.stacks) if (TEMPLATES[stack]) lines.push(...TEMPLATES[stack]);
  return secureGitignore(lines.join('\n'), info);
}

function secureGitignore(text: string, info: ProjectInfo): string {
  const present = new Set(text.split('\n').map(line => line.trim()));
  const extra = info.sensitive.filter(file => !present.has(file) && !present.has('/' + file));
  const heavy = info.heavy.filter(name => name !== '.git' && !present.has(name + '/') && !present.has(name) && !present.has('/' + name + '/'));
  let result = text.trim();
  if (extra.length) result += '\n\n# Secrets found in this project\n' + extra.join('\n');
  if (heavy.length) result += '\n\n# Generated folders\n' + heavy.map(name => name + '/').join('\n');
  return result + '\n';
}

export function slugify(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 100) || 'my-project';
}

export function cleanTopics(values: string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const topic = value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
    if (topic) seen.add(topic);
  }
  return [...seen].slice(0, 20);
}

function fallbackDraft(info: ProjectInfo, note: string): RepoDraft {
  const pkg = Object.entries(info.manifests).find(([path]) => path.endsWith('package.json'))?.[1];
  let description = '';
  try { description = pkg ? JSON.parse(pkg).description ?? '' : ''; } catch {}
  if (!description) description = info.readme.split('\n').map(line => line.trim()).find(line => line && !/^[#=\-!\[<]/.test(line)) ?? '';
  return {
    name: slugify(info.folder),
    description: description.slice(0, 350),
    topics: cleanTopics(info.stacks),
    gitignore: info.hasGitignore ? null : templateGitignore(info),
    source: 'project',
    note,
  };
}

export async function draftRepoDetails(info: ProjectInfo, signal?: AbortSignal): Promise<RepoDraft> {
  const manifests = Object.entries(info.manifests).map(([path, text]) => '--- ' + path + '\n' + text).join('\n\n');
  const prompt = [
    'Folder name: ' + info.folder,
    'Detected stacks: ' + (info.stacks.join(', ') || 'unknown'),
    'Has .gitignore: ' + (info.hasGitignore ? 'yes' : 'no'),
    info.sensitive.length ? 'Files that look like secrets: ' + info.sensitive.join(', ') : '',
    info.heavy.length ? 'Generated or dependency folders present: ' + info.heavy.join(', ') : '',
    '', 'File tree (truncated):', info.files.slice(0, 250).join('\n'),
    '', 'Manifests:', manifests || '(none)',
    '', 'README (start):', info.readme || '(none)',
  ].filter(line => line !== null).join('\n');
  const system = 'You prepare a source-code project for publishing on GitHub. Reply with one JSON object and nothing else, with these keys: ' +
    '"name": a short GitHub repository name in kebab-case; ' +
    '"description": one plain sentence under 300 characters saying what the project is and does, no emoji, no marketing words; ' +
    '"topics": 5 to 10 GitHub topics, lowercase, letters, digits and hyphens only, about the language, framework, platform and purpose; ' +
    '"gitignore": ' + (info.hasGitignore ? 'null, because the project already has one.' : 'the full text of a .gitignore for exactly this stack, covering dependencies, build output, IDE files, logs and every secret file listed. Only real patterns, short comments allowed.');
  try {
    const text = await completeOnce(system, prompt, signal);
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as {name?: string; description?: string; topics?: string[]; gitignore?: string | null};
    const fallback = fallbackDraft(info, '');
    const gitignore = info.hasGitignore ? null : typeof parsed.gitignore === 'string' && parsed.gitignore.trim() ? secureGitignore(parsed.gitignore, info) : fallback.gitignore;
    return {
      name: slugify(parsed.name || info.folder),
      description: String(parsed.description || fallback.description).replace(/\s+/g, ' ').trim().slice(0, 350),
      topics: cleanTopics(Array.isArray(parsed.topics) && parsed.topics.length ? parsed.topics : info.stacks),
      gitignore,
      source: 'ai',
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    return fallbackDraft(info, 'The AI could not answer (' + reason.slice(0, 160) + '), so these were filled in from the project files.');
  }
}

async function github<T>(path: string, token: string, init: {method: string; body?: unknown}): Promise<{status: number; data: T}> {
  const response = await fetch('https://api.github.com' + path, {
    method: init.method,
    headers: {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'},
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = {message: text.slice(0, 200)}; }
  return {status: response.status, data};
}

const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";

export interface PublishResult {url: string; fullName: string; warnings: string[]}

export async function publishToGitHub(info: ProjectInfo, draft: RepoDraft & {isPrivate: boolean}, onLog: (line: string) => void): Promise<PublishResult> {
  const token = await forgeNative.secureGet('github.token');
  const login = useSettings.getState().githubLogin;
  if (!token || !login) throw new Error('Connect your GitHub account first.');
  const name = slugify(draft.name);
  const warnings: string[] = [];

  if (!info.hasGitignore && draft.gitignore?.trim()) {
    await forgeNative.writeFile(info.dir + '/.gitignore', draft.gitignore.trim() + '\n');
    onLog('Wrote .gitignore');
  }

  onLog('Creating ' + (draft.isPrivate ? 'private' : 'public') + ' repository ' + login + '/' + name + ' …');
  const created = await github<{html_url: string; clone_url: string; full_name: string; message?: string; errors?: {message?: string}[]}>('/user/repos', token, {
    method: 'POST', body: {name, description: draft.description.slice(0, 350), private: draft.isPrivate, has_issues: true, auto_init: false},
  });
  if (created.status === 422) {
    const detail = created.data.errors?.map(item => item.message).filter(Boolean).join(' ') || created.data.message || '';
    throw new Error(/already exists/i.test(detail) ? 'You already have a repository named ' + name + '. Pick another name.' : 'GitHub refused the repository: ' + detail);
  }
  if (created.status === 401) throw new Error('GitHub rejected the token. Reconnect GitHub in Settings → Git and GitHub.');
  if (created.status === 403 || created.status === 404) throw new Error('This token cannot create repositories. On GitHub, edit the token and allow Administration: Read and write and Contents: Read and write for all repositories (or use a classic token with the repo scope), then try again.');
  if (created.status >= 300) throw new Error('GitHub answered HTTP ' + created.status + ': ' + (created.data.message ?? ''));
  const {full_name: fullName, html_url: url, clone_url: cloneUrl} = created.data;
  onLog('Created ' + url);

  if (draft.topics.length) {
    const topics = await github('/repos/' + fullName + '/topics', token, {method: 'PUT', body: {names: cleanTopics(draft.topics)}});
    if (topics.status >= 300) warnings.push('The topics could not be saved (HTTP ' + topics.status + '). Add them on the repository page.');
    else onLog('Added topics: ' + cleanTopics(draft.topics).join(', '));
  }

  await applyGitConfig();
  const path = guestPath(toRelative(info.dir));
  const script = [
    'command -v git >/dev/null 2>&1 || apk add --no-progress git >/dev/null 2>&1 || { echo "Could not install git. Run apk update in the terminal first."; exit 1; }',
    'cd ' + quote(path) + ' || exit 1',
    '[ -d .git ] || git init -q -b main',
    'git add -A || exit 1',
    'echo "Files to push: $(git diff --cached --name-only | wc -l)"',
    'if ! git rev-parse -q --verify HEAD >/dev/null || ! git diff --cached --quiet; then git commit -q -m ' + quote('Initial commit') + ' || exit 1; fi',
    'REMOTE=origin; if git remote get-url origin >/dev/null 2>&1; then REMOTE=github; git remote remove github >/dev/null 2>&1; fi',
    'git remote add "$REMOTE" ' + quote(cloneUrl) + ' || exit 1',
    'BRANCH=$(git symbolic-ref --short HEAD)',
    'git push --progress -u "$REMOTE" "$BRANCH" 2>&1',
  ].join('\n');
  const result = await runInLinux(script, {onData: chunk => onLog(chunk.replace(/\r/g, '\n').trimEnd()), timeoutMs: 20 * 60 * 1000});
  if (result.exitCode !== 0) throw new Error('The repository was created, but the push failed. See the log below. You can fix it in the terminal and run git push again from ' + path + '.');
  onLog('Pushed to ' + url);
  return {url, fullName, warnings};
}
