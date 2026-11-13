import {forgeNative} from '../native';

export const SKILLS_DIR = `${forgeNative.filesDir}/skills`;

export interface SkillMeta {slug: string; name: string; description: string; source: string; files: string[]; installedAt: number; enabled: boolean}

export interface CatalogSkill {id: string; name: string; description: string; repo: string; path: string; author: string; category: 'Design' | 'Engineering' | 'Documents' | 'Workflow'}

export const SKILL_CATALOG: CatalogSkill[] = [
  {id: 'impeccable', name: 'Impeccable', description: 'Design taste for agents, with a critique loop that avoids generic UI.', repo: 'pbakaus/impeccable', path: '.agents/skills/impeccable', author: 'Paul Bakaus', category: 'Design'},
  {id: 'frontend-design', name: 'Frontend design', description: 'Distinctive, production-grade interfaces with a clear aesthetic point of view.', repo: 'anthropics/skills', path: 'skills/frontend-design', author: 'Anthropic', category: 'Design'},
  {id: 'web-design-guidelines', name: 'Web design guidelines', description: 'Review UI code against accessibility and interface best practices.', repo: 'vercel-labs/agent-skills', path: 'skills/web-design-guidelines', author: 'Vercel', category: 'Design'},
  {id: 'theme-factory', name: 'Theme factory', description: 'Apply a coherent visual theme to slides, docs and pages.', repo: 'anthropics/skills', path: 'skills/theme-factory', author: 'Anthropic', category: 'Design'},
  {id: 'canvas-design', name: 'Canvas design', description: 'Create posters and visual art as PNG or PDF.', repo: 'anthropics/skills', path: 'skills/canvas-design', author: 'Anthropic', category: 'Design'},
  {id: 'react-best-practices', name: 'React best practices', description: 'Performance and correctness rules for React and Next.js.', repo: 'vercel-labs/agent-skills', path: 'skills/react-best-practices', author: 'Vercel', category: 'Engineering'},
  {id: 'react-native-skills', name: 'React Native', description: 'Mobile performance, lists, animation and native module guidance.', repo: 'vercel-labs/agent-skills', path: 'skills/react-native-skills', author: 'Vercel', category: 'Engineering'},
  {id: 'systematic-debugging', name: 'Systematic debugging', description: 'Find the root cause before proposing a fix.', repo: 'obra/superpowers', path: 'skills/systematic-debugging', author: 'Jesse Vincent', category: 'Engineering'},
  {id: 'test-driven-development', name: 'Test-driven development', description: 'Write the failing test first, then the code.', repo: 'obra/superpowers', path: 'skills/test-driven-development', author: 'Jesse Vincent', category: 'Engineering'},
  {id: 'mcp-builder', name: 'MCP builder', description: 'Design and build Model Context Protocol servers.', repo: 'anthropics/skills', path: 'skills/mcp-builder', author: 'Anthropic', category: 'Engineering'},
  {id: 'webapp-testing', name: 'Web app testing', description: 'Test local web apps with Playwright.', repo: 'anthropics/skills', path: 'skills/webapp-testing', author: 'Anthropic', category: 'Engineering'},
  {id: 'web-artifacts-builder', name: 'Web artifacts builder', description: 'Build multi-component HTML artifacts with React and Tailwind.', repo: 'anthropics/skills', path: 'skills/web-artifacts-builder', author: 'Anthropic', category: 'Engineering'},
  {id: 'pdf', name: 'PDF', description: 'Read, create, merge and fill PDF documents.', repo: 'anthropics/skills', path: 'skills/pdf', author: 'Anthropic', category: 'Documents'},
  {id: 'docx', name: 'Word documents', description: 'Create and edit .docx files with tracked changes.', repo: 'anthropics/skills', path: 'skills/docx', author: 'Anthropic', category: 'Documents'},
  {id: 'xlsx', name: 'Spreadsheets', description: 'Build and analyse Excel workbooks with formulas.', repo: 'anthropics/skills', path: 'skills/xlsx', author: 'Anthropic', category: 'Documents'},
  {id: 'pptx', name: 'Presentations', description: 'Create and edit PowerPoint decks.', repo: 'anthropics/skills', path: 'skills/pptx', author: 'Anthropic', category: 'Documents'},
  {id: 'doc-coauthoring', name: 'Doc co-authoring', description: 'Write specs and proposals together in structured passes.', repo: 'anthropics/skills', path: 'skills/doc-coauthoring', author: 'Anthropic', category: 'Documents'},
  {id: 'writing-guidelines', name: 'Writing guidelines', description: 'Clear, plain product and technical writing.', repo: 'vercel-labs/agent-skills', path: 'skills/writing-guidelines', author: 'Vercel', category: 'Documents'},
  {id: 'brainstorming', name: 'Brainstorming', description: 'Turn a rough idea into a design before writing code.', repo: 'obra/superpowers', path: 'skills/brainstorming', author: 'Jesse Vincent', category: 'Workflow'},
  {id: 'writing-plans', name: 'Writing plans', description: 'Break work into small, verifiable implementation steps.', repo: 'obra/superpowers', path: 'skills/writing-plans', author: 'Jesse Vincent', category: 'Workflow'},
  {id: 'verification-before-completion', name: 'Verify before done', description: 'Prove the work runs before calling it finished.', repo: 'obra/superpowers', path: 'skills/verification-before-completion', author: 'Jesse Vincent', category: 'Workflow'},
  {id: 'skill-creator', name: 'Skill creator', description: 'Write new skills of your own.', repo: 'anthropics/skills', path: 'skills/skill-creator', author: 'Anthropic', category: 'Workflow'},
];

