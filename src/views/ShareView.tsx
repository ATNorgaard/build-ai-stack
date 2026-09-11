import { LAYERS } from '../data/catalog';
import { PRIORITIES, ROLE_LABELS, USE_CASES } from '../data/extra';
import { OWNER_LABELS, profile, techById, TAG_LABELS } from '../data/rules';
import { shareUrl } from '../lib/state';
import { useApp } from '../App';
import { logEntries } from '../components/Messages';

export default function ShareView() {
  const { sol, dispatch, go, notify, msgs, storeKind } = useApp();
  const P = profile(sol.layers);
  const entries = logEntries(msgs, sol.decisions);
  const forLedelse = entries.filter((e) => (sol.decisions[e.key]?.owner || e.owner) !== 'teknik' && sol.decisions[e.key]?.status !== 'besluttet');
  const besluttet = entries.filter((e) => sol.decisions[e.key]?.status === 'besluttet');
  const forTeknik = entries.filter((e) => (sol.decisions[e.key]?.owner || e.owner) === 'teknik' && sol.decisions[e.key]?.status !== 'besluttet');
  const questions = Object.entries(sol.questions).flatMap(([ctx, l]) => l.map((q) => ({ ctx, ...q }))).sort((a, b) => b.v - a.v);

  const copyLink = async () => {
    const url = shareUrl(sol);
    try { await navigator.clipboard.writeText(url); notify('Link kopieret. Alt ligger i linket – ingen server nødvendig.'); }
    catch { prompt('Kopiér linket:', url); }
  };
  const exportText = () => {
    const L: string[] = [sol.name.toUpperCase(), '', 'Formål: ' + (sol.formaal || '—'), 'AI-behov: ' + (sol.useCases.map((id) => USE_CASES.find((u) => u.id === id)?.name).join(', ') || '—'), 'Hensyn: ' + (sol.priorities.map((id) => PRIORITIES.find((p) => p.id === id)?.label).join(', ') || '—'), 'Stadig usikker på: ' + (sol.aabent || '—'), '', 'LAG'];
    LAYERS.forEach((l) => L.push(`${l.label}: ${sol.layers[l.id].map((x) => `${techById(x.id)?.n}${x.role === 'primaer' ? '' : ' (supplement)'}${x.status === 'eksisterende' ? ' [findes]' : ''}`).join(', ') || '—'}`));
    L.push('', 'BESLUTNINGER DER MANGLER FRA LEDELSEN');
    forLedelse.forEach((e) => L.push(`· [${OWNER_LABELS[sol.decisions[e.key]?.owner || e.owner]}] ${e.title ? e.title + ': ' : ''}${e.text}${sol.decisions[e.key]?.note ? ' → ' + sol.decisions[e.key].note : ''}`));
    L.push('', 'TEKNISKE AFKLARINGER'); forTeknik.forEach((e) => L.push(`· ${e.text}${sol.decisions[e.key]?.note ? ' → ' + sol.decisions[e.key].note : ''}`));
    L.push('', 'BESLUTTET'); besluttet.forEach((e) => L.push(`· ${e.text}${sol.decisions[e.key]?.note ? ' → ' + sol.decisions[e.key].note : ''}`));
    if (questions.length) { L.push('', 'SPØRGSMÅL'); questions.forEach((q) => L.push(`· (${q.v}) ${q.q}${q.answer ? ' → ' + q.answer : ''}`)); }
    if (sol.guide) { L.push('', 'AI-GUIDEN'); L.push(sol.guide.summary); sol.guide.items.forEach((it) => L.push(`· [${it.kind}, ${OWNER_LABELS[it.owner]}] ${it.title}: ${it.text}`)); }
    const blob = new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (sol.name.replace(/[^\wæøåÆØÅ -]/g, '').trim() || 'loesningsark') + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="page">
      <div className="wrap two" style={{ maxWidth: 1100 }}>
        <div className="no-print">
          <span className="eyebrow">Begrundelser frem for produktlister</span>
          <h2 style={{ marginTop: 12, fontSize: '1.8rem' }}>Det, der skal med til mødet.</h2>
          <label style={{ display: 'block', marginTop: 20 }}><span className="label">Formål</span>
            <textarea className="ta" rows={2} value={sol.formaal} placeholder="Hvad skal løsningen hjælpe med?" onChange={(e) => dispatch({ type: 'field', field: 'formaal', value: e.target.value })} /></label>
          <label style={{ display: 'block', marginTop: 14 }}><span className="label">Største åbne spørgsmål</span>
            <textarea className="ta" rows={2} value={sol.aabent} placeholder="Hvad er I stadig usikre på?" onChange={(e) => dispatch({ type: 'field', field: 'aabent', value: e.target.value })} /></label>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn btn-ink" onClick={copyLink}>Kopiér delelink</button>
            <button className="btn" onClick={() => window.print()}>Print løsningsark</button>
            <button className="btn btn-ghost" onClick={exportText}>Gem som tekst</button>
          </div>
          <p className="small faint" style={{ marginTop: 14 }}>
            {storeKind === 'supabase' ? 'Løsningen gemmes også i Supabase.' : 'Løsningen ligger i browseren og i linket – der er ingen server.'} Brug gerne et alias, og undlad personoplysninger, adgangsoplysninger og fortrolige virksomhedsdata.
          </p>
          <button className="btn-link" style={{ marginTop: 16 }} onClick={() => go('build')}>← Tilbage til løsningen</button>
        </div>

        <div id="loesningsark" className="sheet">
          <div className="hd">
            <span className="label">Løsningsark</span>
            <h2 style={{ marginTop: 6 }}>{sol.name}</h2>
            <p className="body" style={{ marginTop: 8, fontSize: '.88rem' }}>{sol.formaal || 'Formål mangler – én sætning gør løsningen forståelig for andre.'}</p>
            <div className="r" style={{ marginTop: 10, borderTop: '1px solid var(--line)', borderBottom: 0 }}><span className="label">AI-behov</span><span>{sol.useCases.map((id) => USE_CASES.find((u) => u.id === id)?.name).join(' · ') || 'Ikke valgt'}</span></div>
            <div className="r" style={{ borderBottom: 0 }}><span className="label">Hensyn</span><span>{sol.priorities.map((id) => PRIORITIES.find((p) => p.id === id)?.label).join(' · ') || 'Ikke valgt'}</span></div>
            <div className="r" style={{ borderBottom: 0 }}><span className="label">Roller</span><span>{P.roles.map((r) => ROLE_LABELS[r]).join(' · ') || '—'}</span></div>
          </div>
          <div className="rows">
            {LAYERS.map((l) => (
              <div key={l.id} className="r">
                <span className="label">{l.num} · {l.label}</span>
                <span>{sol.layers[l.id].map((x) => `${techById(x.id)?.n}${x.role === 'primaer' ? '' : ' (supplement)'}${x.status === 'eksisterende' ? ' · findes' : ''}`).join(', ') || <span className="faint">— ikke beskrevet</span>}</span>
              </div>
            ))}
          </div>
          <div className="ink">
            <span className="label" style={{ color: 'var(--accent-bright)' }}>Beslutninger der mangler fra ledelsen ({forLedelse.length})</span>
            {forLedelse.map((e) => (
              <div key={e.key} className="r" style={{ gridTemplateColumns: '90px minmax(0,1fr)' }}>
                <span className="label" style={{ color: 'var(--on-ink-faint)' }}>{OWNER_LABELS[sol.decisions[e.key]?.owner || e.owner]}</span>
                <span>{e.title ? <strong>{e.title}: </strong> : null}{e.text}{sol.decisions[e.key]?.note && <><br /><em>→ {sol.decisions[e.key].note}</em></>}</span>
              </div>
            ))}
            {!forLedelse.length && <p className="small" style={{ color: 'var(--on-ink-muted)', marginTop: 8 }}>Ingen åbne punkter til ledelsen.</p>}
            {forTeknik.length > 0 && (<>
              <span className="label" style={{ color: 'var(--accent-bright)', display: 'block', marginTop: 16 }}>Tekniske afklaringer ({forTeknik.length})</span>
              {forTeknik.map((e) => <div key={e.key} className="r" style={{ gridTemplateColumns: '90px minmax(0,1fr)' }}><span className="label" style={{ color: 'var(--on-ink-faint)' }}>{TAG_LABELS[e.tag]}</span><span>{e.text}{sol.decisions[e.key]?.note && <><br /><em>→ {sol.decisions[e.key].note}</em></>}</span></div>)}
            </>)}
            {besluttet.length > 0 && (<>
              <span className="label" style={{ color: 'var(--accent-bright)', display: 'block', marginTop: 16 }}>Besluttet ({besluttet.length})</span>
              {besluttet.map((e) => <div key={e.key} className="r" style={{ gridTemplateColumns: '90px minmax(0,1fr)' }}><span className="label" style={{ color: 'var(--on-ink-faint)' }}>{OWNER_LABELS[sol.decisions[e.key]?.owner || e.owner]}</span><span>{e.text}{sol.decisions[e.key]?.note && <><br /><em>→ {sol.decisions[e.key].note}</em></>}</span></div>)}
            </>)}
            {questions.length > 0 && (<>
              <span className="label" style={{ color: 'var(--accent-bright)', display: 'block', marginTop: 16 }}>Spørgsmål ({questions.length})</span>
              {questions.map((q) => <div key={q.ctx + q.id} className="r" style={{ gridTemplateColumns: '90px minmax(0,1fr)' }}><span className="label" style={{ color: 'var(--on-ink-faint)' }}>▲ {q.v} · {OWNER_LABELS[q.by]}</span><span>{q.q}{q.answer && <><br /><em>→ {q.answer}</em></>}</span></div>)}
            </>)}
            <p style={{ marginTop: 12, fontSize: '.86rem', lineHeight: 1.55 }}><span style={{ color: 'var(--accent-bright)' }}>Stadig usikker på:</span> {sol.aabent || 'Ikke beskrevet endnu.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
