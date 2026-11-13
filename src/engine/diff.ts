export interface DiffLine {kind: 'add' | 'del' | 'ctx'; text: string}

export function lineDiff(before: string, after: string, context = 2): {lines: DiffLine[]; added: number; removed: number} {
  const a = before ? before.split('\n') : [];
  const b = after.split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) { endA--; endB--; }
  const lines: DiffLine[] = [];
  for (let i = Math.max(0, start - context); i < start; i++) lines.push({kind: 'ctx', text: a[i]});
  const removed = a.slice(start, endA + 1);
  const added = b.slice(start, endB + 1);
  removed.forEach(text => lines.push({kind: 'del', text}));
  added.forEach(text => lines.push({kind: 'add', text}));
  for (let i = endA + 1; i < Math.min(a.length, endA + 1 + context); i++) lines.push({kind: 'ctx', text: a[i]});
  return {lines: lines.slice(0, 400), added: added.length, removed: removed.length};
}
