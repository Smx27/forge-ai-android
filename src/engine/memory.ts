export interface MemoryEntry {id: string; text: string; kind: 'fact' | 'preference' | 'decision' | 'todo'; ts: number}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9#]+/).filter(word => word.length > 2);

export function rankMemory(entries: MemoryEntry[], query: string, limit = 8): MemoryEntry[] {
  const terms = new Set(words(query));
  if (!terms.size) return entries.slice(0, limit);
  return entries
    .map(entry => ({entry, score: words(entry.text).reduce((sum, word) => sum + (terms.has(word) ? 1 : 0), 0) + (entry.kind === 'preference' ? 0.5 : 0)}))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.ts - a.entry.ts)
    .slice(0, limit)
    .map(item => item.entry);
}
