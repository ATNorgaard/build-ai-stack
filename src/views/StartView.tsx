import { LAYERS, PRESETS } from '../data/catalog';
import { USE_CASES, NEED_LABELS } from '../data/extra';
import { techById } from '../data/rules';
import { emptySolution, fromPreset } from '../lib/state';
import { useApp } from '../App';

export default function StartView() {
  const { sol, dispatch, go, setUi } = useApp();
  const start = (s: ReturnType<typeof emptySolution>) => {
    dispatch({ type: 'replace', solution: s });
    setUi({ view: 'build', panel: { mode: 'intro' }, pending: undefined });
  };
  const fromNeed = (id: string) => {
    const s = emptySolution('Løsning til: ' + USE_CASES.find((u) => u.id === id)!.name);
    s.useCases = [id];
    start(s);
  };
  const hasWork = Object.values(sol.layers).some((l) => l.length) || sol.useCases.length > 0;

  return (
    <div className="page">
      <div className="wrap">
        <span className="eyebrow">Uden konto · uden installation</span>
        <h1 className="display">Fire udgangspunkter. Seks lag. <em>Dine</em> begrundelser.</h1>
        <p className="lead">Start fra et konkret AI-behov eller fra en af de fire løsninger fra oplægget. Ingen af dem er den bedste, billigste eller mest sikre – de er forskellige udgangspunkter med forskellige afvejninger. Appen viser, hvad valgene betyder, og hvem der skal beslutte hvad.</p>

        {hasWork && (
          <div className="row" style={{ marginTop: 22 }}>
            <button className="btn btn-accent" onClick={() => go('build')}>Fortsæt med «{sol.name}»</button>
            <span className="small">Din løsning ligger gemt i browseren.</span>
          </div>
        )}

        <div className="section" style={{ marginTop: 44 }}>
          <span className="eyebrow">Start fra et AI-behov</span>
          <h2 style={{ marginTop: 10 }}>Hvad skal AI'en <em>kunne</em>?</h2>
          <p className="body" style={{ marginTop: 8, maxWidth: 640 }}>Behovet afgør, hvilke lag der kræves. En model, der skal svare på historik, har brug for et datalag. En agent, der skal handle i jeres systemer, har brug for en integrationsvej.</p>
          <div className="usecase-grid">
            {USE_CASES.map((u) => (
              <button key={u.id} className="usecase" onClick={() => fromNeed(u.id)}>
                <h3>{u.name}</h3>
                <p className="small">{u.kort}</p>
                <div className="needs">
                  {LAYERS.filter((l) => u.needs[l.id].level !== 'valgfri').map((l) => (
                    <span key={l.id} className="need" data-l={u.needs[l.id].level} title={u.needs[l.id].reason}>{l.label} · {NEED_LABELS[u.needs[l.id].level]}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="section" style={{ marginTop: 44 }}>
          <span className="eyebrow">Eller fra et af oplæggets eksempler</span>
          <div className="presets">
            {PRESETS.map((p) => (
              <article key={p.id} className="card">
                <div><span className="num">{p.num}</span><h3 style={{ display: 'inline' }}>{p.name}</h3></div>
                <p className="small" style={{ minHeight: 44 }}>{p.beskrivelse}</p>
                <dl>
                  {LAYERS.map((l) => (
                    <div key={l.id} style={{ display: 'contents' }}>
                      <dt>{l.label}</dt>
                      <dd>{(p.layers[l.id] || []).map((id) => techById(id)?.n).join(', ') || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <div className="actions row">
                  <button className="btn btn-sm" onClick={() => start(fromPreset(p.id, false))}>Udforsk løsningen</button>
                  <button className="btn btn-sm btn-accent" onClick={() => start(fromPreset(p.id, true))}>Brug som udgangspunkt</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="row" style={{ marginTop: 30 }}>
          <button className="btn btn-ink" onClick={() => start(emptySolution())}>Start fra bunden</button>
          <button className="btn" onClick={() => go('lag')}>Forklar de seks lag ↓</button>
        </div>
      </div>
    </div>
  );
}
