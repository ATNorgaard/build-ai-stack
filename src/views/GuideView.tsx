import { useState } from 'react';
import { LAYERS } from '../data/catalog';
import { OWNER_LABELS } from '../data/rules';
import { askGuide, buildBrief } from '../lib/guide';
import { useApp } from '../App';

export default function GuideView() {
  const { sol, dispatch, go, notify } = useApp();
  const [question, setQuestion] = useState(sol.guideQuestion || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const filled = Object.values(sol.layers).some((l) => l.length);
  const res = sol.guide;

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const r = await askGuide(sol, question.trim() || undefined);
      dispatch({ type: 'guide', result: r, question });
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };
  const logKey = (i: number) => `g-${(res?.items[i].title || '').toLowerCase().replace(/[^a-zæøå0-9]+/g, '-').slice(0, 40)}`;
  const addToLog = (i: number) => {
    const it = res!.items[i];
    dispatch({ type: 'decision', key: logKey(i), patch: { title: it.title, text: it.text, owner: it.owner, status: 'aaben', note: '', tag: it.kind === 'advarsel' ? 'blindt' : it.kind === 'forslag' ? 'samspil' : 'afklaring' } });
    notify('Lagt i beslutningsloggen.');
  };

  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <span className="eyebrow">AI-guide</span>
        <h1 className="display" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.6rem)' }}>Forslag og advarsler ud fra behovet, det I har, <em>og</em> det I bygger.</h1>
        <p className="lead">Guiden læser jeres AI-behov, de seks lag, ledelsens hensyn, det I allerede har, og beslutningsloggen – og peger på det, reglerne ikke fanger. Den anbefaler ikke produkter. Den stiller de spørgsmål, mødet skal svare på.</p>

        <div className="two" style={{ marginTop: 28 }}>
          <div>
            <label className="label" htmlFor="infra">Eksisterende infrastruktur – hvad har I allerede?</label>
            <textarea id="infra" className="ta" rows={7} value={sol.existingInfra} onChange={(e) => dispatch({ type: 'field', field: 'existingInfra', value: e.target.value })}
              placeholder={'Fx: Microsoft 365 og Dynamics 365. Power BI på en SQL Server, der opdateres hver nat af en konsulent. Ingen datakatalog. To udviklere, ingen platformsingeniør. Data må ikke forlade EU.'} />
            <p className="small faint" style={{ marginTop: 6 }}>Marker også teknologier som «Findes» direkte på kortene i byggeren – de tælles med.</p>
            <label className="label" htmlFor="q" style={{ display: 'block', marginTop: 18 }}>Et konkret spørgsmål (valgfrit)</label>
            <textarea id="q" className="ta" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Fx: Kan vi starte med det, vi har, og hvad er det første, vi skal købe?" />
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-ink" onClick={run} disabled={busy || !filled}>{busy ? 'Guiden tænker…' : res ? 'Spørg igen' : 'Spørg guiden'}</button>
              {!filled && <span className="small">Læg noget i lagene først – <button className="btn-link" onClick={() => go('build')}>åbn byggeren</button>.</span>}
              <button className="btn-link" style={{ marginLeft: 'auto' }} onClick={() => setShowBrief(!showBrief)}>{showBrief ? 'Skjul' : 'Vis'} det, guiden får at se</button>
            </div>
            {error && <p className="body" style={{ marginTop: 12, color: 'var(--warn)' }}>{error}</p>}
            {showBrief && <pre className="small" style={{ marginTop: 14, whiteSpace: 'pre-wrap', background: 'var(--paper-deep)', padding: 14, border: '1px solid var(--line)', maxHeight: 420, overflow: 'auto' }}>{buildBrief(sol)}</pre>}
          </div>

          <div>
            {!res && !busy && (
              <div className="callout" style={{ marginTop: 0 }}>
                <span className="label acc">Sådan bruger I guiden</span>
                <p className="body" style={{ marginTop: 6, fontSize: '.88rem' }}>Vælg AI-behov og hensyn i byggeren, beskriv det I har, og spørg. Hvert punkt kan lægges i beslutningsloggen med en ejer, så det ikke bliver ved snakken.</p>
              </div>
            )}
            {busy && <p className="body">Guiden læser løsningen…</p>}
            {res && !busy && (
              <>
                <div className="summary" style={{ marginTop: 0 }}>
                  <span className="label">Det vigtigste at tale om nu</span>
                  <p>{res.summary}</p>
                  {res.model && <p className="small" style={{ color: 'var(--on-ink-faint)', marginTop: 10 }}>Model: {res.model}</p>}
                </div>
                <div style={{ marginTop: 10 }}>
                  {res.items.map((it, i) => {
                    const inLog = !!sol.decisions[logKey(i)];
                    return (
                      <div key={i} className="guide-item">
                        <div>
                          <span className="gkind" data-k={it.kind}>{it.kind === 'advarsel' ? 'Advarsel' : it.kind === 'forslag' ? 'Forslag' : 'Spørgsmål'}</span>
                          <div style={{ marginTop: 8 }}><span className="pill-owner light" data-o={it.owner}>{OWNER_LABELS[it.owner]}</span></div>
                          {it.layer && <div className="label" style={{ marginTop: 8 }}>{LAYERS.find((l) => l.id === it.layer)?.label}</div>}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1rem' }}>{it.title}</h3>
                          <p className="body" style={{ marginTop: 5, fontSize: '.9rem' }}>{it.text}</p>
                          <button className="btn btn-sm btn-ghost" style={{ marginTop: 10 }} onClick={() => addToLog(i)} disabled={inLog}>{inLog ? 'I beslutningsloggen' : '+ Læg i beslutningsloggen'}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
