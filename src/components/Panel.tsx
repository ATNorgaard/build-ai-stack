// Forklaringspanelet: lag, teknologi (med publikums-vinkel), sammenligning og spørgsmål.
import { useState } from 'react';
import { KINDS, LAYERS, SEED_Q, SHORTCUTS, TECHS, type LayerId } from '../data/catalog';
import { COST, COST_LABELS, ROLES, ROLE_LABELS, USE_CASES } from '../data/extra';
import { cmpRows, layerById, lbl, techById, OWNER_LABELS, type Owner } from '../data/rules';
import { useApp } from '../App';

export function QuestionBlock({ ctx, title }: { ctx: string; title?: string }) {
  const { sol, dispatch, ui } = useApp();
  const [draft, setDraft] = useState('');
  const [by, setBy] = useState<Owner>(ui.audience === 'teknik' ? 'teknik' : 'ledelse');
  const seeded = (SEED_Q[ctx] || []).map((q, i) => ({ id: 'seed-' + ctx + '-' + i, q: q.q, v: q.v, by: 'ledelse' as Owner, ts: 0, seed: true, answer: undefined as string | undefined }));
  const own = sol.questions[ctx] || [];
  const list = [...own, ...seeded.filter((s) => !own.some((o) => o.q === s.q))].sort((a, b) => b.v - a.v);
  const submit = () => { const t = draft.trim(); if (!t) return; dispatch({ type: 'ask', ctx, q: t, by }); setDraft(''); };
  const vote = (q: (typeof list)[number]) => {
    // Seedede spørgsmål bliver først rigtige (og gemt) når nogen stemmer på dem.
    if ('seed' in q && q.seed) { dispatch({ type: 'ask', ctx, q: q.q, by: q.by, v: q.v + 1 }); return; }
    dispatch({ type: 'vote', ctx, id: q.id });
  };
  return (
    <div className="field">
      <span className="label">{title || 'Spørgsmål til dette'}</span>
      {!list.length && <p className="small faint" style={{ marginTop: 6 }}>Ingen spørgsmål endnu. Stil det første.</p>}
      {list.map((q) => (
        <div key={q.id} className="q">
          <button className="vote" title="Det vil jeg også gerne vide" onClick={() => vote(q)}>▲ {q.v}</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="body" style={{ fontSize: '.86rem' }}>{q.q} <span className="pill-owner" data-o={q.by} style={{ marginLeft: 6 }}>{OWNER_LABELS[q.by]}</span></p>
            {q.answer && <p className="ans">{q.answer}</p>}
          </div>
        </div>
      ))}
      <div className="askbox">
        <input value={draft} placeholder="Stil et spørgsmål…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <select value={by} onChange={(e) => setBy(e.target.value as Owner)}>
          <option value="ledelse">Fra ledelsen</option>
          <option value="teknik">Fra teknik</option>
        </select>
        <button className="btn btn-sm btn-ink" onClick={submit}>Stil</button>
      </div>
    </div>
  );
}

