// Copies the repository's docs, privacy policy and changelog into the site.
// The files in /docs stay the single source and keep rendering on GitHub.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import site from '../site.config.js';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(web, '..');
const repoUrl = 'https://github.com/' + site.githubRepo;
const blob = (p) => repoUrl + '/blob/main/' + p;

function images(md, prefix) {
  return md.replace(/<p>\s*((?:<img[^>]*>\s*)+)<\/p>/g, (_, imgs) => {
    const list = [...imgs.matchAll(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g)]
      .map(([, src, alt]) => '![' + alt + '](' + prefix + src.replace(/^images\//, '') + ')');
    return '<div class="shots">\n\n' + list.join('\n') + '\n\n</div>';
  });
}

function links(md, map) {
  return md.replace(/\]\(([^)#\s]+)(#[^)]*)?\)/g, (all, target, hash = '') =>
    target in map ? '](' + map[target] + hash + ')' : all);
}

const outDocs = path.join(web, 'docs');
fs.rmSync(outDocs, {recursive: true, force: true});
fs.mkdirSync(outDocs, {recursive: true});
fs.cpSync(path.join(root, 'docs/images'), path.join(outDocs, 'images'), {recursive: true});
fs.rmSync(path.join(web, 'static/img/shots'), {recursive: true, force: true});
fs.cpSync(path.join(root, 'docs/images'), path.join(web, 'static/img/shots'), {recursive: true});

const docLinks = {
  'README.md': 'intro.md',
  '../README.md': repoUrl + '#readme',
  '../PRIVACY.md': '/privacy',
  '../CHANGELOG.md': '/changelog',
  '../third_party/PROOT-NOTICE.md': blob('third_party/PROOT-NOTICE.md'),
};
for (const file of fs.readdirSync(path.join(root, 'docs')).filter((f) => f.endsWith('.md'))) {
  let md = fs.readFileSync(path.join(root, 'docs', file), 'utf8');
  md = links(images(md, './images/'), docLinks);
  const name = file === 'README.md' ? 'intro.md' : file;
  const front = file === 'README.md' ? '---\nslug: /\nsidebar_label: Overview\n---\n\n' : '';
  fs.writeFileSync(path.join(outDocs, name), front + md);
}

const pageLinks = (md) => md
  .replace(/\]\(docs\/([\w-]+)\.md(#[^)]*)?\)/g, (_, d, h = '') => '](/docs/' + (d === 'README' ? '' : d) + h + ')')
  .replace(/\]\(PRIVACY\.md\)/g, '](/privacy)')
  .replace(/\]\((third_party\/[^)]+)\)/g, (_, p) => '](' + blob(p) + ')');

const pages = path.join(web, 'src/pages');
const page = (src, out, title, description) => {
  const md = pageLinks(fs.readFileSync(path.join(root, src), 'utf8'));
  fs.writeFileSync(path.join(pages, out),
    '---\ntitle: ' + title + '\ndescription: ' + description + '\n---\n\n<div class="doc-page">\n\n' + md + '\n\n</div>\n');
};
page('PRIVACY.md', 'privacy.md', 'Privacy policy', 'What data Forge handles, where it goes, and which permissions it uses.');
page('CHANGELOG.md', 'changelog.md', 'Changelog', 'Release notes for every Forge version.');
console.log('Synced docs, privacy policy and changelog.');
