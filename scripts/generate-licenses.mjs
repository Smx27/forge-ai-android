#!/usr/bin/env node
// Generates src/licenses/data.json: every open-source component that ships in the app.
//   JS:      packages that end up in the release JS bundle (read from Metro's source map)
//   Android: the app's releaseRuntimeClasspath (read from Gradle and the POM files in the Gradle cache)
//   Native:  binaries, fonts and other files bundled by hand (listed in MANUAL below)
// Run after changing dependencies:  node scripts/generate-licenses.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'src/licenses/data.json');
const SPDX = require('spdx-license-list/full');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-licenses-'));
const warnings = [];

const texts = [];
const textIndex = new Map();
function addText(text) {
  const t = text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
  if (!textIndex.has(t)) { textIndex.set(t, texts.length); texts.push(t); }
  return textIndex.get(t);
}
function canonical(id) {
  const ids = id.split(/\s+(?:OR|AND)\s+|[()]/).map((s) => s.trim()).filter(Boolean);
  const parts = ids.map((x) => SPDX[x]?.licenseText).filter(Boolean);
  if (!parts.length) { warnings.push('No canonical text for ' + id); return undefined; }
  return addText(parts.join('\n\n' + '-'.repeat(40) + '\n\n'));
}

const ALIASES = [
  [/apache.*2/i, 'Apache-2.0'], [/^mit\b|mit license/i, 'MIT'], [/bsd.*3|new bsd|revised bsd/i, 'BSD-3-Clause'],
  [/bsd.*2|simplified bsd/i, 'BSD-2-Clause'], [/^isc/i, 'ISC'], [/eclipse public license.*2/i, 'EPL-2.0'],
  [/eclipse public license.*1/i, 'EPL-1.0'], [/common development and distribution/i, 'CDDL-1.0'],
];
function spdx(name) {
  if (!name) return undefined;
  if (SPDX[name]) return name;
  for (const [re, id] of ALIASES) if (re.test(name)) return id;
  return name;
}

// Packages whose package.json has no license field; the license comes from the project's repository.
const JS_OVERRIDES = {'@tamagui/': 'MIT'};

