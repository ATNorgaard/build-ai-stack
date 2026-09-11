import { LAYERS, TECHS } from '../data/catalog';
import { useApp } from '../App';

export default function LayersView() {
  const { go, openLayer, setUi } = useApp();
  return (
    <div className="page">
      <div className="wrap" style={{ maxWidth: 1000 }}>
        <span className="eyebrow">Grundlaget</span>
        <h1 className="display">Seks lag, der hver løser <em>én</em> slags opgave.</h1>
        <p className="lead">Produkterne skifter hurtigt. Lagene gør ikke. Læs dem nedefra: data skal ind, før de kan samles, styres, koordineres og bruges.</p>
        <div style={{ marginTop: 40, borderTop: '1px solid var(--line)' }}>
          {LAYERS.map((l) => (
            <article key={l.id} className="layer-art">
              <div className="head">
                <span className="eyebrow">{l.num}</span>
                <h3 style={{ marginTop: 6 }}>{l.label}</h3>
                <p className="small" style={{ marginTop: 6 }}>{TECHS.filter((t) => t.l === l.id).map((t) => t.n).join(' · ')}</p>
              </div>
              <p className="body expl">{l.forklaring}</p>
              <div className="aside">
                <span className="label">Forveksles ofte med</span>
                <p className="small" style={{ marginTop: 6 }}>{l.forveksles}</p>
                <button className="btn-link" style={{ marginTop: 10 }} onClick={() => { openLayer(l.id); setUi({ view: 'build' }); }}>Se i byggeren →</button>
              </div>
            </article>
          ))}
        </div>
        <div className="row" style={{ marginTop: 32 }}>
          <button className="btn btn-accent" onClick={() => go('start')}>Vælg et udgangspunkt</button>
        </div>
      </div>
    </div>
  );
}