function TechPanel({ id }: { id: string }) {
  const { sol, ui, setUi, add, openTech } = useApp();
  const t = techById(id)!;
  const inLayer = (Object.keys(sol.layers) as LayerId[]).find((k) => sol.layers[k].some((x) => x.id === id));
  const item = inLayer ? sol.layers[inLayer].find((x) => x.id === id) : undefined;
  const others = inLayer ? sol.layers[inLayer].filter((x) => x.id !== id).map((x) => techById(x.id)?.n) : [];
  const fits = USE_CASES.filter((u) => sol.useCases.includes(u.id) && u.aiFit.includes(id));
  const roles = (ROLES[id] || []).map((r) => ROLE_LABELS[r]);
  const ledelse = ui.audience === 'ledelse';
  return (
    <div className="panel">
      <div className="row"><span className="eyebrow">{layerById(t.l).label}</span><button className="close" aria-label="Luk" onClick={() => setUi({ panel: { mode: 'intro' } })}>✕</button></div>
      <h2 style={{ marginTop: 10, fontSize: '1.5rem' }}>{t.n}</h2>
      <p className="body" style={{ marginTop: 6, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: '1rem' }}>{t.t}</p>
      <div className="chips" style={{ marginTop: 10 }}>
        <span className="chip">{KINDS[t.k]}</span>
        {t.pf && <span className="chip on acc">Samme platform · {t.pf}</span>}
        {COST[id] && <span className="chip">Betales med: {COST_LABELS[COST[id]]}</span>}
        {fits.map((u) => <span key={u.id} className="chip on">Passer til: {u.name}</span>)}
      </div>
      <div className="seg">
        <button className={ledelse ? 'on' : ''} onClick={() => setUi({ audience: 'ledelse' })}>For ledelsen</button>
        <button className={!ledelse ? 'on' : ''} onClick={() => setUi({ audience: 'teknik' })}>For teknikeren</button>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="field"><span className="label">Opgaven</span><p className="body">{t.op}</p></div>
        <div className="field"><span className="label">Eksempel</span><p className="body">{t.ex}</p></div>
        {item && (
          <div className="field"><span className="label acc">I denne løsning</span>
            <p className="body">{item.role === 'primaer' ? 'Primær' : 'Supplement'} i {lbl(inLayer!)}{item.status === 'eksisterende' ? ' – findes allerede' : ''}.{others.length ? ` Deler laget med ${others.join(' og ')} – beskriv arbejdsdelingen.` : ''}</p>
          </div>
        )}
        {ledelse ? (
          <>
            <div className="field"><span className="label">Ansvar og afvejning</span><p className="body">{t.an}</p></div>
            <div className="field"><span className="label">Hvornår vælge det – og hvornår ikke</span>
              {t.vh && <p className="body trade">{t.vh}</p>}
              {t.uh && <p className="body trade u">{t.uh}</p>}
            </div>
            <div className="field"><span className="label">Roller I skal have</span>
              <p className="body">{roles.length ? roles.join(' · ') : 'Ingen særlige.'}</p>
            </div>
          </>
        ) : (
          <>
            <div className="field"><span className="label">Forveksles ofte med</span><p className="body">{t.fv}</p></div>
            <div className="field"><span className="label">Samspil</span><p className="body">{t.sa}</p></div>
            <div className="field"><span className="label">Ansvar og afvejning</span><p className="body">{t.an}</p></div>
            <div className="field"><span className="label">Kilde</span><p className="small faint" style={{ fontFamily: 'var(--mono)', fontSize: '.74rem' }}>{t.ki}</p></div>
          </>
        )}
        <QuestionBlock ctx={id} title={`Spørgsmål om ${t.n}`} />
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-sm btn-ink" onClick={() => add(id)} disabled={!!inLayer}>{inLayer ? 'Allerede i løsningen' : 'Tilføj til løsningen'}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setUi({ panel: { mode: 'cmpPick', a: id } })}>Sammenlign</button>
        {inLayer && others.length === 0 && (
          <button className="btn btn-sm btn-ghost" onClick={() => { const alt = TECHS.find((x) => x.l === t.l && x.id !== id); if (alt) openTech(alt.id); }}>Se et alternativ</button>
        )}
      </div>
    </div>
  );
}

function LayerPanel({ id }: { id: LayerId }) {
  const { sol, setUi, openTech } = useApp();
  const l = layerById(id);
  const needs = USE_CASES.filter((u) => sol.useCases.includes(u.id)).map((u) => ({ u, n: u.needs[id] })).filter((x) => x.n.level !== 'valgfri');
  return (
    <div className="panel">
      <div className="row"><span className="eyebrow">Lag {l.num}</span><button className="close" aria-label="Luk" onClick={() => setUi({ panel: { mode: 'intro' } })}>✕</button></div>
      <h2 style={{ marginTop: 10, fontSize: '1.5rem' }}>{l.label}</h2>
      <p className="body" style={{ marginTop: 12 }}>{l.forklaring}</p>
      <div className="callout"><span className="label acc">Forveksles ofte med</span><p className="body" style={{ marginTop: 5, fontSize: '.86rem' }}>{l.forveksles}</p></div>
      {needs.length > 0 && (
        <div className="field" style={{ marginTop: 16 }}>
          <span className="label acc">Hvad jeres AI-behov kræver her</span>
          {needs.map(({ u, n }) => <p key={u.id} className="body" style={{ marginTop: 6, fontSize: '.86rem' }}><strong>{u.name}</strong> · {n.level === 'kraevet' ? 'kræves' : 'anbefales'}: {n.reason}</p>)}
        </div>
      )}
      <div className="field" style={{ marginTop: 16 }}>
        <span className="label">Hvad hører til her</span>
        {TECHS.filter((t) => t.l === id).map((t) => (
          <button key={t.id} className="listbtn" onClick={() => openTech(t.id)}><strong>{t.n}</strong> <span className="small faint">— {t.t}</span></button>
        ))}
      </div>
      <QuestionBlock ctx={id} title={`Spørgsmål om ${l.label.toLowerCase()}`} />
    </div>
  );
}

