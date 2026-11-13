import {AppState, PermissionsAndroid, Platform} from 'react-native';
import {forgeNative} from '../native';
import {useChats, newId, type ChatMessage} from '../stores/chats';
import {useSettings, providerKey} from '../stores/settings';
import {useLibrary} from '../stores/library';
import {useLinux} from '../stores/linux';
import {useUsage, dayKey, tokensOn} from '../stores/usage';
import {PROVIDERS} from './providers';
import {providerById, streamChat, ProviderError, type ApiMessage, type ChatTool, type ContentPart, type ToolCall} from './providers';
import {availableTools, executeTool, needsApproval, summarizeCall} from './tools';
import {rankMemory} from './memory';
import {localChat, modelPath} from './local';
import {captureBefore} from './checkpoints';

const controllers = new Map<string, AbortController>();
let notificationsAsked = false;

function startService(title: string) {
  if (Platform.OS !== 'android') return;
  if (!notificationsAsked && Number(Platform.Version) >= 33) {
    notificationsAsked = true;
    void PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => undefined);
  }
  void forgeNative.setAgentService(true, title.slice(0, 80)).catch(() => undefined);
}

export function isRunning(chatId: string) { return controllers.has(chatId); }

export function stopAgent(chatId: string) {
  controllers.get(chatId)?.abort();
  const approval = useChats.getState().approval;
  if (approval?.chatId === chatId) { approval.resolve(false); useChats.getState().setApproval(null); }
}

function systemPrompt(userText: string, toolsEnabled: boolean, folder?: string): string {
  const settings = useSettings.getState();
  const library = useLibrary.getState();
  const linux = useLinux.getState();
  const skills = library.skills.filter(skill => skill.enabled);
  const memories = settings.memoryEnabled ? rankMemory(library.memory, userText, 6) : [];
  const lines = [
    'You are Forge, a capable AI engineer and assistant running inside an Android app on the user\'s phone.',
    `Today is ${new Date().toDateString()}. Device: ${forgeNative.device}.`,
    'Be direct and concise. Use Markdown. Prefer short paragraphs and code blocks with a language tag.',
  ];
  if (toolsEnabled) {
    lines.push(
      folder
        ? `You can act through tools. This chat works in the project folder "${folder}"; all file paths are relative to it, and commands start there (/root/workspace/${folder} in Linux).`
        : 'You can act through tools. A private workspace folder holds the user\'s files; all file paths are relative to it.',
      linux.installed ? 'A real Alpine Linux shell is available through run_command (workspace mounted at /root/workspace). Install packages with apk add when needed. Use start_server for dev servers; the user can preview localhost ports in the app.' : 'The Linux shell is not installed, so run_command will fail. File tools still work.',
      'For multi-step work, call update_plan first, then keep it current. Read files before editing them. Verify your work when you can. Finish with a short summary of what changed.',
    );
    if (settings.githubLogin && linux.installed) lines.push(`git is configured with the user's GitHub account (${settings.githubLogin}); clone, commit and push over HTTPS work without extra setup.`);
    if (skills.length) lines.push('Installed skills (call load_skill to read one before using it):', ...skills.map(skill => `- ${skill.slug}: ${skill.description.slice(0, 200)}`));
  }
  if (memories.length) lines.push('Things you remember about the user:', ...memories.map(entry => `- ${entry.text}`));
  if (settings.systemPrompt.trim()) lines.push('User instructions:', settings.systemPrompt.trim());
  return lines.join('\n');
}

async function userContent(message: Extract<ChatMessage, {role: 'user'}>, withImages: boolean): Promise<string | ContentPart[]> {
  if (!message.images?.length) return message.text;
  if (!withImages) return `${message.text}\n[${message.images.length} image${message.images.length === 1 ? '' : 's'} attached earlier]`.trim();
  const parts: ContentPart[] = [];
  if (message.text) parts.push({type: 'text', text: message.text});
  for (const path of message.images) {
    try { parts.push({type: 'image_url', image_url: {url: `data:image/jpeg;base64,${await forgeNative.readBase64(path)}`}}); }
    catch { parts.push({type: 'text', text: '[an attached image is no longer available]'}); }
  }
  return parts;
}

