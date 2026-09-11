import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Kind, LayerId } from './data/catalog';
import { messages, type Layers, type Msg } from './data/rules';
import { addOutcome, emptySolution, loadInitial, reduce, type Action, type Solution } from './lib/state';
import { createStore } from './lib/storage';
import StartView from './views/StartView';
import LayersView from './views/LayersView';
import BuildView from './views/BuildView';
import DecisionsView from './views/DecisionsView';
import QuestionsView from './views/QuestionsView';
import GuideView from './views/GuideView';
import ShareView from './views/ShareView';

export type View = 'start' | 'lag' | 'build' | 'beslutninger' | 'spoergsmaal' | 'guide' | 'del';
export type Audience = 'ledelse' | 'teknik';
export type Panel =
  | { mode: 'intro' }
  | { mode: 'layer'; id: LayerId }
  | { mode: 'tech'; id: string }
  | { mode: 'compare'; a: string; b: string }
  | { mode: 'cmpPick'; a: string };

export interface UI {
  view: View; audience: Audience; panel: Panel;
  query: string; fLayer: LayerId | 'alle'; fKind: Kind | 'alle';
  mTab: 'katalog' | 'loesning' | 'panel';
  pending?: { layer: LayerId; id: string };
  drag?: string; dragOver?: LayerId;
}

export interface Ctx {
  sol: Solution; ui: UI; msgs: Msg[];
  dispatch: (a: Action) => void;
  setUi: (p: Partial<UI>) => void;
  go: (v: View) => void;
  undo: () => void; canUndo: boolean;
  notify: (text: string, bad?: boolean) => void;
  add: (id: string, layer?: LayerId) => void;
  openTech: (id: string) => void;
  openLayer: (id: LayerId) => void;
  storeKind: 'local' | 'supabase';
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

const store = createStore();
const LAYER_ACTIONS = new Set(['add', 'remove', 'role', 'status', 'reset', 'replace']);

export default function App() {
  const [sol, rawDispatch] = useReducer(reduce, null, () => loadInitial() || emptySolution());
  const [ui, setUiState] = useState<UI>({ view: loadInitial() ? 'build' : 'start', audience: 'ledelse', panel: { mode: 'intro' }, query: '', fLayer: 'alle', fKind: 'alle', mTab: 'loesning' });
  const [undoStack, setUndo] = useState<Layers[]>([]);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const setUi = useCallback((p: Partial<UI>) => setUiState((u) => ({ ...u, ...p })), []);
  const go = useCallback((view: View) => setUi({ view }), [setUi]);

  const notify = useCallback((text: string, bad?: boolean) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, bad });
    toastTimer.current = window.setTimeout(() => setToast(null), 4600);
  }, []);

  const dispatch = useCallback((a: Action) => {
    if (LAYER_ACTIONS.has(a.type)) setUndo((st) => [...st, JSON.parse(JSON.stringify(sol.layers))].slice(-25));
    rawDispatch(a);
  }, [sol.layers]);

  const undo = useCallback(() => {
    setUndo((st) => {
      if (!st.length) return st;
      rawDispatch({ type: 'replace', solution: { ...sol, layers: st[st.length - 1] } });
      return st.slice(0, -1);
    });
    setUi({ pending: undefined });
  }, [sol, setUi]);

  const add = useCallback((id: string, layer?: LayerId) => {
    const o = addOutcome(sol.layers, id, layer);
    notify(o.text, !o.ok);
    if (!o.ok) return;
    dispatch({ type: 'add', id, layer });
    setUi({ pending: o.pending });
  }, [sol.layers, dispatch, notify, setUi]);

  const openTech = useCallback((id: string) => {
    setUiState((u) => {
      if (u.panel.mode === 'cmpPick' && u.panel.a !== id) return { ...u, panel: { mode: 'compare', a: u.panel.a, b: id }, mTab: 'panel' };
      return { ...u, panel: { mode: 'tech', id }, mTab: 'panel' };
    });
  }, []);
  const openLayer = useCallback((id: LayerId) => setUi({ panel: { mode: 'layer', id }, mTab: 'panel' }), [setUi]);

  // Persistens: localStorage altid, Supabase når konfigureret. Debounced.
  useEffect(() => {
    const t = window.setTimeout(() => { store.save(sol).catch((e) => notify('Kunne ikke gemme: ' + (e as Error).message, true)); }, 400);
    return () => window.clearTimeout(t);
  }, [sol, notify]);

  const msgs = useMemo(() => messages({ layers: sol.layers, useCases: sol.useCases, priorities: sol.priorities }), [sol.layers, sol.useCases, sol.priorities]);

  const ctx: Ctx = { sol, ui, msgs, dispatch, setUi, go, undo, canUndo: undoStack.length > 0, notify, add, openTech, openLayer, storeKind: store.kind };

  const openDecisions = msgs.filter((m) => m.tag !== 'rolle' && sol.decisions[m.key]?.status !== 'besluttet').length
    + Object.entries(sol.decisions).filter(([, d]) => d.text && d.status !== 'besluttet').length;
  const openQuestions = Object.values(sol.questions).flat().filter((q) => !q.answer).length;

  const nav: { id: View; label: string; n?: number }[] = [
    { id: 'start', label: 'Start' }, { id: 'lag', label: 'Seks lag' }, { id: 'build', label: 'Byg' },
    { id: 'beslutninger', label: 'Beslutninger', n: openDecisions }, { id: 'spoergsmaal', label: 'Spørgsmål', n: openQuestions },
    { id: 'guide', label: 'AI-guide' }, { id: 'del', label: 'Del' },
  ];

  return (
    <AppCtx.Provider value={ctx}>
      <div className="app">
        <header className="hdr">
          <span className="brand">AN<span>/</span></span>
          <span className="sub">Byg din egen data- og AI-løsning</span>
          <nav className="nav">
            {nav.map((n) => (
              <button key={n.id} className={'navbtn' + (ui.view === n.id ? ' on' : '')} onClick={() => go(n.id)}>
                {n.label}{n.n ? <span className="n">{n.n}</span> : null}
              </button>
            ))}
          </nav>
        </header>
        {ui.view === 'start' && <StartView />}
        {ui.view === 'lag' && <LayersView />}
        {ui.view === 'build' && <BuildView />}
        {ui.view === 'beslutninger' && <DecisionsView />}
        {ui.view === 'spoergsmaal' && <QuestionsView />}
        {ui.view === 'guide' && <GuideView />}
        {ui.view === 'del' && <ShareView />}
        {toast && (
          <div role="status" className={'toast' + (toast.bad ? ' bad' : '')}>
            {toast.bad && <span className="b">Hov</span>}
            <span>{toast.text}</span>
          </div>
        )}
      </div>
    </AppCtx.Provider>
  );
}
