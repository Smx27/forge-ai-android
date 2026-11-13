import type {ChatTool} from './providers';
import type {ToolResult, PlanStep} from '../stores/chats';
import {forgeNative} from '../native';
import {listTree, readText, resolveWorkspacePath, writeText} from './workspace';
import {lineDiff} from './diff';
import {webFetch, webSearch} from './web';
import {mcpCallTool} from './mcp';
import {readSkillFile} from './skills';
import {rankMemory} from './memory';
import {guestPath, runInLinux} from './linux';
import {useLibrary} from '../stores/library';
import {useLinux} from '../stores/linux';
import type {ApprovalMode} from '../stores/settings';
import {useProcs} from '../stores/procs';

export interface ToolContext {signal: AbortSignal; onOutput?: (chunk: string) => void; webTools: boolean; memoryEnabled: boolean; root?: string; capture?: (absolutePath: string) => Promise<void>}

const within = (context: ToolContext, path: unknown) => [context.root ?? '', String(path ?? '')].filter(Boolean).join('/');
const strip = (context: ToolContext, path: string) => context.root && path.startsWith(context.root + '/') ? path.slice(context.root.length + 1) : path;

interface ToolSpec {
  def: ChatTool;
  approval?: 'edit' | 'command';
  summarize: (args: any) => string;
  run: (args: any, context: ToolContext) => Promise<ToolResult>;
}

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): ChatTool => ({
  type: 'function',
  function: {name, description, parameters: {type: 'object', properties, required, additionalProperties: false}},
});

const ok = (output: string, detail?: ToolResult['detail']): ToolResult => ({status: 'ok', output, detail});
const str = {type: 'string'};

