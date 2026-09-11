import { useMemo } from 'react';
import { KINDS, LAYERS, TECHS, type Kind, type LayerId } from '../data/catalog';
import { COST_LABELS, PRIORITIES, ROLE_LABELS, USE_CASES } from '../data/extra';
import { profile, techById } from '../data/rules';
import { useApp } from '../App';
import Panel from '../components/Panel';
import { DecisionRow, logEntries } from '../components/Messages';

function Catalog() {
  const { sol, ui, setUi, add, openTech } = useApp();
  const fitIds = new Set(USE_CASES.filter((u) => sol.useCases.includes(u.id)).flatMap((u) => u.aiFit));
  const has = (id: string) => (Object.keys(sol.layers) as LayerId[]).some((k) => sol.layers[k].some((x) => x.id === id));
  const list = useMemo(() => TECHS.filter((t) => {
    if (ui.fLayer !== 'alle' && t.l !== ui.fLayer) return false;
    if (ui.fKind !== 'alle' && t.k !== ui.fKind) return false;
    const q = ui.query.trim().toLowerCase();
    return !q || t.n.toLowerCase().includes(q) || t.t.toLowerCase().includes(q);
  }), [ui.fLayer, ui.fKind, ui.query]);
  return (
    <>
      <div className="col-head">
        <div className="row" style={{ marginBottom: 10 }}><span className="label">Teknologikatalog</span><span className="label faint" style={{ marginLeft: 'auto' }}>Træk et kort ind</span></div>
        <input className="search" type="search" value={ui.query} placeholder="Søg efter et navn…" onChange={(e) => setUi({ query: e.target.value })} />
        <div className="chips" style={{ marginTop: 10 }}>
          <button className={'chip' + (ui.fLayer === 'alle' ? ' on' : '')} onClick={() => setUi({ fLayer: 'alle' })}>Alle lag</button>
          {LAYERS.map((l) => <button key={l.id} className={'chip' + (ui.fLayer === l.id ? ' on' : '')} onClick={() => setUi({ fLayer: l.id })}>{l.label}</button>)}
        </div>
        <div className="chips" style={{ marginTop: 6 }}>
          <button className={'chip' + (ui.fKind === 'alle' ? ' on' : '')} onClick={() => setUi({ fKind: 'alle' })}>Alle typer</button>
          {(Object.keys(KINDS) as Kind[]).map((k) => <button key={k} className={'chip' + (ui.fKind === k ? ' on' : '')} onClick={() => setUi({ fKind: k })}>{KINDS[k]}</button>)}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {list.map((t) => (
          <div key={t.id} className="catitem" draggable title="Træk kortet over i din løsning"
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', t.id); setUi({ drag: t.id, dragOver: undefined }); }}
            onDragEnd={() => setUi({ drag: undefined, dragOver: undefined })}>
            <button className="open" onClick={() => openTech(t.id)}>
              <span className="name">{t.n}</span><span className="kind">{KINDS[t.k]}</span>{fitIds.has(t.id) && <span className="fit">Passer til behov</span>}
              <div className="small" style={{ marginTop: 3, fontSize: '.78rem' }}>{t.t}</div>
              {t.pf && <div className="pf">Samme platform · {t.pf}</div>}
            </button>
            <button className="btn btn-sm btn-ghost" style={{ alignSelf: 'center' }} onClick={() => add(t.id)}>{has(t.id) ? 'Valgt' : 'Tilføj'}</button>
          </div>
        ))}
        {!list.length && <p className="body" style={{ padding: '24px 18px' }}>Ingen kort matcher. Prøv et andet ord, eller ryd filtrene.</p>}
      </div>
    </>
  );
}

