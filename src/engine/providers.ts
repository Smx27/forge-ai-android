export interface ProviderDef {
  id: string;
  name: string;
  blurb: string;
  baseUrl: string;
  defaultModel: string;
  keyUrl?: string;
  needsKey: boolean;
  free: boolean;
  kind: 'openai' | 'device';
  editableUrl?: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  {id: 'openrouter', name: 'OpenRouter', blurb: 'Dozens of free models behind one key', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openrouter/free', keyUrl: 'https://openrouter.ai/settings/keys', needsKey: true, free: true, kind: 'openai'},
  {id: 'gemini', name: 'Google Gemini', blurb: 'Free tier with long context', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey', needsKey: true, free: true, kind: 'openai'},
  {id: 'nvidia', name: 'NVIDIA NIM', blurb: 'Free hosted open models', baseUrl: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.3-70b-instruct', keyUrl: 'https://build.nvidia.com/settings/api-keys', needsKey: true, free: true, kind: 'openai'},
  {id: 'groq', name: 'Groq', blurb: 'Very fast free inference', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys', needsKey: true, free: true, kind: 'openai'},
  {id: 'cerebras', name: 'Cerebras', blurb: 'Free tier, thousands of tokens per second', baseUrl: 'https://api.cerebras.ai/v1', defaultModel: 'gpt-oss-120b', keyUrl: 'https://cloud.cerebras.ai', needsKey: true, free: true, kind: 'openai'},
  {id: 'mistral', name: 'Mistral', blurb: 'Free experiment plan', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/api-keys', needsKey: true, free: true, kind: 'openai'},
  {id: 'huggingface', name: 'Hugging Face', blurb: 'Inference Providers with monthly free credits', baseUrl: 'https://router.huggingface.co/v1', defaultModel: 'openai/gpt-oss-120b', keyUrl: 'https://huggingface.co/settings/tokens', needsKey: true, free: true, kind: 'openai'},
  {id: 'github', name: 'GitHub Models', blurb: 'Free for GitHub accounts, rate limited', baseUrl: 'https://models.github.ai/inference', defaultModel: 'openai/gpt-4.1-mini', keyUrl: 'https://github.com/settings/personal-access-tokens', needsKey: true, free: true, kind: 'openai'},
  {id: 'ondevice', name: 'On this phone', blurb: 'Private and offline, runs a downloaded model', baseUrl: '', defaultModel: '', needsKey: false, free: true, kind: 'device'},
  {id: 'ollama', name: 'Local server', blurb: 'Ollama, LM Studio or llama.cpp on this phone', baseUrl: 'http://127.0.0.1:11434/v1', defaultModel: 'qwen2.5:1.5b', needsKey: false, free: true, kind: 'openai', editableUrl: true},
  {id: 'custom', name: 'Custom endpoint', blurb: 'Any OpenAI-compatible HTTPS API', baseUrl: 'https://', defaultModel: '', needsKey: true, free: false, kind: 'openai', editableUrl: true},
];

export function providerById(id: string): ProviderDef {
  return PROVIDERS.find(provider => provider.id === id) ?? PROVIDERS[0];
}

export interface ChatTool {type: 'function'; function: {name: string; description: string; parameters: Record<string, unknown>}}
export interface ToolCall {id: string; name: string; arguments: string}
export type ContentPart = {type: 'text'; text: string} | {type: 'image_url'; image_url: {url: string}};
export type ApiMessage =
  | {role: 'system'; content: string}
  | {role: 'user'; content: string | ContentPart[]}
  | {role: 'assistant'; content: string | null; tool_calls?: {id: string; type: 'function'; function: {name: string; arguments: string}}[]}
  | {role: 'tool'; tool_call_id: string; content: string};

export interface StreamRequest {
  baseUrl: string;
  apiKey?: string;
  providerId: string;
  model: string;
  messages: ApiMessage[];
  tools?: ChatTool[];
  temperature?: number;
  signal?: AbortSignal;
  onText?: (delta: string) => void;
}

export interface StreamResult {text: string; toolCalls: ToolCall[]; finishReason: string | null; usage?: {prompt: number; completion: number}}

export class ProviderError extends Error {
  constructor(message: string, readonly status: number, readonly toolsUnsupported = false, readonly usageUnsupported = false) { super(message); }
}

function headers(request: Pick<StreamRequest, 'apiKey' | 'providerId'>): Record<string, string> {
  const result: Record<string, string> = {'Content-Type': 'application/json'};
  if (request.apiKey) result.Authorization = `Bearer ${request.apiKey}`;
  if (request.providerId === 'openrouter') { result['HTTP-Referer'] = 'https://forge.app'; result['X-Title'] = 'Forge'; }
  return result;
}

function describeError(status: number, body: string): string {
  let message = '';
  try {
    const parsed = JSON.parse(body);
    const error = Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
    message = typeof error === 'string' ? error : error?.message ?? parsed.message ?? parsed.detail ?? '';
    if (error?.metadata?.raw) message += ` (${String(error.metadata.raw).slice(0, 200)})`;
  } catch { message = body.slice(0, 300); }
  if (status === 401 || status === 403) return `The provider rejected the API key. ${message}`.trim();
  if (status === 429) return `Rate limited by the provider. Wait a moment or pick another free model. ${message}`.trim();
  if (status === 404) return `Model or endpoint not found. Check the model name. ${message}`.trim();
  if (status === 0) return 'Could not reach the provider. Check your connection.';
  return message || `The provider answered HTTP ${status}.`;
}

const noUsage = new Set<string>();

export async function streamChat(request: StreamRequest): Promise<StreamResult> {
  const key = request.providerId + '|' + request.baseUrl;
  if (noUsage.has(key)) return streamOnce(request, false);
  try { return await streamOnce(request, true); }
  catch (error) {
    if (!(error instanceof ProviderError) || !error.usageUnsupported) throw error;
    noUsage.add(key);
    return streamOnce(request, false);
  }
}

function streamOnce(request: StreamRequest, withUsage: boolean): Promise<StreamResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let cursor = 0;
    let buffer = '';
    let text = '';
    let finishReason: string | null = null;
    let usage: StreamResult['usage'];
    let streamError: string | null = null;
    const calls = new Map<number, ToolCall>();
    const consume = (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (parsed.error) { streamError = typeof parsed.error === 'string' ? parsed.error : parsed.error.message ?? 'The provider reported an error.'; continue; }
        if (parsed.usage) usage = {prompt: parsed.usage.prompt_tokens ?? 0, completion: parsed.usage.completion_tokens ?? 0};
        const choice = parsed.choices?.[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const delta = choice.delta ?? choice.message ?? {};
        if (typeof delta.content === 'string' && delta.content) { text += delta.content; request.onText?.(delta.content); }
        for (const call of delta.tool_calls ?? []) {
          const index = typeof call.index === 'number' ? call.index : calls.size;
          const current = calls.get(index) ?? {id: '', name: '', arguments: ''};
          if (call.id) current.id = call.id;
          if (call.function?.name) current.name += call.function.name;
          if (call.function?.arguments) current.arguments += call.function.arguments;
          calls.set(index, current);
        }
      }
    };
    const abort = () => xhr.abort();
    request.signal?.addEventListener('abort', abort);
    xhr.open('POST', `${request.baseUrl.replace(/\/$/, '')}/chat/completions`);
    Object.entries(headers(request)).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.timeout = 180000;
    xhr.onprogress = () => {
      if (xhr.status && xhr.status >= 400) return;
      const next = xhr.responseText.slice(cursor);
      cursor = xhr.responseText.length;
      consume(next);
    };
    xhr.onload = () => {
      request.signal?.removeEventListener('abort', abort);
      if (xhr.status >= 400) {
        let message = describeError(xhr.status, xhr.responseText);
        const usageUnsupported = withUsage && xhr.status < 500 && /stream_options|include_usage/i.test(xhr.responseText);
        const toolsUnsupported = !usageUnsupported && !!request.tools?.length && /tool|function/i.test(xhr.responseText) && xhr.status < 500;
        const hasImages = request.messages.some(item => item.role === 'user' && Array.isArray(item.content));
        if (hasImages && xhr.status < 500 && /image|vision|multimodal|modalit/i.test(xhr.responseText)) message = `This model cannot read images. Pick a vision model such as gemini-2.5-flash, or remove the image. (${message.slice(0, 160)})`;
        reject(new ProviderError(message, xhr.status, toolsUnsupported, usageUnsupported));
        return;
      }
      consume(xhr.responseText.slice(cursor) + '\n');
      if (!text && !calls.size && xhr.responseText.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          const message = parsed.choices?.[0]?.message;
          if (message?.content) { text = message.content; request.onText?.(text); }
          (message?.tool_calls ?? []).forEach((call: any, index: number) => calls.set(index, {id: call.id, name: call.function.name, arguments: call.function.arguments ?? '{}'}));
          finishReason = parsed.choices?.[0]?.finish_reason ?? finishReason;
        } catch {}
      }
      if (streamError && !text && !calls.size) { reject(new ProviderError(streamError, 502)); return; }
      const toolCalls = [...calls.values()].filter(call => call.name).map((call, index) => ({...call, id: call.id || `call_${Date.now()}_${index}`, arguments: call.arguments || '{}'}));
      resolve({text, toolCalls, finishReason, usage});
    };
    xhr.onerror = () => { request.signal?.removeEventListener('abort', abort); reject(new ProviderError(describeError(0, ''), 0)); };
    xhr.ontimeout = () => { request.signal?.removeEventListener('abort', abort); reject(new ProviderError('The provider took too long to answer.', 408)); };
    xhr.onabort = () => { request.signal?.removeEventListener('abort', abort); reject(new ProviderError('Stopped', -1)); };
    xhr.send(JSON.stringify({
      model: request.model,
      messages: request.messages,
      stream: true,
      ...(withUsage ? {stream_options: {include_usage: true}} : {}),
      temperature: request.temperature ?? 0.4,
      ...(request.tools?.length ? {tools: request.tools, tool_choice: 'auto'} : {}),
    }));
  });
}

export interface ModelInfo {id: string; label: string; free: boolean; context?: number}

export async function listModels(providerId: string, baseUrl: string, apiKey?: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {headers: headers({apiKey, providerId})});
  const body = await response.text();
  if (!response.ok) throw new ProviderError(describeError(response.status, body), response.status);
  const parsed = JSON.parse(body);
  const items: any[] = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.models ?? [];
  const models = items.map(item => {
    const id = String(item.id ?? item.name ?? '').replace(/^models\//, '');
    const free = providerId !== 'openrouter' || (item.pricing && Number(item.pricing.prompt) === 0 && Number(item.pricing.completion) === 0);
    return {id, label: item.name && providerId === 'openrouter' ? String(item.name) : id, free, context: item.context_length ?? item.inputTokenLimit};
  }).filter(model => model.id && !/embed|tts|whisper|imagen|veo|guard|rerank|moderation|aqa|image-generation/i.test(model.id));
  if (providerId === 'openrouter') models.sort((a, b) => Number(b.free) - Number(a.free) || a.label.localeCompare(b.label));
  else models.sort((a, b) => a.id.localeCompare(b.id));
  return models;
}

export async function testConnection(providerId: string, baseUrl: string, model: string, apiKey?: string): Promise<string> {
  const result = await streamChat({providerId, baseUrl, apiKey, model, messages: [{role: 'user', content: 'Reply with the single word: ready'}], temperature: 0});
  return result.text.trim().slice(0, 80) || 'Connected';
}