const builtins: Record<string, ToolSpec> = {
  list_files: {
    def: fn('list_files', 'List files and folders in the workspace. Paths are relative to the workspace root.', {path: {...str, description: 'Folder to list, default is the root'}, depth: {type: 'integer', description: 'How deep to recurse, 1 to 4'}}),
    summarize: args => `List ${args.path || 'workspace'}`,
    run: async (args, context) => {
      const tree = await listTree(within(context, args.path), Math.min(4, Math.max(1, Number(args.depth) || 2)));
      return ok(tree.length ? tree.map(line => strip(context, line)).join('\n') : '(empty folder)');
    },
  },
  read_file: {
    def: fn('read_file', 'Read a text file from the workspace. Use offset and limit (line numbers) for long files.', {path: str, offset: {type: 'integer'}, limit: {type: 'integer'}}, ['path']),
    summarize: args => `Read ${args.path}`,
    run: async (args, context) => {
      const text = await readText(within(context, args.path));
      const lines = text.split('\n');
      const start = Math.max(0, (Number(args.offset) || 1) - 1);
      const end = Math.min(lines.length, start + (Number(args.limit) || 400));
      const body = lines.slice(start, end).map((line, index) => `${start + index + 1}\t${line}`).join('\n');
      return ok(end < lines.length ? `${body}\n… ${lines.length - end} more lines` : body, {path: args.path});
    },
  },
  write_file: {
    def: fn('write_file', 'Create or overwrite a text file in the workspace with the complete content.', {path: str, content: str}, ['path', 'content']),
    approval: 'edit',
    summarize: args => `Write ${args.path}`,
    run: async (args, context) => {
      const path = within(context, args.path);
      await context.capture?.(resolveWorkspacePath(path));
      const before = await readText(path).catch(() => '');
      await writeText(path, String(args.content ?? ''));
      const diff = lineDiff(before, String(args.content ?? ''));
      return ok(`Wrote ${args.path} (+${diff.added} -${diff.removed})`, {path: args.path, added: diff.added, removed: diff.removed, diff: diff.lines});
    },
  },
  edit_file: {
    def: fn('edit_file', 'Replace one exact, unique snippet in a workspace file. Read the file first.', {path: str, old_string: str, new_string: str}, ['path', 'old_string', 'new_string']),
    approval: 'edit',
    summarize: args => `Edit ${args.path}`,
    run: async (args, context) => {
      const path = within(context, args.path);
      const before = await readText(path);
      const count = before.split(String(args.old_string)).length - 1;
      if (count === 0) return {status: 'error', output: 'old_string was not found. Read the file again and copy the text exactly.'};
      if (count > 1) return {status: 'error', output: `old_string matches ${count} places. Include more surrounding lines so it is unique.`};
      const after = before.replace(String(args.old_string), () => String(args.new_string));
      await context.capture?.(resolveWorkspacePath(path));
      await writeText(path, after);
      const diff = lineDiff(before, after);
      return ok(`Edited ${args.path} (+${diff.added} -${diff.removed})`, {path: args.path, added: diff.added, removed: diff.removed, diff: diff.lines});
    },
  },
  delete_path: {
    def: fn('delete_path', 'Delete a file or folder in the workspace.', {path: str}, ['path']),
    approval: 'edit',
    summarize: args => `Delete ${args.path}`,
    run: async (args, context) => {
      const target = resolveWorkspacePath(within(context, args.path));
      if (target === resolveWorkspacePath(context.root ?? '')) return {status: 'error', output: 'Refusing to delete the project root.'};
      await context.capture?.(target);
      await forgeNative.remove(target);
      return ok(`Deleted ${args.path}`, {path: args.path});
    },
  },
  run_command: {
    def: fn('run_command', 'Run a shell command in the Alpine Linux environment (busybox sh). The workspace is at /root/workspace and is the default working directory. Install packages with apk add. Avoid interactive commands. For dev servers and other long-running processes use start_server instead.', {command: str, cwd: {...str, description: 'Folder relative to the workspace'}, timeout_seconds: {type: 'integer'}}, ['command']),
    approval: 'command',
    summarize: args => String(args.command ?? '').slice(0, 200),
    run: async (args, context) => {
      if (!useLinux.getState().installed) return {status: 'error', output: 'The Linux environment is not installed. Ask the user to install it from the Terminal tab.'};
      const result = await runInLinux(String(args.command), {cwd: guestPath(within(context, args.cwd)), timeoutMs: Math.min(900, Math.max(5, Number(args.timeout_seconds) || 180)) * 1000, onData: context.onOutput, signal: context.signal});
      const output = result.output.length > 12000 ? '…' + result.output.slice(-12000) : result.output;
      return {status: result.exitCode === 0 ? 'ok' : 'error', output: `${output || '(no output)'}\n[exit ${result.timedOut ? 'timeout' : result.exitCode}]`, detail: {command: args.command, exitCode: result.exitCode}};
    },
  },
  start_server: {
    def: fn('start_server', 'Start a long-running process such as a dev server in the background inside Linux. Returns its first output and, when it listens on a port, a localhost URL the user can open in the in-app preview.', {command: str, cwd: {...str, description: 'Folder relative to the project'}, port: {type: 'integer', description: 'Port the server listens on, if known'}}, ['command']),
    approval: 'command',
    summarize: args => `Start ${String(args.command ?? '').slice(0, 160)}`,
    run: async (args, context) => {
      if (!useLinux.getState().installed) return {status: 'error', output: 'The Linux environment is not installed.'};
      const started = await useProcs.getState().start(String(args.command), guestPath(within(context, args.cwd)), Number(args.port) || undefined);
      for (let waited = 0; waited < 12000; waited += 500) {
        const current = useProcs.getState().procs.find(proc => proc.id === started.id);
        if (!current?.running || (current.port && current.output.length > 0 && waited >= 1500)) break;
        if (context.signal.aborted) break;
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      }
      const proc = useProcs.getState().procs.find(item => item.id === started.id) ?? started;
      const tail = proc.output.slice(-3000) || '(no output yet)';
      if (!proc.running) return {status: 'error', output: `${tail}\n[exited ${proc.exitCode ?? ''}]`, detail: {command: args.command}};
      return ok(`${tail}\n[running as ${proc.id}]${proc.port ? `\nPreview: http://127.0.0.1:${proc.port}` : ''}\nThe user can open it from the Linux tab.`, {command: args.command});
    },
  },
  stop_server: {
    def: fn('stop_server', 'Stop a background process started with start_server, or all of them when no id is given.', {id: str}),
    summarize: args => args.id ? `Stop ${args.id}` : 'Stop servers',
    run: async args => {
      const procs = useProcs.getState().procs.filter(proc => proc.running && (!args.id || proc.id === args.id));
      await Promise.all(procs.map(proc => useProcs.getState().stop(proc.id)));
      return ok(procs.length ? `Stopped ${procs.length} process${procs.length === 1 ? '' : 'es'}.` : 'No matching process is running.');
    },
  },
  web_search: {
    def: fn('web_search', 'Search the web. Returns titles, links and snippets.', {query: str}, ['query']),
    summarize: args => `Search “${args.query}”`,
    run: async args => {
      const hits = await webSearch(String(args.query));
      if (!hits.length) return ok('No results.');
      return ok(hits.map((hit, index) => `${index + 1}. ${hit.title}\n${hit.url}\n${hit.snippet}`).join('\n\n'), {hits: hits.map(hit => ({title: hit.title, url: hit.url}))});
    },
  },
  web_fetch: {
    def: fn('web_fetch', 'Fetch a web page and return its readable text.', {url: str}, ['url']),
    summarize: args => `Open ${args.url}`,
    run: async args => ok(await webFetch(String(args.url))),
  },
  remember: {
    def: fn('remember', 'Save a durable fact or user preference to long-term memory. Use sparingly for things worth knowing in future chats.', {text: str, kind: {type: 'string', enum: ['fact', 'preference', 'decision', 'todo']}}, ['text']),
    summarize: args => `Remember: ${String(args.text).slice(0, 80)}`,
    run: async args => { useLibrary.getState().remember(String(args.text), args.kind ?? 'fact'); return ok('Saved to memory.'); },
  },
  recall: {
    def: fn('recall', 'Search long-term memory.', {query: str}, ['query']),
    summarize: args => `Recall “${args.query}”`,
    run: async args => {
      const hits = rankMemory(useLibrary.getState().memory, String(args.query));
      return ok(hits.length ? hits.map(entry => `- (${entry.kind}) ${entry.text}`).join('\n') : 'Nothing relevant in memory.');
    },
  },
  load_skill: {
    def: fn('load_skill', 'Load the instructions of an installed skill, or one of its reference files.', {name: str, file: {...str, description: 'Optional file inside the skill, default SKILL.md'}}, ['name']),
    summarize: args => `Use skill ${args.name}${args.file ? ` · ${args.file}` : ''}`,
    run: async args => {
      const skill = useLibrary.getState().skills.find(item => item.slug === args.name || item.name === args.name);
      if (!skill) return {status: 'error', output: `No installed skill named ${args.name}.`};
      const text = await readSkillFile(skill.slug, args.file || 'SKILL.md');
      const others = skill.files.filter(file => file !== 'SKILL.md');
      return ok(text.slice(0, 30000) + (others.length && !args.file ? `\n\nOther files in this skill: ${others.join(', ')}` : ''));
    },
  },
  update_plan: {
    def: fn('update_plan', 'Show the user a short checklist for multi-step work and update it as steps finish.', {steps: {type: 'array', items: {type: 'object', properties: {title: str, status: {type: 'string', enum: ['pending', 'active', 'done']}}, required: ['title', 'status']}}}, ['steps']),
    summarize: () => 'Update plan',
    run: async args => {
      const plan = (Array.isArray(args.steps) ? args.steps : []).slice(0, 12).map((step: PlanStep) => ({title: String(step.title).slice(0, 120), status: step.status}));
      return ok('Plan updated.', {plan});
    },
  },
};

export function mcpToolName(serverName: string, tool: string): string {
  return `mcp_${serverName}_${tool}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

const LOCAL_TOOLS = ['list_files', 'read_file', 'write_file', 'edit_file', 'run_command', 'update_plan'];

export function availableTools(context: {webTools: boolean; memoryEnabled: boolean; hasSkills: boolean; local?: boolean}): ChatTool[] {
  if (context.local) return LOCAL_TOOLS.map(name => builtins[name].def);
  const names = Object.keys(builtins).filter(name =>
    (context.webTools || !['web_search', 'web_fetch'].includes(name)) &&
    (context.memoryEnabled || !['remember', 'recall'].includes(name)) &&
    (context.hasSkills || name !== 'load_skill'));
  const tools = names.map(name => builtins[name].def);
  for (const server of useLibrary.getState().servers) {
    if (!server.enabled || server.status === 'error') continue;
    for (const tool of server.tools.slice(0, 40)) {
      tools.push({type: 'function', function: {name: mcpToolName(server.name, tool.name), description: `[${server.name}] ${tool.description ?? tool.name}`.slice(0, 1000), parameters: (tool.inputSchema as Record<string, unknown>) ?? {type: 'object', properties: {}}}});
    }
  }
  return tools;
}

export function needsApproval(name: string, mode: ApprovalMode): boolean {
  const kind = builtins[name]?.approval;
  if (!kind || mode === 'auto') return false;
  if (mode === 'edits') return kind === 'command';
  return true;
}

export function summarizeCall(name: string, rawArgs: string): string {
  try { return builtins[name]?.summarize(JSON.parse(rawArgs || '{}')) ?? name.replace(/^mcp_/, '').replace(/_/g, ' '); } catch { return name; }
}

export async function executeTool(name: string, rawArgs: string, context: ToolContext): Promise<ToolResult> {
  let args: any;
  try { args = JSON.parse(rawArgs || '{}'); } catch { return {status: 'error', output: 'Arguments were not valid JSON. Send a JSON object.'}; }
  try {
    const builtin = builtins[name];
    if (builtin) return await builtin.run(args, context);
    for (const server of useLibrary.getState().servers) {
      const tool = server.tools.find(item => mcpToolName(server.name, item.name) === name);
      if (!tool) continue;
      const token = server.hasToken ? await forgeNative.secureGet(`mcp.${server.id}`) : null;
      return ok((await mcpCallTool(server.url, token, tool.name, args)).slice(0, 20000));
    }
    return {status: 'error', output: `Unknown tool ${name}.`};
  } catch (error) {
    return {status: 'error', output: error instanceof Error ? error.message : String(error)};
  }
}