// ---------- JS packages in the bundle ----------
function jsPackages() {
  execSync('npx react-native bundle --platform android --dev false --minify false --entry-file index.js --bundle-output ' +
    path.join(tmp, 'b.js') + ' --sourcemap-output ' + path.join(tmp, 'b.map'),
    {cwd: ROOT, stdio: 'ignore', env: {...process.env, NODE_ENV: 'production'}});
  const map = JSON.parse(fs.readFileSync(path.join(tmp, 'b.map'), 'utf8'));
  const dirs = new Map();
  for (const src of map.sources) {
    const i = src.lastIndexOf('node_modules/');
    if (i < 0) continue;
    const seg = src.slice(i + 13).split('/');
    const name = seg[0].startsWith('@') ? seg[0] + '/' + seg[1] : seg[0];
    const dir = path.resolve(ROOT, src.slice(0, i + 13) + name);
    dirs.set(dir, name);
  }
  const out = [];
  for (const [dir, name] of dirs) {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    let license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? pkg.licenses?.[0]?.type;
    license ??= Object.entries(JS_OVERRIDES).find(([k]) => name.startsWith(k))?.[1];
    const file = fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
    const notice = fs.readdirSync(dir).find((f) => /^notice(\.(md|txt))?$/i.test(f));
    let text = file ? addText(fs.readFileSync(path.join(dir, file), 'utf8')) : undefined;
    if (!license) warnings.push('No license field: ' + name);
    if (text === undefined && license) text = canonical(spdx(license));
    const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
    out.push({
      name, version: pkg.version, license: license ?? 'UNKNOWN', text,
      notice: notice ? addText(fs.readFileSync(path.join(dir, notice), 'utf8')) : undefined,
      url: cleanUrl(pkg.homepage || repo, name),
    });
  }
  return dedupeByName(out);
}
function cleanUrl(u, name) {
  if (!u) return 'https://www.npmjs.com/package/' + name;
  u = u.replace(/^git@github\.com:/, 'https://github.com/').replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git(#.*)?$/, '').replace(/^github:/, 'https://github.com/');
  if (/^[\w-]+\/[\w.-]+$/.test(u)) u = 'https://github.com/' + u;
  return u.replace(/^http:/, 'https:');
}
function dedupeByName(list) {
  const seen = new Map();
  for (const p of list) {
    const prev = seen.get(p.name);
    if (prev && !prev.version.split(', ').includes(p.version)) prev.version += ', ' + p.version;
    else if (!prev) seen.set(p.name, p);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Android libraries ----------
const GRADLE_CACHE = path.join(os.homedir(), '.gradle/caches/modules-2/files-2.1');
function findPom(g, a, v) {
  const dir = path.join(GRADLE_CACHE, g, a, v);
  if (!fs.existsSync(dir)) return undefined;
  for (const h of fs.readdirSync(dir)) {
    const f = path.join(dir, h, a + '-' + v + '.pom');
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  }
}
function tag(xml, name) { return xml.match(new RegExp('<' + name + '>\\s*([^<]*?)\\s*</' + name + '>'))?.[1]; }
function pomInfo(g, a, v, depth = 0) {
  const pom = findPom(g, a, v);
  if (!pom || depth > 5) return {};
  const block = pom.match(/<licenses>([\s\S]*?)<\/licenses>/)?.[1];
  const names = block ? [...block.matchAll(/<name>\s*([^<]+?)\s*<\/name>/g)].map((m) => m[1]) : [];
  const url = tag(pom.replace(/<parent>[\s\S]*?<\/parent>|<licenses>[\s\S]*?<\/licenses>|<developers>[\s\S]*?<\/developers>|<organization>[\s\S]*?<\/organization>|<scm>[\s\S]*?<\/scm>/g, ''), 'url');
  const scm = pom.match(/<scm>[\s\S]*?<url>\s*([^<]+?)\s*<\/url>/)?.[1];
  if (names.length) return {licenses: names, url: url || scm};
  const parent = pom.match(/<parent>([\s\S]*?)<\/parent>/)?.[1];
  if (!parent) return {url: url || scm};
  const up = pomInfo(tag(parent, 'groupId'), tag(parent, 'artifactId'), tag(parent, 'version'), depth + 1);
  return {licenses: up.licenses, url: url || scm || up.url};
}
const ANDROID_OVERRIDES = {
  'com.facebook.react': {license: 'MIT', url: 'https://github.com/facebook/react-native'},
  'com.facebook.fresco': {license: 'MIT', url: 'https://github.com/facebook/fresco'},
  'com.facebook.yoga': {license: 'MIT', url: 'https://github.com/facebook/yoga'},
  'com.facebook.fbjni': {license: 'Apache-2.0', url: 'https://github.com/facebookincubator/fbjni'},
  'com.facebook.soloader': {license: 'Apache-2.0', url: 'https://github.com/facebook/SoLoader'},
  'com.facebook.infer.annotation': {license: 'MIT', url: 'https://github.com/facebook/infer'},
  'com.parse.bolts': {license: 'BSD-3-Clause', url: 'https://github.com/BoltsFramework/Bolts-Android'},
};
function androidLibraries() {
  let tree;
  try {
    tree = execSync('./gradlew :app:dependencies --configuration releaseRuntimeClasspath -q --no-daemon',
      {cwd: path.join(ROOT, 'android'), encoding: 'utf8', maxBuffer: 64 << 20});
  } catch (e) { throw new Error('Gradle failed; run with a working Android SDK. ' + e.message); }
  const coords = new Map();
  for (const line of tree.split('\n')) {
    if (/\(c\)\s*$/.test(line) || line.includes('project :')) continue;
    const m = line.match(/--- ([\w.-]+):([\w.-]+)(?::(\S+))?(?: -> (\S+))?/);
    if (!m) continue;
    let [, g, a, v, to] = m;
    if (to?.includes(':')) [g, a, to] = to.split(':');
    const version = to ?? v;
    if (!version || version === '+') continue;
    coords.set(g + ':' + a, {g, a, v: version});
  }
  const groups = new Map();
  for (const {g, a, v} of coords.values()) {
    const ov = Object.entries(ANDROID_OVERRIDES).find(([k]) => g === k || g.startsWith(k + '.'))?.[1];
    const info = ov ? {licenses: [ov.license], url: ov.url} : pomInfo(g, a, v);
    const ids = (info.licenses ?? []).map(spdx);
    const license = ids.length ? [...new Set(ids)].join(' OR ') : undefined;
    if (!license) warnings.push('No license for ' + g + ':' + a + ':' + v);
    const key = g + '|' + (license ?? '?');
    if (!groups.has(key)) groups.set(key, {name: g, license: license ?? 'UNKNOWN', url: cleanUrl(info.url, g), artifacts: []});
    groups.get(key).artifacts.push(a + ' ' + v);
  }
  return [...groups.values()].map((x) => ({
    name: x.name, version: x.artifacts.sort().join(', '), license: x.license,
    text: x.license === 'UNKNOWN' ? undefined : canonical(x.license), url: x.url,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Bundled by hand ----------
const fontText = (f) => addText(fs.readFileSync(path.join(ROOT, 'assets/fonts', f), 'utf8'));
const MANUAL = () => [
  {name: 'llama.cpp / ggml', version: 'bundled in llama.rn', license: 'MIT', url: 'https://github.com/ggml-org/llama.cpp', text: canonical('MIT'),
    note: 'Copyright (c) 2023-2026 The ggml authors'},
  {name: 'MMKV', version: 'compiled into react-native-mmkv', license: 'BSD-3-Clause', url: 'https://github.com/Tencent/MMKV', text: canonical('BSD-3-Clause'),
    note: 'Copyright (C) 2018 THL A29 Limited, a Tencent company.'},
  {name: 'PRoot', version: 'Termux build', license: 'GPL-2.0-only', url: 'https://github.com/termux/proot', text: canonical('GPL-2.0-only'),
    note: 'Unmodified binary from the Termux package repository, run as a separate program. Source: https://github.com/termux/proot'},
  {name: 'talloc', version: 'Termux build', license: 'LGPL-3.0-only', url: 'https://talloc.samba.org', text: addText(SPDX['LGPL-3.0-only'].licenseText + '\n\n' + '-'.repeat(40) + '\n\n' + SPDX['GPL-3.0-only'].licenseText),
    note: 'Unmodified library from the Termux package repository, used only by PRoot. Source: https://www.samba.org/ftp/talloc/'},
  {name: 'libandroid-shmem', version: 'Termux build', license: 'BSD-3-Clause', url: 'https://github.com/termux/libandroid-shmem', text: canonical('BSD-3-Clause'),
    note: 'Copyright (c) 2015 Fredrik Fornwall'},
  {name: 'Inter', version: 'font', license: 'OFL-1.1', url: 'https://github.com/rsms/inter', text: fontText('OFL-Inter.txt')},
  {name: 'JetBrains Mono', version: 'font', license: 'OFL-1.1', url: 'https://github.com/JetBrains/JetBrainsMono', text: fontText('OFL-JetBrainsMono.txt')},
  {name: 'Orbitron', version: 'font', license: 'OFL-1.1', url: 'https://github.com/theleagueof/orbitron', text: fontText('OFL-Orbitron.txt')},
  {name: 'Share Tech Mono', version: 'font', license: 'OFL-1.1', url: 'https://fonts.google.com/specimen/Share+Tech+Mono', text: fontText('OFL-ShareTechMono.txt')},
];

const args = new Set(process.argv.slice(2));
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : undefined;
const js = jsPackages();
let android;
if (args.has('--skip-android') && previous) {
  android = previous.sections.find((s) => s.title === 'Android libraries').items
    .map((x) => ({...x, text: x.text === undefined ? undefined : addText(previous.texts[x.text])}));
} else android = androidLibraries();
const data = {
  generated: new Date().toISOString().slice(0, 10),
  sections: [
    {title: 'JavaScript packages', items: js},
    {title: 'Android libraries', items: android},
    {title: 'Native binaries and fonts', items: MANUAL()},
  ],
  texts,
};
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify(data));
fs.rmSync(tmp, {recursive: true, force: true});
const count = data.sections.reduce((n, s) => n + s.items.length, 0);
console.log('Wrote ' + path.relative(ROOT, OUT) + ': ' + count + ' entries, ' + texts.length + ' license texts, ' +
  Math.round(fs.statSync(OUT).size / 1024) + ' KB');
for (const w of warnings) console.warn('warning: ' + w);
if (data.sections.some((s) => s.items.some((x) => x.license === 'UNKNOWN'))) process.exitCode = 1;