async function toApi(messages: ChatMessage[]): Promise<ApiMessage[]> {
  const out: ApiMessage[] = [];
  const imageTurns = new Set(messages.filter(message => message.role === 'user' && message.images?.length).slice(-3).map(message => message.id));
  for (const message of messages) {
    if (message.role === 'user') out.push({role: 'user', content: await userContent(message, imageTurns.has(message.id))});
    else if (message.role === 'assistant') {
      if (message.error && !message.text && !message.toolCalls?.length) continue;
      out.push({role: 'assistant', content: message.text || null, ...(message.toolCalls?.length ? {tool_calls: message.toolCalls.map(call => ({id: call.id, type: 'function' as const, function: {name: call.name, arguments: call.arguments}}))} : {})});
    } else out.push({role: 'tool', tool_call_id: message.toolCallId, content: message.result.output.slice(0, 16000)});
  }
  const answered = new Set(out.filter(message => message.role === 'tool').map(message => (message as {tool_call_id: string}).tool_call_id));
  return out.map(message => message.role === 'assistant' && message.tool_calls ? {...message, tool_calls: message.tool_calls.filter(call => answered.has(call.id))} : message)
    .map(message => message.role === 'assistant' && message.tool_calls && !message.tool_calls.length ? {role: 'assistant' as const, content: message.content ?? ''} : message);
}

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? clean.slice(0, 46).replace(/\s\S*$/, '') + '…' : clean || 'New chat';
}

async function approve(chatId: string, callId: string, name: string, summary: string, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false;
  return new Promise(resolve => {
    useChats.getState().setApproval({chatId, callId, name, summary, resolve: approved => { useChats.getState().setApproval(null); resolve(approved); }});
  });
}

export async function sendMessage(chatId: string, text: string, images: string[] = []): Promise<void> {
  const chats = useChats.getState();
  if (controllers.has(chatId)) return;
  const chat = chats.chats.find(item => item.id === chatId);
  if (chat && chat.title === 'New chat' && !(chats.messages[chatId] ?? []).length) chats.renameChat(chatId, titleFrom(text || 'Image'));
  chats.append(chatId, {id: newId(), role: 'user', text, ts: Date.now(), ...(images.length ? {images} : {})});
  await runAgent(chatId);
}

export async function regenerate(chatId: string): Promise<void> {
  const list = useChats.getState().messages[chatId] ?? [];
  const lastUser = [...list].reverse().find(message => message.role === 'user');
  if (!lastUser) return;
  const index = list.indexOf(lastUser);
  const next = list[index + 1];
  if (next) useChats.getState().truncateFrom(chatId, next.id);
  await runAgent(chatId);
}

type ModelTurn = {text: string; toolCalls: ToolCall[]; usage?: {prompt: number; completion: number}};
type ModelCaller = (messages: ApiMessage[], tools: ChatTool[], onText: (delta: string) => void, signal: AbortSignal) => Promise<ModelTurn>;

function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, ' '.repeat(3000)).length / 4);
}

async function prepareModel(providerId?: string): Promise<{name: string; caller: ModelCaller; tools: ChatTool[]; providerId: string}> {
  const settings = useSettings.getState();
  const provider = providerById(providerId ?? settings.activeProvider);
  const hasSkills = useLibrary.getState().skills.some(skill => skill.enabled);
  if (provider.kind === 'device') {
    const model = useLibrary.getState().models.find(item => item.id === settings.localModelId);
    if (!model) throw new Error('Pick an on-device model in Settings → Models first.');
    return {
      name: model.name, providerId: provider.id,
      tools: settings.localTools ? availableTools({webTools: false, memoryEnabled: false, hasSkills: false, local: true}) : [],
      caller: (messages, tools, onText, signal) => localChat(modelPath(model.file), messages, onText, signal, tools),
    };
  }
  const apiKey = provider.needsKey ? await providerKey(provider.id) : null;
  if (provider.needsKey && !apiKey) throw new Error(`Add your ${provider.name} API key in Settings → Models to start chatting.`);
  const config = settings.providers[provider.id];
  const model = config?.model || provider.defaultModel;
  return {
    name: model, providerId: provider.id,
    tools: availableTools({webTools: settings.webTools, memoryEnabled: settings.memoryEnabled, hasSkills}),
    caller: (messages, tools, onText, signal) => streamChat({providerId: provider.id, baseUrl: config?.baseUrl || provider.baseUrl, apiKey: apiKey ?? undefined, model, messages, tools, temperature: settings.temperature, signal, onText}),
  };
}