export function parseFrontmatter(markdown: string): {name?: string; description?: string; body: string} {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return {body: markdown};
  const meta: Record<string, string> = {};
  let currentKey = '';
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (pair) { currentKey = pair[1]; meta[currentKey] = pair[2].replace(/^["'>|-]+\s*|["']$/g, '').trim(); }
    else if (currentKey && /^\s+/.test(line)) meta[currentKey] = `${meta[currentKey]} ${line.trim()}`.trim();
  }
  return {name: meta.name, description: meta.description, body: markdown.slice(match[0].length)};
}

export function parseGitHubUrl(input: string): {repo: string; ref?: string; path: string} {
  const url = input.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const short = url.match(/^([\w.-]+)\/([\w.-]+)(?:\/(.+))?$/);
  if (short && !url.includes(':')) return {repo: `${short[1]}/${short[2]}`, path: short[3] ?? ''};
  const match = url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?$/);
  if (!match) throw new Error('Use a GitHub link like https://github.com/owner/repo/tree/main/skills/name');
  return {repo: `${match[1]}/${match[2]}`, ref: match[3], path: (match[4] ?? '').replace(/\/SKILL\.md$/i, '')};
}

const TEXT_FILE = /\.(md|txt|py|js|ts|tsx|jsx|json|ya?ml|sh|html|css|toml|xml|csv)$/i;

export async function installSkill(source: {repo: string; ref?: string; path: string}): Promise<SkillMeta> {
  const ref = source.ref ?? 'HEAD';
  const tree = await fetch(`https://api.github.com/repos/${source.repo}/git/trees/${ref}?recursive=1`, {headers: {Accept: 'application/vnd.github+json'}});
  if (tree.status === 403) throw new Error('GitHub rate limit reached. Try again in a few minutes.');
  if (!tree.ok) throw new Error(`Could not read ${source.repo} (HTTP ${tree.status}).`);
  const listing = (await tree.json()).tree as {path: string; type: string; size?: number}[];
  const base = source.path.replace(/^\/+|\/+$/g, '');
  const skillFile = listing.find(item => item.type === 'blob' && item.path === (base ? `${base}/SKILL.md` : 'SKILL.md'))
    ?? listing.find(item => item.type === 'blob' && item.path.startsWith(base) && /(^|\/)SKILL\.md$/.test(item.path));
  if (!skillFile) throw new Error('No SKILL.md was found at that location.');
  const dir = skillFile.path.replace(/\/?SKILL\.md$/, '');
  const raw = (path: string) => `https://raw.githubusercontent.com/${source.repo}/${ref}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const skillText = await (await fetch(raw(skillFile.path))).text();
  const meta = parseFrontmatter(skillText);
  const slug = (meta.name ?? dir.split('/').pop() ?? source.repo.split('/')[1]).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('This skill has no usable name.');
  const target = `${SKILLS_DIR}/${slug}`;
  await forgeNative.remove(target).catch(() => undefined);
  await forgeNative.writeFile(`${target}/SKILL.md`, skillText);
  const extras = listing.filter(item => item.type === 'blob' && item.path !== skillFile.path && (dir ? item.path.startsWith(dir + '/') : !item.path.includes('/')) && TEXT_FILE.test(item.path) && (item.size ?? 0) < 120000).slice(0, 40);
  const files = ['SKILL.md'];
  for (const extra of extras) {
    try {
      const relative = dir ? extra.path.slice(dir.length + 1) : extra.path;
      const content = await (await fetch(raw(extra.path))).text();
      await forgeNative.writeFile(`${target}/${relative}`, content);
      files.push(relative);
    } catch {}
  }
  const label = meta.name && !/^[a-z0-9-]+$/.test(meta.name) ? meta.name : slug.split('-').join(' ').replace(/^./, letter => letter.toUpperCase());
  return {slug, name: label, description: meta.description ?? 'No description provided.', source: `https://github.com/${source.repo}/tree/${ref}/${dir}`, files, installedAt: Date.now(), enabled: true};
}

export async function readSkillFile(slug: string, file = 'SKILL.md'): Promise<string> {
  if (file.split('/').includes('..')) throw new Error('Invalid skill file');
  return forgeNative.readFile(`${SKILLS_DIR}/${slug}/${file}`);
}
