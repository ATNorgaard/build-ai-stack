// Klientside: bygger en tekstlig brief af løsningen og kalder guide-endpointet.
import { LAYERS } from '../data/catalog';
import { USE_CASES, PRIORITIES, NEED_LABELS, COST_LABELS, ROLE_LABELS, COST } from '../data/extra';
import { messages, profile, techById, TAG_LABELS, OWNER_LABELS } from '../data/rules';
import type { Solution } from './state';
import type { GuideResult, GuideItem } from '../../supabase/functions/_shared/guide';
export type { GuideResult, GuideItem };

export function buildBrief(s: Solution): string {
  const P = profile(s.layers);
  const lines: string[] = [];
  lines.push(`LØSNING: ${s.name}`);
  if (s.formaal) lines.push(`Formål: ${s.formaal}`);
  lines.push('');
  lines.push('AI-BEHOV (hvad løsningen skal kunne):');
  if (!s.useCases.length) lines.push('- (intet valgt)');
  s.useCases.forEach((id) => {
    const uc = USE_CASES.find((u) => u.id === id); if (!uc) return;
    lines.push(`- ${uc.name}: ${uc.kort}`);
    LAYERS.forEach((l) => { const n = uc.needs[l.id]; lines.push(`    ${l.label}: ${NEED_LABELS[n.level].toLowerCase()} – ${n.reason}`); });
  });
  lines.push('');
  lines.push('LEDELSENS HENSYN:');
  if (!s.priorities.length) lines.push('- (ingen valgt)');
  s.priorities.forEach((id) => { const p = PRIORITIES.find((x) => x.id === id); if (p) lines.push(`- ${p.label}: ${p.kort}`); });
  lines.push('');
  lines.push('VALGT I DE SEKS LAG (primær/supplement, planlagt/findes allerede):');
  LAYERS.forEach((l) => {
    const items = s.layers[l.id] || [];
    if (!items.length) { lines.push(`- ${l.label}: TOMT`); return; }
    lines.push(`- ${l.label}: ` + items.map((x) => { const t = techById(x.id); return `${t?.n ?? x.id} [${x.role}, ${x.status === 'eksisterende' ? 'findes allerede' : 'ny'}${COST[x.id] ? ', ' + COST_LABELS[COST[x.id]].toLowerCase() : ''}]`; }).join('; '));
  });
  lines.push('');
  lines.push(`Profil: ${P.covered} af 6 lag dækket, ${P.uniq.length} komponenter, leverandører: ${P.vendors.join(', ') || 'ingen'}, selvdrevet: ${P.self.map((id) => techById(id)?.n).join(', ') || 'ingen'}.`);
  lines.push(`Roller løsningen kræver: ${P.roles.map((r) => ROLE_LABELS[r]).join(', ') || 'ingen'}.`);
  lines.push('');
  lines.push('EKSISTERENDE INFRASTRUKTUR (beskrevet af brugeren):');
  lines.push(s.existingInfra.trim() || '- (ikke beskrevet)');
  lines.push('');
  const msgs = messages({ layers: s.layers, useCases: s.useCases, priorities: s.priorities }).filter((m) => m.tag !== 'rolle');
  lines.push('BESKEDER FRA REGELMOTOREN OG STATUS I BESLUTNINGSLOGGEN:');
  msgs.forEach((m) => {
    const d = s.decisions[m.key];
    const st = d?.status === 'besluttet' ? 'BESLUTTET' : 'åben';
    lines.push(`- [${TAG_LABELS[m.tag]} · ${OWNER_LABELS[d?.owner || m.owner]} · ${st}] ${m.text}${d?.note ? ` → Note: ${d.note}` : ''}`);
  });
  const qs = Object.entries(s.questions).flatMap(([ctx, list]) => list.map((q) => ({ ctx, ...q })));
  if (qs.length) {
    lines.push('');
    lines.push('SPØRGSMÅL STILLET I APPEN:');
    qs.sort((a, b) => b.v - a.v).forEach((q) => lines.push(`- (${OWNER_LABELS[q.by]}, ${q.v} stemmer, om ${q.ctx}) ${q.q}${q.answer ? ` → Svar: ${q.answer}` : ''}`));
  }
  if (s.aabent) { lines.push(''); lines.push(`Største åbne spørgsmål ifølge brugeren: ${s.aabent}`); }
  return lines.join('\n');
}

export async function askGuide(s: Solution, question?: string): Promise<GuideResult> {
  const url = import.meta.env.VITE_GUIDE_URL || '/api/guide';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (anon && url.includes('supabase')) { headers.apikey = anon; headers.Authorization = `Bearer ${anon}`; }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ brief: buildBrief(s), question }) });
  const data = await res.json().catch(() => ({ error: `Uventet svar (${res.status})` }));
  if (!res.ok || data.error) throw new Error(data.error || `Fejl ${res.status}`);
  return data as GuideResult;
}