export async function completeOnce(system: string, user: string, signal?: AbortSignal): Promise<string> {
  const model = await prepareModel();
  const messages: ApiMessage[] = [{role: 'system', content: system}, {role: 'user', content: user}];
  const started = Date.now();
  const turn = await model.caller(messages, [], () => undefined, signal ?? new AbortController().signal);
  useUsage.getState().record(model.providerId, turn.usage?.prompt ?? estimateTokens(messages), turn.usage?.completion ?? estimateTokens(turn.text), !turn.usage, {model: model.name, ms: Date.now() - started});
  return turn.text;
}

function fallbackFor(error: unknown, tried: string[]): string | null {
  if (!(error instanceof ProviderError) || !useSettings.getState().autoFallback) return null;
  if (!(error.status === 429 || error.status === 0 || error.status >= 500)) return null;
  const providers = useSettings.getState().providers;
  return PROVIDERS.find(item => item.kind === 'openai' && item.needsKey && providers[item.id]?.hasKey && !tried.includes(item.id))?.id ?? null;
}

function checkBudget() {
  const budget = useSettings.getState().dailyBudget;
  const usage = useUsage.getState();
  const today = dayKey();
  if (budget <= 0 || usage.budgetAlerted === today || tokensOn(usage.days, today) <= budget) return;
  usage.markBudgetAlerted(today);
  if (Platform.OS === 'android') void forgeNative.notify('Daily token budget reached', `You have used more than ${budget.toLocaleString()} tokens today.`, null).catch(() => undefined);
}

