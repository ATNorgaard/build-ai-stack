// Beslutningsloggen: regelmotorens beskeder + punkter fra AI-guiden, hver med ejer, status og note.
import { LAYERS } from '../data/catalog';
import { OWNER_LABELS, TAG_LABELS, type Msg, type Owner } from '../data/rules';
import type { Decision } from '../lib/state';
import { useApp } from '../App';

export interface LogEntry { key: string; tag: Msg['tag']; text: string; title?: string; owner: Owner; layer?: string; fromGuide?: boolean }

/** Slår regelmotorens beskeder sammen med gemte punkter fra guiden. */
export function logEntries(msgs: Msg[], decisions: Record<string, Decision>): LogEntry[] {
  const engine: LogEntry[] = msgs.filter((m) => m.tag !== 'rolle').map((m) => ({ key: m.key, tag: m.tag, text: m.text, owner: decisions[m.key]?.owner || m.owner, layer: m.layer }));
  const custom: LogEntry[] = Object.entries(decisions)
    .filter(([, d]) => d.text)
    .map(([key, d]) => ({ key, tag: d.tag || 'afklaring', text: d.text!, title: d.title, owner: d.owner || 'faelles', fromGuide: true }));
  return [...custom, ...engine];
}

export function DecisionRow({ e, dark }: { e: LogEntry; dark?: boolean }) {
  const { sol, dispatch } = useApp();
  const d = sol.decisions[e.key];
  const status = d?.status || 'aaben';
  const owner = d?.owner || e.owner;
  const patch = (p: Partial<Decision>) => dispatch({ type: 'decision', key: e.key, patch: p, tag: e.tag });
  const layer = e.layer ? LAYERS.find((l) => l.id === e.layer)?.label : undefined;
  return (
    <div className={'msg' + (status === 'besluttet' ? ' done' : '')}>
      <span className="tag" data-tag={e.tag}>{e.fromGuide ? 'AI-guide' : TAG_LABELS[e.tag]}{layer ? <><br />{layer}</> : null}</span>
      <div className="txt">
        {e.title && <strong style={{ display: 'block', marginBottom: 3 }}>{e.title}</strong>}
        {e.text}
        <div className="dctl">
          <span className="pill-owner" data-o={owner}>{OWNER_LABELS[owner]}</span>
          <select value={owner} onChange={(ev) => patch({ owner: ev.target.value as Owner })} title="Hvem skal svare?">
            <option value="ledelse">Ledelse svarer</option>
            <option value="teknik">Teknik svarer</option>
            <option value="faelles">Fælles beslutning</option>
          </select>
          <select value={status} onChange={(ev) => patch({ status: ev.target.value as Decision['status'] })}>
            <option value="aaben">Åben</option>
            <option value="besluttet">Besluttet</option>
          </select>
          {!d && (
            <button className="btn-link" style={dark ? { color: 'var(--accent-bright)', borderColor: 'var(--accent-bright)' } : undefined} onClick={() => patch({ note: '' })}>Sådan fordeler vi ansvaret</button>
          )}
        </div>
        {d && (
          <textarea rows={2} value={d.note} placeholder="Sådan fordeler vi ansvaret… (hvem gør hvad, hvornår)" onChange={(ev) => patch({ note: ev.target.value })} />
        )}
      </div>
    </div>
  );
}
