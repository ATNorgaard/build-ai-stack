import { useState } from 'react';
import { OWNER_LABELS, type Owner } from '../data/rules';
import { useApp } from '../App';
import { DecisionRow, logEntries } from '../components/Messages';

export default function DecisionsView() {
  const { sol, msgs, go } = useApp();
  const [owner, setOwner] = useState<Owner | 'alle'>('alle');
  const [status, setStatus] = useState<'alle' | 'aaben' | 'besluttet'>('aaben');
  const entries = logEntries(msgs, sol.decisions).filter((e) => {
    const d = sol.decisions[e.key];
    const o = d?.owner || e.owner;
    const s = d?.status || 'aaben';
    return (owner === 'alle' || o === owner) && (status === 'alle' || s === status);
  });
  const counts = (['ledelse', 'teknik', 'faelles'] as Owner[]).map((o) => ({ o, n: logEntries(msgs, sol.decisions).filter((e) => (sol.decisions[e.key]?.owner || e.owner) === o && sol.decisions[e.key]?.status !== 'besluttet').length }));
  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 960 }}>
        <span className="eyebrow">Beslutningslog</span>
        <h1 className="display" style={{ fontSize: 'clamp(1.6rem,3.5vw,2.6rem)' }}>Hvert punkt har en ejer. <em>Ingen</em> falder mellem to stole.</h1>
        <p className="lead">Regelmotoren og AI-guiden laver punkterne. I sætter ejer, status og en note om, hvordan ansvaret er fordelt. Loggen følger med i løsningsarket.</p>
        <div className="row" style={{ marginTop: 22 }}>
          {counts.map((c) => <span key={c.o} className="pill-owner light" data-o={c.o} style={{ padding: '6px 10px' }}>{OWNER_LABELS[c.o]}: {c.n} åbne</span>)}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <div className="chips">
            <button className={'chip' + (owner === 'alle' ? ' on' : '')} onClick={() => setOwner('alle')}>Alle ejere</button>
            {(['ledelse', 'teknik', 'faelles'] as Owner[]).map((o) => <button key={o} className={'chip' + (owner === o ? ' on' : '')} onClick={() => setOwner(o)}>{OWNER_LABELS[o]}</button>)}
          </div>
          <div className="chips" style={{ marginLeft: 'auto' }}>
            {(['aaben', 'besluttet', 'alle'] as const).map((s) => <button key={s} className={'chip' + (status === s ? ' on' : '')} onClick={() => setStatus(s)}>{s === 'aaben' ? 'Åbne' : s === 'besluttet' ? 'Besluttede' : 'Alle'}</button>)}
          </div>
        </div>
        <div className="light" style={{ marginTop: 18, borderTop: '1px solid var(--line-contrast)' }}>
          {entries.map((e) => <DecisionRow key={e.key} e={e} />)}
          {!entries.length && (
            <p className="body" style={{ padding: '26px 0' }}>
              {msgs.filter((m) => m.tag !== 'rolle').length ? 'Ingen punkter matcher filtret.' : <>Der er ingen punkter endnu. <button className="btn-link" onClick={() => go('build')}>Byg løsningen</button>, så kommer de.</>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