function notifyDone(chatId: string) {
  if (Platform.OS !== 'android' || AppState.currentState === 'active' || !useSettings.getState().notifyWhenDone) return;
  const chat = useChats.getState().chats.find(item => item.id === chatId);
  const last = [...(useChats.getState().messages[chatId] ?? [])].reverse().find(message => message.role === 'assistant' && (message.text || message.error));
  const body = last?.role === 'assistant' ? (last.error ? `Stopped: ${last.error}` : last.text.replace(/[#*`>_]/g, '').replace(/\s+/g, ' ').trim()) : 'Finished.';
  void forgeNative.notify(chat?.title ?? 'Forge', body.slice(0, 300) || 'Finished.', chatId).catch(() => undefined);
}

async function runAgent(chatId: string): Promise<void> {
  const controller = new AbortController();
  controllers.set(chatId, controller);
  const store = useChats.getState();
  const settings = useSettings.getState();
  store.setRunning(chatId, 'Thinking');
  const lastUser = [...(store.messages[chatId] ?? [])].reverse().find(message => message.role === 'user');
  const chat = useChats.getState().chats.find(item => item.id === chatId);
  const folder = chat?.folder;
  startService(chat?.title ?? 'Working');
  try {
    let model = await prepareModel();
    const tried = [model.providerId];
    let tools = model.tools;
    let pendingNote: string | undefined;
    if (providerById(settings.activeProvider).kind === 'device') store.setRunning(chatId, 'Loading model');
    for (let step = 0; step < settings.maxSteps; step++) {
      if (controller.signal.aborted) break;
      const history = useChats.getState().messages[chatId] ?? [];
      const messages: ApiMessage[] = [{role: 'system', content: systemPrompt(lastUser?.role === 'user' ? lastUser.text : '', tools.length > 0, folder)}, ...(await toApi(history))];
      const assistantId = newId();
      useChats.getState().append(chatId, {id: assistantId, role: 'assistant', text: '', ts: Date.now(), model: model.name, ...(pendingNote ? {note: pendingNote} : {})});
      pendingNote = undefined;
      let streamed = '';
      let pendingPatch: ReturnType<typeof setTimeout> | null = null;
      const flush = () => { pendingPatch = null; useChats.getState().patchMessage(chatId, assistantId, {text: streamed.replace(/<think>[\s\S]*?(<\/think>|$)\s*/g, '')}); };
      if (step > 0) useChats.getState().setRunning(chatId, 'Working');
      let result: ModelTurn;
      const started = Date.now();
      try {
        result = await model.caller(messages, tools, delta => {
          streamed += delta;
          useChats.getState().setRunning(chatId, 'Writing');
          if (!pendingPatch) pendingPatch = setTimeout(flush, 50);
        }, controller.signal);
      } catch (error) {
        if (pendingPatch) clearTimeout(pendingPatch);
        if (error instanceof ProviderError && error.toolsUnsupported && tools.length) {
          tools = [];
          useChats.getState().truncateFrom(chatId, assistantId);
          step--;
          continue;
        }
        if (!controller.signal.aborted) useUsage.getState().recordError(model.providerId);
        const next = controller.signal.aborted ? null : fallbackFor(error, tried);
        if (next) {
          const from = providerById(model.providerId).name;
          const reason = (error as ProviderError).status === 429 ? 'hit its rate limit' : 'is not responding';
          model = await prepareModel(next);
          tried.push(next);
          tools = model.tools;
          useChats.getState().truncateFrom(chatId, assistantId);
          const note = `${from} ${reason}, switched to ${providerById(next).name}`;
          pendingNote = note;
          step--;
          continue;
        }
        throw Object.assign(error as Error, {assistantId});
      }
      if (pendingPatch) clearTimeout(pendingPatch);
      useUsage.getState().record(model.providerId, result.usage?.prompt ?? estimateTokens(messages), result.usage?.completion ?? estimateTokens(result.text + JSON.stringify(result.toolCalls)), !result.usage, {model: model.name, ms: Date.now() - started});
      checkBudget();
      const usedIds = new Set(history.filter(message => message.role === 'tool').map(message => message.toolCallId));
      result.toolCalls = result.toolCalls.map(call => {
        const id = call.id && !usedIds.has(call.id) ? call.id : `call_${newId()}`;
        usedIds.add(id);
        return id === call.id ? call : {...call, id};
      });
      useChats.getState().patchMessage(chatId, assistantId, {text: result.text, toolCalls: result.toolCalls.length ? result.toolCalls : undefined});
      if (!result.toolCalls.length) {
        if (!result.text.trim()) useChats.getState().patchMessage(chatId, assistantId, {error: 'The model returned an empty answer. Try again or pick another model.'});
        return;
      }
      for (const call of result.toolCalls) {
        if (controller.signal.aborted) break;
        const summary = summarizeCall(call.name, call.arguments);
        let toolResult;
        if (needsApproval(call.name, useSettings.getState().approvalMode) && !(await approve(chatId, call.id, call.name, summary, controller.signal))) {
          toolResult = {status: 'denied' as const, output: 'The user declined this action. Ask what they would prefer, or try a different approach.'};
        } else {
          useChats.getState().setRunning(chatId, summary.slice(0, 60));
          let live = '';
          const toolMessageId = newId();
          useChats.getState().append(chatId, {id: toolMessageId, role: 'tool', toolCallId: call.id, name: call.name, ts: Date.now(), result: {status: 'ok', output: '…'}});
          toolResult = await executeTool(call.name, call.arguments, {
            signal: controller.signal, webTools: settings.webTools, memoryEnabled: settings.memoryEnabled, root: folder,
            capture: lastUser ? path => captureBefore(chatId, lastUser.id, path) : undefined,
            onOutput: chunk => { live = (live + chunk).slice(-4000); useChats.getState().patchMessage(chatId, toolMessageId, {result: {status: 'ok', output: live}} as Partial<ChatMessage>); },
          });
          useChats.getState().patchMessage(chatId, toolMessageId, {result: toolResult} as Partial<ChatMessage>);
          continue;
        }
        useChats.getState().append(chatId, {id: newId(), role: 'tool', toolCallId: call.id, name: call.name, ts: Date.now(), result: toolResult});
      }
    }
    if (!controller.signal.aborted) {
      const list = useChats.getState().messages[chatId] ?? [];
      if (list[list.length - 1]?.role === 'tool') useChats.getState().append(chatId, {id: newId(), role: 'assistant', text: '', ts: Date.now(), error: `Stopped after ${settings.maxSteps} steps. Send “continue” to keep going.`});
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const assistantId = (error as {assistantId?: string}).assistantId;
    if (controller.signal.aborted || message === 'Stopped') {
      if (assistantId) {
        const current = (useChats.getState().messages[chatId] ?? []).find(item => item.id === assistantId);
        if (current?.role === 'assistant' && !current.text) useChats.getState().truncateFrom(chatId, assistantId);
      }
    } else if (assistantId) useChats.getState().patchMessage(chatId, assistantId, {error: message});
    else useChats.getState().append(chatId, {id: newId(), role: 'assistant', text: '', ts: Date.now(), error: message});
  } finally {
    const aborted = controller.signal.aborted;
    controllers.delete(chatId);
    useChats.getState().setRunning(chatId, null);
    if (Platform.OS === 'android' && controllers.size === 0) void forgeNative.setAgentService(false, '').catch(() => undefined);
    if (!aborted) notifyDone(chatId);
  }
}
