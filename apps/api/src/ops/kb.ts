/** Small keyword search over the hotel's documents. Good enough to ground an answer; the AI step (when configured) does the reading. */
const STOP = new Set('a an the and or of to in on at for is are be do does can i you we my me it this that with what where when how which there any your our from by as have has'.split(' '));
const SYN: Record<string, string[]> = { refund: ['cancellation', 'cancel'], refunds: ['cancellation', 'cancel'], pool: ['swimming'], swimming: ['pool'], breakfast: ['morning', 'buffet'], cancel: ['cancellation', 'refund'], cancellation: ['cancel', 'refund'], pet: ['dog', 'cat', 'pets'], pets: ['pet', 'dog'], kids: ['children', 'child'], children: ['kids', 'child'], spa: ['massage'], massage: ['spa'], wifi: ['internet'], checkout: ['check-out', 'late'], beach: ['sea'] };
export const tokens = (s: string) => (s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)));
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');
export interface Doc { id: string; title: string; category: string; body: string }
export function searchKb(docs: Doc[], query: string, limit = 3) {
  const qt = [...new Set(tokens(query).flatMap((w) => [w, ...(SYN[w] ?? [])]).map(stem))];
  if (!qt.length) return [];
  const scored = docs.map((d) => {
    const tt = tokens(d.title).map(stem), paras = d.body.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
    let score = 0; let best = { p: paras[0] ?? '', s: 0 };
    for (const q of qt) { if (tt.includes(q)) score += 3; }
    for (const p of paras) { const pt = tokens(p).map(stem); let ps = 0; for (const q of qt) { const n = pt.filter((x) => x === q).length; if (n) ps += 1 + Math.min(n - 1, 2) * 0.3; } score += ps; if (ps > best.s) best = { p, s: ps }; }
    return { doc: d, score, snippet: best.p.slice(0, 500) };
  }).filter((x) => x.score >= 1.5).sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 0;
  return scored.filter((x) => x.score >= top * 0.6).slice(0, limit);
}
