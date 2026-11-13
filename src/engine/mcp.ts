export interface McpToolInfo {name: string; description?: string; inputSchema?: Record<string, unknown>}

interface Session {id?: string; initialized: boolean}
const sessions = new Map<string, Session>();
let counter = 0;

function parseResponse(body: string, id: number): any {
  const trimmed = body.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.find(item => item.id === id) : parsed;
  }
  for (const line of body.split('\n')) {
    if (!line.startsWith('data:')) continue;
    try {
      const parsed = JSON.parse(line.slice(5).trim());
      if (parsed.id === id) return parsed;
    } catch {}
  }
  throw new Error('The server sent an unreadable response.');
}

async function post(url: string, headers: Record<string, string>, payload: Record<string, unknown>, timeoutMs: number): Promise<{body: string; sessionId: string | null; status: number}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18', ...headers},
      body: JSON.stringify({jsonrpc: '2.0', ...payload}),
      signal: controller.signal,
    });
    const body = await response.text();
    if (response.status === 401) throw new Error('This server needs authorization. Add an access token for it.');
    if (!response.ok && response.status !== 202) throw new Error(`Server answered HTTP ${response.status}${body ? ': ' + body.slice(0, 160) : ''}`);
    return {body, sessionId: response.headers.get('mcp-session-id'), status: response.status};
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new Error('The server did not answer in time.');
    throw error;
  } finally { clearTimeout(timer); }
}

async function request(url: string, token: string | null, method: string, params: Record<string, unknown>, timeoutMs: number): Promise<any> {
  const key = url;
  let session = sessions.get(key);
  const auth: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {};
  if (!session?.initialized) {
    const id = ++counter;
    const init = await post(url, auth, {id, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'Forge', version: '4.0.0'}}}, timeoutMs);
    const parsed = parseResponse(init.body, id);
    if (parsed.error) throw new Error(parsed.error.message ?? 'Initialization failed');
    session = {id: init.sessionId ?? undefined, initialized: true};
    sessions.set(key, session);
    await post(url, {...auth, ...(session.id ? {'Mcp-Session-Id': session.id} : {})}, {method: 'notifications/initialized'}, timeoutMs).catch(() => undefined);
  }
  const id = ++counter;
  try {
    const result = await post(url, {...auth, ...(session.id ? {'Mcp-Session-Id': session.id} : {})}, {id, method, params}, timeoutMs);
    const parsed = parseResponse(result.body, id);
    if (parsed.error) throw new Error(parsed.error.message ?? 'The tool call failed');
    return parsed.result;
  } catch (error) {
    if (/HTTP 404|HTTP 400/.test(String(error))) sessions.delete(key);
    throw error;
  }
}

export async function mcpListTools(url: string, token: string | null, timeoutMs = 20000): Promise<McpToolInfo[]> {
  sessions.delete(url);
  const result = await request(url, token, 'tools/list', {}, timeoutMs);
  return (result?.tools ?? []) as McpToolInfo[];
}

export async function mcpCallTool(url: string, token: string | null, name: string, args: Record<string, unknown>, timeoutMs = 60000): Promise<string> {
  const result = await request(url, token, 'tools/call', {name, arguments: args}, timeoutMs);
  const parts = (result?.content ?? []).map((part: any) => part.type === 'text' ? part.text : part.type === 'resource' ? part.resource?.text ?? '' : `[${part.type} content]`);
  const text = parts.join('\n').trim() || JSON.stringify(result?.structuredContent ?? result ?? {});
  return result?.isError ? `Tool error: ${text}` : text;
}

export function resetMcpSession(url: string) { sessions.delete(url); }

export const MCP_CATALOG = [
  {id: 'deepwiki', name: 'DeepWiki', url: 'https://mcp.deepwiki.com/mcp', description: 'Ask questions about any public GitHub repository.', auth: false},
  {id: 'context7', name: 'Context7', url: 'https://mcp.context7.com/mcp', description: 'Up-to-date library documentation and code examples.', auth: false},
  {id: 'cloudflare-docs', name: 'Cloudflare Docs', url: 'https://docs.mcp.cloudflare.com/mcp', description: 'Search the Cloudflare developer documentation.', auth: false},
  {id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co/mcp', description: 'Search models, datasets, Spaces and papers.', auth: false},
  {id: 'exa', name: 'Exa Search', url: 'https://mcp.exa.ai/mcp', description: 'Web and code search built for agents.', auth: false},
  {id: 'gitmcp', name: 'GitMCP', url: 'https://gitmcp.io/docs', description: 'Documentation for any GitHub project.', auth: false},
];
