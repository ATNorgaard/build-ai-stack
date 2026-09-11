import { useState } from 'react';
import { LAYERS } from '../data/catalog';
import { OWNER_LABELS, techById } from '../data/rules';
import { useApp } from '../App';
import { QuestionBlock } from '../components/Panel';

export default function QuestionsView() {
  const { sol, dispatch, openTech, openLayer, setUi } = useApp();
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const all = Object.entries(sol.questions).flatMap(([ctx, list]) => list.map((q) => ({ ctx, ...q }))).sort((a, b) => (a.answer ? 1 : 0) - (b.answer ? 1 : 0) || b.v - a.v);
  const ctxLabel = (ctx: string) => ctx === 'generelt' ? 'Generelt' : techById(ctx)?.n || LAYERS.find((l) => l.id === ctx)?.label || ctx;
  const openCtx = (ctx: string) => {
    if (techById(ctx)) openTech(ctx); else if (LAYERS.some((l) => l.id === ctx)) openLayer(ctx as (typeof LAYERS)[number]['id']);
    setUi({ view: 'build' });
  };
  const saveAnswer = (ctx: string, id: string) => { dispatch({ type: 'answer', ctx, id, answer: draft.trim() }); setDraftFor(null); setDraft(''); };
  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 960 }}>
        <span className="eyebrow">Spørgsmål</span>
        <h1 className="display" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.6rem)' }}>Det, ledelsen ikke forstår – og det, teknikerne <em>mangler</em> at få at vide.</h1>
        <p className="lead">Alle spørgsmål fra kort og lag samlet ét sted, sorteret efter stemmer. Skriv svaret ind, så bliver det til fælles viden i løsningsarket.</p>
        <div style={{ marginTop: 26, borderTop: '1px solid var(--line-contrast)' }}>
          {all.map((q) => (
            <div key={q.ctx + q.id} className="q" style={{ padding: '14px 0' }}>
              <button className="vote" onClick={() => dispatch({ type: 'vote', ctx: q.ctx, id: q.id })}>▲ {q.v}</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-link" style={{ borderBottom: 0 }} onClick={() => openCtx(q.ctx)}>{ctxLabel(q.ctx)}</button>
                  <span className="pill-owner light" data-o={q.by}>{OWNER_LABELS[q.by]}</span>
                </div>
                <p className="body" style={{ marginTop: 4 }}>{q.q}</p>
                {q.answer && draftFor !== q.id && <p className="ans">{q.answer} <button className="btn-link" style={{ marginLeft: 8, borderBottom: 0 }} onClick={() => { setDraftFor(q.id); setDraft(q.answer || ''); }}>ret</button></p>}
                {draftFor === q.id ? (
                  <div className="askbox">
                    <input value={draft} placeholder="Skriv svaret…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveAnswer(q.ctx, q.id)} autoFocus />
                    <button className="btn btn-sm btn-ink" onClick={() => saveAnswer(q.ctx, q.id)}>Gem svar</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setDraftFor(null)}>Annullér</button>
                  </div>
                ) : !q.answer && <button className="btn-link" style={{ marginTop: 6 }} onClick={() => { setDraftFor(q.id); setDraft(''); }}>Svar</button>}
              </div>
            </div>
          ))}
          {!all.length && <p className="body" style={{ padding: '26px 0' }}>Ingen spørgsmål endnu. Stil dem fra et kort i byggeren – eller herunder.</p>}
        </div>
        <div style={{ marginTop: 20 }}>
          <QuestionBlock ctx="generelt" title="Stil et generelt spørgsmål" />
        </div>
      </div>
    </div>
  );
}