function ComparePanel({ a, b }: { a: string; b: string }) {
  const { setUi, add } = useApp();
  const A = techById(a)!, B = techById(b)!;
  return (
    <div className="panel">
      <div className="row"><span className="eyebrow">Sammenlign</span><button className="close" aria-label="Luk" onClick={() => setUi({ panel: { mode: 'intro' } })}>✕</button></div>
      <div className="cmp2" style={{ marginTop: 12, borderBottom: '1px solid var(--line-contrast)', paddingBottom: 12 }}>
        <div><h3>{A.n}</h3><span className="label">{layerById(A.l).label}</span></div>
        <div><h3>{B.n}</h3><span className="label">{layerById(B.l).label}</span></div>
      </div>
      {A.l !== B.l && <div className="banner">Disse løser ikke samme opgave</div>}
      {cmpRows(A, B).map((r) => (
        <div key={r.q} className="field">
          <span className="label acc">{r.q}</span>
          {r.split ? <div className="cmp2"><p className="body" style={{ fontSize: '.85rem' }}>{r.a}</p><p className="body" style={{ fontSize: '.85rem' }}>{r.b}</p></div> : <p className="body" style={{ fontSize: '.85rem' }}>{r.a}</p>}
        </div>
      ))}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => add(a)}>Tilføj {A.n}</button>
        <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => add(b)}>Tilføj {B.n}</button>
      </div>
    </div>
  );
}

export default function Panel() {
  const { ui, setUi, go } = useApp();
  const p = ui.panel;
  if (p.mode === 'tech') return <TechPanel id={p.id} />;
  if (p.mode === 'layer') return <LayerPanel id={p.id} />;
  if (p.mode === 'compare') return <ComparePanel a={p.a} b={p.b} />;
  if (p.mode === 'cmpPick') {
    const A = techById(p.a)!;
    return (
      <div className="panel">
        <span className="eyebrow">Sammenlign</span>
        <p className="body" style={{ marginTop: 12 }}><strong>{A.n}</strong> er valgt. Klik på et andet kort i kataloget, så vises de to side om side. Højst to ad gangen.</p>
        <button className="btn btn-sm btn-ghost" style={{ marginTop: 14 }} onClick={() => setUi({ panel: { mode: 'intro' } })}>Annullér</button>
      </div>
    );
  }
  return (
    <div className="panel">
      <span className="eyebrow">Forklaringspanel</span>
      <h2 style={{ marginTop: 12, fontSize: '1.2rem' }}>Klik på et lag eller et produkt – forklaringen kommer her.</h2>
      <p className="body" style={{ marginTop: 10, fontSize: '.88rem' }}>Du forlader aldrig din løsning for at læse. Hvert kort kan læses «For ledelsen» (ansvar, pris, roller) eller «For teknikeren» (forskelle, samspil, kilder).</p>
      <div className="field" style={{ marginTop: 20 }}>
        <span className="label">Oplagte sammenligninger</span>
        <div className="chips" style={{ marginTop: 8 }}>
          {SHORTCUTS.map(([a, b]) => (
            <button key={a + b} className="chip" onClick={() => setUi({ panel: { mode: 'compare', a, b } })}>{techById(a)?.n} / {techById(b)?.n}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label">Spørg AI-guiden</span>
        <p className="small" style={{ marginTop: 6 }}>Når lagene er udfyldt, kan guiden pege på det, reglerne ikke fanger – ud fra jeres behov og det, I allerede har.</p>
        <button className="btn btn-sm btn-ink" style={{ marginTop: 10 }} onClick={() => go('guide')}>Åbn AI-guiden</button>
      </div>
      <QuestionBlock ctx="generelt" title="Generelle spørgsmål" />
      <p className="small faint" style={{ marginTop: 16 }}>{LAYERS.length} lag · {TECHS.length} teknologier · {USE_CASES.length} AI-behov</p>
    </div>
  );
}
