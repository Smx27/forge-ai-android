const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36 Forge/4';

function decode(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface SearchHit {title: string; url: string; snippet: string}

export async function webSearch(query: string, max = 6): Promise<SearchHit[]> {
  const response = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA},
    body: `q=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Search failed with HTTP ${response.status}`);
  const html = await response.text();
  const hits: SearchHit[] = [];
  const blocks = html.split('class="result__body"').slice(1);
  for (const block of blocks) {
    const link = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    let url = link[1];
    const redirect = url.match(/uddg=([^&]+)/);
    if (redirect) url = decodeURIComponent(redirect[1]);
    if (url.startsWith('//')) url = 'https:' + url;
    if (/duckduckgo\.com\/y\.js/.test(url)) continue;
    const snippet = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    hits.push({title: decode(link[2]), url, snippet: snippet ? decode(snippet[1]) : ''});
    if (hits.length >= max) break;
  }
  return hits;
}

export async function webFetch(url: string, maxChars = 24000): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http and https URLs can be fetched.');
  const response = await fetch(url, {headers: {'User-Agent': UA, Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5'}});
  const type = response.headers.get('content-type') ?? '';
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  if (!/html/i.test(type)) return body.slice(0, maxChars);
  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const text = body
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => '\n' + '#'.repeat(Number(level)) + ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  return ((title ? `# ${decode(title)}\n\n` : '') + text).slice(0, maxChars);
}