function Stack() {
  const { sol, ui, setUi, dispatch, add, undo, canUndo, openTech, openLayer, go, msgs } = useApp();
  const P = profile(sol.layers);
  const dragTech = ui.drag ? techById(ui.drag) : undefined;
  const entries = logEntries(msgs, sol.decisions);
  const open = entries.filter((e) => sol.decisions[e.key]?.status !== 'besluttet');
  const facts = [
    { label: 'Lag dækket', value: `${P.covered} af 6`, detail: P.covered === 6 ? 'Alle seks lag er beskrevet' : LAYERS.filter((l) => !sol.layers[l.id].length).map((l) => l.label).join(', ') + ' mangler' },
    { label: 'Nyt vs. eksisterende', value: `${P.planned.length} / ${P.existing.length}`, detail: P.existing.length ? 'Findes allerede: ' + P.existing.map((id) => techById(id)?.n).join(', ') : 'Intet markeret som eksisterende endnu' },
    { label: 'Leverandøraftaler', value: String(P.vendors.length), detail: P.vendors.join(' · ') || 'Ingen kommercielle aftaler' },
    { label: 'Betaler med', value: `${P.cost.forbrug.length + P.cost.kapacitet.length} / ${P.cost.licens.length} / ${P.cost.arbejdstid.length}`, detail: `${COST_LABELS.forbrug}+${COST_LABELS.kapacitet.toLowerCase()} / ${COST_LABELS.licens.toLowerCase()} / ${COST_LABELS.arbejdstid.toLowerCase()}` },
  ];
  const needFor = (lid: LayerId) => {
    const lv = USE_CASES.filter((u) => sol.useCases.includes(u.id)).map((u) => u.needs[lid].level);
    return lv.includes('kraevet') ? 'kraevet' : lv.includes('anbefalet') ? 'anbefalet' : undefined;
  };
  return (
    <div className="main-pad">
      <div className="sol-head">
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <span className="label">Min løsning</span>
          <input className="sol-name" value={sol.name} onChange={(e) => dispatch({ type: 'name', name: e.target.value })} />
        </div>
        <div className="row no-print" style={{ marginLeft: 'auto', paddingTop: 14 }}>
          <button className="btn btn-sm btn-ghost" onClick={undo} disabled={!canUndo}>Fortryd</button>
          <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm('Tøm alle seks lag og beslutningsloggen?')) dispatch({ type: 'reset' }); }}>Nulstil</button>
          <button className="btn btn-sm btn-ink" onClick={() => go('del')}>Del og begrund</button>
        </div>
      </div>

      <div className="section">
        <div className="row"><span className="label acc">Hvad skal AI kunne?</span><span className="small faint">Behovet afgør, hvilke lag der kræves</span></div>
        <div className="chips" style={{ marginTop: 8 }}>
          {USE_CASES.map((u) => <button key={u.id} className={'chip big' + (sol.useCases.includes(u.id) ? ' on acc' : '')} title={u.kort} onClick={() => dispatch({ type: 'useCase', id: u.id })}>{u.name}</button>)}
        </div>
      </div>
      <div className="section">
        <div className="row"><span className="label acc">Ledelsens vigtigste hensyn</span><span className="small faint">Reglerne tjekker valgene mod hensynene</span></div>
        <div className="chips" style={{ marginTop: 8 }}>
          {PRIORITIES.map((p) => <button key={p.id} className={'chip big' + (sol.priorities.includes(p.id) ? ' on' : '')} title={p.kort} onClick={() => dispatch({ type: 'priority', id: p.id })}>{p.label}</button>)}
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        {LAYERS.map((l) => {
          const items = sol.layers[l.id];
          const isTarget = !!dragTech && dragTech.l === l.id;
          const already = !!dragTech && items.some((x) => x.id === dragTech.id);
          const over = ui.dragOver === l.id;
          const cls = 'layer-row' + (dragTech ? (isTarget && !already ? (over ? ' drop-over' : ' drop-ok') : ' drop-dim') : '');
          const need = needFor(l.id);
          return (
            <section key={l.id} className={cls}
              onDragOver={(e) => { if (!dragTech) return; e.preventDefault(); e.dataTransfer.dropEffect = isTarget ? 'copy' : 'none'; if (ui.dragOver !== l.id) setUi({ dragOver: l.id }); }}
              onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; if (ui.dragOver === l.id) setUi({ dragOver: undefined }); }}
              onDrop={(e) => { e.preventDefault(); const id = ui.drag || e.dataTransfer.getData('text/plain'); if (id) add(id, l.id); setUi({ drag: undefined, dragOver: undefined }); }}>
              <button className="head" onClick={() => openLayer(l.id)}>
                <span className="eyebrow">{l.num}</span>
                <span className="t">{l.label}</span>
                <span className="k">{l.kort}</span>
              </button>
              <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                <div className="items">
                  {need && <span className={'need-badge' + (!items.length ? ' miss' : '')}>{need === 'kraevet' ? 'Kræves af behovet' : 'Anbefales'}</span>}
                  {items.map((it) => {
                    const t = techById(it.id);
                    return (
                      <div key={it.id} className={'item' + (it.status === 'eksisterende' ? ' existing' : '')}>
                        <button className="nm" onClick={() => openTech(it.id)}>{t?.n ?? it.id}</button>
                        <button className={'role ' + (it.role === 'primaer' ? 'p' : 's')} title="Skift mellem primær og supplement" onClick={() => dispatch({ type: 'role', layer: l.id, id: it.id, role: it.role === 'primaer' ? 'supplement' : 'primaer' })}>{it.role === 'primaer' ? 'Primær' : 'Supplement'}</button>
                        <button className={'st' + (it.status === 'eksisterende' ? ' ex' : '')} title="Findes det allerede hos jer?" onClick={() => dispatch({ type: 'status', layer: l.id, id: it.id, status: it.status === 'eksisterende' ? 'planlagt' : 'eksisterende' })}>{it.status === 'eksisterende' ? 'Findes' : 'Ny'}</button>
                        <button className="x" aria-label="Fjern" onClick={() => { dispatch({ type: 'remove', layer: l.id, id: it.id }); setUi({ pending: undefined }); }}>✕</button>
                      </div>
                    );
                  })}
                  <button className="add-dashed" onClick={() => { setUi({ fLayer: l.id, query: '', mTab: 'katalog' }); openLayer(l.id); }}>{items.length ? '+ Tilføj flere' : '+ Tilføj'}</button>
                  {dragTech && isTarget && <span className="label acc">{already ? 'Allerede her' : over ? 'Slip her' : 'Hører til her'}</span>}
                  {dragTech && !isTarget && over && <span className="label">{dragTech.n} hører til i {LAYERS.find((x) => x.id === dragTech.l)?.label}</span>}
                </div>
                {ui.pending?.layer === l.id && (
                  <div className="pending">
                    <span>Skal <strong>{techById(ui.pending.id)?.n}</strong> være primær i dette lag eller supplere dit nuværende valg?</span>
                    <span className="row" style={{ marginLeft: 'auto' }}>
                      <button className="btn btn-sm btn-ink" onClick={() => { dispatch({ type: 'role', layer: l.id, id: ui.pending!.id, role: 'primaer' }); setUi({ pending: undefined }); }}>Primær</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setUi({ pending: undefined })}>Supplement</button>
                    </span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {P.uniq.length > 0 && (
        <section className="msgs">
          <div className="top"><span className="label">Hvad dine valg betyder</span><span className="label faint" style={{ marginLeft: 'auto' }}>Ingen score · kun konsekvenser og beslutninger</span></div>
          <div className="facts">
            {facts.map((f) => <div key={f.label} className="fact"><span className="label">{f.label}</span><div className="v">{f.value}</div><div className="d">{f.detail}</div></div>)}
          </div>
          {P.roles.length > 0 && (
            <div style={{ padding: '12px 0 4px', borderBottom: '1px solid var(--line-light-soft)' }}>
              <span className="label">Roller I skal kunne bemande</span>
              <div className="roles">{P.roles.map((r) => <span key={r}>{ROLE_LABELS[r]}</span>)}</div>
            </div>
          )}
          {open.slice(0, 8).map((e) => <DecisionRow key={e.key} e={e} dark />)}
          {open.length > 8 && <p className="small" style={{ color: 'var(--on-ink-muted)', marginTop: 12 }}>{open.length - 8} flere åbne punkter i <button className="btn-link" style={{ color: 'var(--accent-bright)', borderColor: 'var(--accent-bright)' }} onClick={() => go('beslutninger')}>beslutningsloggen</button>.</p>}
          {open.length === 0 && <p className="body" style={{ color: 'var(--on-ink-body)', marginTop: 12 }}>Alle punkter er besluttet. Se dem i beslutningsloggen.</p>}
          <div style={{ paddingTop: 14, display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
            {msgs.filter((m) => m.tag === 'rolle').map((m) => <span key={m.key} className="small" style={{ color: 'var(--on-ink-muted)' }}>{m.text}</span>)}
          </div>
        </section>
      )}
    </div>
  );
}

export default function BuildView() {
  const { ui, setUi } = useApp();
  const tabs: { id: typeof ui.mTab; label: string }[] = [{ id: 'katalog', label: 'Udforsk' }, { id: 'loesning', label: 'Min løsning' }, { id: 'panel', label: 'Lær' }];
  return (
    <div className="build">
      <div className="mtabs">{tabs.map((t) => <button key={t.id} className={ui.mTab === t.id ? 'on' : ''} onClick={() => setUi({ mTab: t.id })}>{t.label}</button>)}</div>
      <aside className={'col col-cat' + (ui.mTab === 'katalog' ? ' show' : '')}><Catalog /></aside>
      <main className={'col' + (ui.mTab === 'loesning' ? ' show' : '')}><Stack /></main>
      <aside className={'col col-panel' + (ui.mTab === 'panel' ? ' show' : '')}><Panel /></aside>
    </div>
  );
}
