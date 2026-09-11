// Løsningens tilstand, reducer og persistens (localStorage + URL-hash). Ingen server nødvendig.
import { LAYERS, type LayerId } from '../data/catalog';
import type { PriorityId } from '../data/extra';
import { emptyLayers, techById, TAG_OWNER, type Layers, type Owner, type Role, type ItemStatus, type Tag } from '../data/rules';
import { PRESETS } from '../data/catalog';
import type { GuideResult } from './guide';

export type DecisionStatus = 'aaben' | 'besluttet';
export interface Decision {
  owner?: Owner; status: DecisionStatus; note: string;
  /** Sat på punkter, der ikke kommer fra regelmotoren (fx fra AI-guiden). */
  title?: string; text?: string; tag?: Tag;
}
export interface Question { id: string; q: string; v: number; by: Owner; answer?: string; ts: number }

export interface Solution {
  id: string;
  name: string;
  layers: Layers;
  useCases: string[];
  priorities: PriorityId[];
  existingInfra: string;
  formaal: string;
  aabent: string;
  decisions: Record<string, Decision>;
  /** Spørgsmål pr. kontekst: teknologi-id, lag-id eller 'generelt'. */
  questions: Record<string, Question[]>;
  guide?: GuideResult;
  guideQuestion?: string;
  updatedAt: number;
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export function emptySolution(name = 'Min løsning'): Solution {
  return {
    id: newId(), name, layers: emptyLayers(), useCases: [], priorities: [], existingInfra: '',
    formaal: '', aabent: '', decisions: {}, questions: {}, updatedAt: Date.now(),
  };
}

export function fromPreset(presetId: string, copy: boolean): Solution {
  const p = PRESETS.find((x) => x.id === presetId);
  const s = emptySolution();
  if (!p) return s;
  s.name = copy ? 'Min version af ' + p.name : p.name + ' (eksempel)';
  (Object.keys(p.layers) as LayerId[]).forEach((k) => {
    s.layers[k] = (p.layers[k] || []).map((id, i) => ({ id, role: i === 0 ? 'primaer' : 'supplement', status: 'planlagt' }));
  });
  return s;
}

export type Action =
  | { type: 'replace'; solution: Solution }
  | { type: 'name'; name: string }
  | { type: 'add'; id: string; layer?: LayerId }
  | { type: 'remove'; layer: LayerId; id: string }
  | { type: 'role'; layer: LayerId; id: string; role: Role }
  | { type: 'status'; layer: LayerId; id: string; status: ItemStatus }
  | { type: 'reset' }
  | { type: 'useCase'; id: string }
  | { type: 'priority'; id: PriorityId }
  | { type: 'field'; field: 'existingInfra' | 'formaal' | 'aabent'; value: string }
  | { type: 'decision'; key: string; patch: Partial<Decision>; tag?: Tag }
  | { type: 'ask'; ctx: string; q: string; by: Owner; v?: number }
  | { type: 'vote'; ctx: string; id: string }
  | { type: 'answer'; ctx: string; id: string; answer: string }
  | { type: 'guide'; result?: GuideResult; question?: string };

export interface AddOutcome { ok: boolean; text: string; pending?: { layer: LayerId; id: string } }

/** Ren funktion, så både reducer og UI kan forudsige udfaldet af en tilføjelse. */
export function addOutcome(L: Layers, id: string, layerId?: LayerId): AddOutcome {
  const t = techById(id);
  if (!t) return { ok: false, text: 'Ukendt teknologi.' };
  const lid = layerId || t.l;
  const cur = L[lid] || [];
  const lbl = (x: LayerId) => LAYERS.find((l) => l.id === x)!.label.toLowerCase();
  if (lid !== t.l) return { ok: false, text: `${t.n} hører til i ${lbl(t.l)} – ikke i ${lbl(lid)}.` };
  if (cur.some((x) => x.id === id)) return { ok: false, text: `${t.n} er allerede i ${lbl(lid)}.` };
  return { ok: true, text: `${t.n} er lagt i ${lbl(lid)}${cur.length ? ' – vælg primær eller supplement.' : '.'}`, pending: cur.length ? { layer: lid, id } : undefined };
}

export function reduce(s: Solution, a: Action): Solution {
  const touch = (n: Solution): Solution => ({ ...n, updatedAt: Date.now() });
  switch (a.type) {
    case 'replace': return a.solution;
    case 'name': return touch({ ...s, name: a.name });
    case 'add': {
      const o = addOutcome(s.layers, a.id, a.layer);
      if (!o.ok) return s;
      const t = techById(a.id)!;
      const lid = a.layer || t.l;
      const cur = s.layers[lid] || [];
      return touch({ ...s, layers: { ...s.layers, [lid]: [...cur, { id: a.id, role: cur.length ? 'supplement' : 'primaer', status: 'planlagt' }] } });
    }
    case 'remove': {
      let items = (s.layers[a.layer] || []).filter((x) => x.id !== a.id);
      if (items.length && !items.some((x) => x.role === 'primaer')) items = items.map((x, i) => (i === 0 ? { ...x, role: 'primaer' } : x));
      return touch({ ...s, layers: { ...s.layers, [a.layer]: items } });
    }
    case 'role': {
      const items = (s.layers[a.layer] || []).map((x) => (x.id === a.id ? { ...x, role: a.role } : a.role === 'primaer' ? { ...x, role: 'supplement' as Role } : x));
      return touch({ ...s, layers: { ...s.layers, [a.layer]: items } });
    }
    case 'status': {
      const items = (s.layers[a.layer] || []).map((x) => (x.id === a.id ? { ...x, status: a.status } : x));
      return touch({ ...s, layers: { ...s.layers, [a.layer]: items } });
    }
    case 'reset': return touch({ ...s, layers: emptyLayers(), decisions: {}, guide: undefined });
    case 'useCase': return touch({ ...s, useCases: s.useCases.includes(a.id) ? s.useCases.filter((x) => x !== a.id) : [...s.useCases, a.id] });
    case 'priority': return touch({ ...s, priorities: s.priorities.includes(a.id) ? s.priorities.filter((x) => x !== a.id) : [...s.priorities, a.id] });
    case 'field': return touch({ ...s, [a.field]: a.value });
    case 'decision': {
      const cur = s.decisions[a.key] || { status: 'aaben', note: '', owner: a.tag ? TAG_OWNER[a.tag] : undefined };
      return touch({ ...s, decisions: { ...s.decisions, [a.key]: { ...cur, ...a.patch } } });
    }
    case 'ask': {
      const cur = s.questions[a.ctx] || [];
      return touch({ ...s, questions: { ...s.questions, [a.ctx]: [...cur, { id: newId(), q: a.q, v: a.v ?? 1, by: a.by, ts: Date.now() }] } });
    }
    case 'vote': {
      const cur = (s.questions[a.ctx] || []).map((q) => (q.id === a.id ? { ...q, v: q.v + 1 } : q));
      return touch({ ...s, questions: { ...s.questions, [a.ctx]: cur } });
    }
    case 'answer': {
      const cur = (s.questions[a.ctx] || []).map((q) => (q.id === a.id ? { ...q, answer: a.answer } : q));
      return touch({ ...s, questions: { ...s.questions, [a.ctx]: cur } });
    }
    case 'guide': return touch({ ...s, guide: a.result, guideQuestion: a.question ?? s.guideQuestion });
  }
}

// ---------- Persistens ----------
const LS_KEY = 'loesningsbygger:solution';

export function encodeHash(s: Solution): string {
  const json = JSON.stringify(s);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeHash(h: string): Solution | null {
  try {
    const b64 = h.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return normalise(obj);
  } catch { return null; }
}

/** Sikrer at en gemt løsning har alle felter, også når modellen er udvidet siden. */
export function normalise(obj: Partial<Solution> | null | undefined): Solution | null {
  if (!obj || typeof obj !== 'object') return null;
  const base = emptySolution();
  const layers = emptyLayers();
  const src = (obj.layers || {}) as Partial<Layers>;
  LAYERS.forEach((l) => {
    layers[l.id] = (src[l.id] || []).map((x) => ({ id: x.id, role: x.role === 'primaer' ? 'primaer' : 'supplement', status: x.status === 'eksisterende' ? 'eksisterende' : 'planlagt' }));
  });
  return { ...base, ...obj, layers, useCases: obj.useCases || [], priorities: obj.priorities || [], decisions: obj.decisions || {}, questions: obj.questions || {} };
}

export function loadInitial(): Solution | null {
  const h = location.hash.match(/#s=([A-Za-z0-9_-]+)/);
  if (h) { const s = decodeHash(h[1]); if (s) return s; }
  try { const raw = localStorage.getItem(LS_KEY); if (raw) return normalise(JSON.parse(raw)); } catch { /* ignorer */ }
  return null;
}

export function persist(s: Solution) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* privat vindue */ }
}

export function shareUrl(s: Solution): string {
  return location.origin + location.pathname + '#s=' + encodeHash(s);
}
