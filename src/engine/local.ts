import {forgeNative, onNativeEvent} from '../native';
import type {ApiMessage, ChatTool, ToolCall} from './providers';

export interface LocalModelDef {id: string; name: string; family: string; url: string; file: string; size: number; sha256: string; minRamGb: number; note: string}

const hf = (path: string) => `https://huggingface.co/${path}`;

export const LOCAL_MODELS: LocalModelDef[] = [
  {id: 'qwen2.5-0.5b', name: 'Qwen 2.5 0.5B', family: 'Qwen', url: hf('Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf'), file: 'qwen2.5-0.5b-instruct-q4_k_m.gguf', size: 491400032, sha256: '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db', minRamGb: 3, note: 'Smallest and fastest. Good for quick questions.'},
  {id: 'gemma-3-1b', name: 'Gemma 3 1B', family: 'Gemma', url: hf('ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf'), file: 'gemma-3-1b-it-Q4_K_M.gguf', size: 806058240, sha256: '8ccc5cd1f1b3602548715ae25a66ed73fd5dc68a210412eea643eb20eb75a135', minRamGb: 4, note: 'Balanced writing quality for its size.'},
  {id: 'llama-3.2-1b', name: 'Llama 3.2 1B', family: 'Llama', url: hf('bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf'), file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf', size: 807694464, sha256: '6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83', minRamGb: 4, note: 'Solid general assistant.'},
  {id: 'qwen3-1.7b', name: 'Qwen 3 1.7B', family: 'Qwen', url: hf('unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf'), file: 'Qwen3-1.7B-Q4_K_M.gguf', size: 1107409472, sha256: 'b139949c5bd74937ad8ed8c8cf3d9ffb1e99c866c823204dc42c0d91fa181897', minRamGb: 6, note: 'Reasons step by step. Best for code under 2B.'},
  {id: 'qwen2.5-1.5b', name: 'Qwen 2.5 1.5B', family: 'Qwen', url: hf('Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf'), file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', size: 1117320736, sha256: '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e', minRamGb: 6, note: 'Strong instruction following.'},
  {id: 'llama-3.2-3b', name: 'Llama 3.2 3B', family: 'Llama', url: hf('bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf'), file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf', size: 2019377696, sha256: '6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff', minRamGb: 8, note: 'Noticeably smarter. Needs a recent phone.'},
  {id: 'qwen3-4b', name: 'Qwen 3 4B Instruct', family: 'Qwen', url: hf('unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf'), file: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf', size: 2497281120, sha256: '3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597', minRamGb: 10, note: 'The most capable model here. Flagship phones only.'},
];

export function modelPath(file: string): string {
  return `${forgeNative.modelsDir}/${file}`;
}

export async function downloadModel(model: {id: string; url: string; file: string; sha256?: string}, onProgress: (fraction: number, received: number) => void): Promise<string> {
  const off = onNativeEvent('ForgeDownload', event => {
    if (event.id === `model-${model.id}` && event.total > 0) onProgress(event.received / event.total, event.received);
  });
  try { return await forgeNative.download(`model-${model.id}`, model.url, modelPath(model.file), model.sha256 || null); } finally { off(); }
}

export function cancelModelDownload(id: string) { return forgeNative.cancelDownload(`model-${id}`); }

type LlamaModule = typeof import('llama.rn');
type LlamaContext = Awaited<ReturnType<LlamaModule['initLlama']>>;
let loaded: {path: string; context: LlamaContext} | null = null;

function llama(): LlamaModule {
  try { return require('llama.rn') as LlamaModule; } catch { throw new Error('On-device models are not available in this build.'); }
}

export async function loadModel(path: string): Promise<LlamaContext> {
  if (loaded?.path === path) return loaded.context;
  if (loaded) { await loaded.context.release().catch(() => undefined); loaded = null; }
  const context = await llama().initLlama({model: path, n_ctx: 4096, n_batch: 256, n_threads: 4, use_mlock: false});
  loaded = {path, context};
  return context;
}

export async function unloadModel() {
  if (loaded) { await loaded.context.release().catch(() => undefined); loaded = null; }
}

export interface LocalResult {text: string; toolCalls: ToolCall[]; usage: {prompt: number; completion: number}}

export async function localChat(path: string, messages: ApiMessage[], onText: (delta: string) => void, signal?: AbortSignal, tools?: ChatTool[]): Promise<LocalResult> {
  const context = await loadModel(path);
  const useTools = !!tools?.length && context.isJinjaSupported();
  const formatted = messages.flatMap(message => {
    if (message.role === 'user') return [{role: 'user', content: typeof message.content === 'string' ? message.content : message.content.map(part => part.type === 'text' ? part.text : '[image]').join('\n')}];
    if (message.role === 'assistant') return [{role: 'assistant', content: message.content ?? '', ...(useTools && message.tool_calls?.length ? {tool_calls: message.tool_calls} : {})}];
    if (message.role === 'tool') return useTools ? [{role: 'tool', tool_call_id: message.tool_call_id, content: message.content}] : [];
    return [{role: message.role, content: message.content}];
  }).filter(message => message.content || 'tool_calls' in message);
  const stop = () => { void context.stopCompletion(); };
  signal?.addEventListener('abort', stop);
  try {
    const result = await context.completion({
      messages: formatted as any,
      n_predict: 1024,
      temperature: 0.6,
      top_p: 0.9,
      stop: ['<|im_end|>', '<|eot_id|>', '<end_of_turn>', '</s>'],
      ...(useTools ? {jinja: true, tools, tool_choice: 'auto'} : {}),
    }, data => { if (data.token) onText(data.token); });
    const toolCalls = useTools ? (result.tool_calls ?? []).filter(call => call.function?.name).map((call, index) => ({
      id: call.id || `local_${Date.now()}_${index}`,
      name: call.function.name,
      arguments: typeof call.function.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function.arguments ?? {}),
    })) : [];
    const text = (useTools ? result.content ?? result.text : result.text) ?? '';
    return {text: text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim(), toolCalls, usage: {prompt: result.timings?.prompt_n ?? 0, completion: result.timings?.predicted_n ?? result.tokens_predicted ?? 0}};
  } finally { signal?.removeEventListener('abort', stop); }
}
