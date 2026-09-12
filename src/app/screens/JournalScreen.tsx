import { useMemo, useState } from 'react';
import { getLocation } from '@/content/locations';
import { getTargetOrPlaceholder } from '@/content/targets';
import { getClue } from '@/content/clues';
import { focusJournal, game } from '@/core/gameState';
import { RARITY_LABEL, type DiscoveryRecord, type Rarity } from '@/core/types';
import { chainProgress } from '@/systems/mystery';
import { conditionLabel } from '@/systems/discovery';
import { useGameState } from '../useGame';
import { Btn, FindArt, RarityTag, TopBar } from '../components/ui';
import { Nav } from '../components/Nav';

type GroupMode = 'location' | 'category' | 'rarity' | 'era';
const GROUPS: { id: GroupMode; label: string }[] = [
  { id: 'location', label: 'Place' },
  { id: 'category', label: 'Type' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'era', label: 'Era' },
];

const CATEGORY_LABEL: Record<string, string> = {
  junk: 'Rubbish',
  coin: 'Coins',
  tool: 'Tools & hardware',
  personal: 'Personal effects',
  jewelry: 'Jewellery',
  military: 'Military',
  relic: 'Relics',
  artifact: 'Artifacts',
};

export function JournalScreen() {
  const { save, journalFocus } = useGameState();
  const [tab, setTab] = useState<'finds' | 'mysteries'>('finds');
  const [group, setGroup] = useState<GroupMode>('location');
  const [openUid, setOpenUid] = useState<string | null>(null);

  const focused = useMemo(() => {
    if (!journalFocus) return null;
    return save.discoveries.find((d) => d.targetId === journalFocus) ?? null;
  }, [journalFocus, save.discoveries]);

  const openRecord =
    save.discoveries.find((d) => d.uid === openUid) ?? (openUid === null ? focused : null);

  const grouped = useMemo(() => groupFinds(save.discoveries, group), [save.discoveries, group]);
  const progress = chainProgress(save.clues);

  return (
    <div className="screen">
      <TopBar
        title="Field Journal"
        subtitle={`${save.discoveries.length} ${save.discoveries.length === 1 ? 'find' : 'finds'} · ${save.clues.length} ${save.clues.length === 1 ? 'clue' : 'clues'}`}
      />

      <div className="tabs">
        <button className={`tab ${tab === 'finds' ? 'tab--active' : ''}`} onClick={() => setTab('finds')}>
          Finds
        </button>
        <button
          className={`tab ${tab === 'mysteries' ? 'tab--active' : ''}`}
          onClick={() => setTab('mysteries')}
        >
          Mysteries
        </button>
      </div>

      <div className="scroll">
        {tab === 'finds' ? (
          save.discoveries.length === 0 ? (
            <p className="empty">
              Empty. Everything in here will be something you actually pulled out of the ground.
            </p>
          ) : (
            <>
              <div className="tabs" style={{ padding: '0 0 12px' }}>
                {GROUPS.map((g) => (
                  <button
                    key={g.id}
                    className={`tab ${group === g.id ? 'tab--active' : ''}`}
                    onClick={() => setGroup(g.id)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {grouped.map(([heading, records]) => (
                <div key={heading}>
                  <div className="group-heading">
                    {heading} · {records.length}
                  </div>
                  {records.map((record) => {
                    const def = getTargetOrPlaceholder(record.targetId);
                    return (
                      <button
                        key={record.uid}
                        className="entry"
                        data-testid="journal-entry"
                        onClick={() => {
                          focusJournal(null);
                          setOpenUid(record.uid);
                        }}
                      >
                        <FindArt
                          silhouette={def.silhouette}
                          condition={record.condition}
                          className="entry__art"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 className="entry__name">{def.name}</h3>
                          <p className="entry__meta">
                            {def.significance === 'unknown' ? 'Unknown' : def.materialName} ·{' '}
                            {record.condition}% · {record.depthCm} cm
                          </p>
                        </div>
                        <RarityTag rarity={def.rarity} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )
        ) : (
          <>
            {progress.map((p) => (
              <div key={p.chain.id} className="panel" style={{ marginBottom: 12 }}>
                <div className="row row--between">
                  <strong className="serif" style={{ fontSize: 17 }}>
                    {p.held.length === 0 ? 'Unidentified pattern' : p.chain.name}
                  </strong>
                  <span className="label">
                    {p.held.length}/{p.chain.clueIds.length}
                  </span>
                </div>
                <p className="card__sub" style={{ marginTop: 6 }}>
                  {p.complete ? p.chain.completeText : p.held.length ? p.chain.hint : 'No clues yet.'}
                </p>
                {p.held.map((clue) => (
                  <div
                    key={clue.id}
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '1px solid var(--line)',
                    }}
                  >
                    <div className="label">{clue.symbol}</div>
                    <strong className="serif">{clue.title}</strong>
                    <p className="card__sub" style={{ margin: '4px 0 0' }}>
                      {clue.text}
                    </p>
                  </div>
                ))}
                {!p.complete && p.held.length > 0 ? (
                  <p className="tiny" style={{ marginTop: 10 }}>
                    {p.missing} more piece{p.missing === 1 ? '' : 's'} needed.
                  </p>
                ) : null}
              </div>
            ))}
            {save.clues.length === 0 ? (
              <p className="empty">
                Some finds carry markings that mean nothing on their own.
                <br />
                They will end up here.
              </p>
            ) : null}
          </>
        )}
      </div>

      {openRecord ? <FindSheet record={openRecord} onClose={() => setOpenUid(null)} /> : null}

      <Nav active="journal" />
    </div>
  );
}

function FindSheet({ record, onClose }: { record: DiscoveryRecord; onClose: () => void }) {
  const def = getTargetOrPlaceholder(record.targetId);
  const location = getLocation(record.locationId);
  const unknown = def.significance === 'unknown';
  const clue = def.clueId ? getClue(def.clueId) : undefined;
  const held = game.get().save.clues.includes(def.clueId ?? '');

  return (
    <div
      className="sheet"
      onClick={() => {
        focusJournal(null);
        onClose();
      }}
    >
      <div className="sheet__body" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <FindArt silhouette={def.silhouette} condition={record.condition} size={140} animate />
        </div>
        <h2 className="serif" style={{ textAlign: 'center', fontSize: 23, margin: '4px 0 8px' }}>
          {def.name}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <RarityTag rarity={def.rarity} />
        </div>

        <div className="grid2">
          <div>
            <div className="stat__label">Material</div>
            <div className="stat__value">{unknown ? 'Unknown' : def.materialName}</div>
          </div>
          <div>
            <div className="stat__label">Origin</div>
            <div className="stat__value">{unknown ? 'Unknown' : location?.name ?? 'Unknown'}</div>
          </div>
          <div>
            <div className="stat__label">Date</div>
            <div className="stat__value">{unknown ? 'Unknown' : def.era ?? 'Unknown'}</div>
          </div>
          <div>
            <div className="stat__label">Condition</div>
            <div className="stat__value">
              {record.condition}% · {conditionLabel(record.condition)}
            </div>
          </div>
          <div>
            <div className="stat__label">Depth</div>
            <div className="stat__value">{record.depthCm > 0 ? `${record.depthCm} cm` : '—'}</div>
          </div>
          <div>
            <div className="stat__label">Significance</div>
            <div className="stat__value" style={{ textTransform: 'capitalize' }}>
              {def.significance === 'none' ? '—' : def.significance}
            </div>
          </div>
        </div>

        <p style={{ fontFamily: 'var(--serif)', marginTop: 18, color: '#cfc7b2' }}>{def.description}</p>

        {clue && held ? (
          <div className="banner banner--mystery">
            <div className="banner__kicker">Clue</div>
            <strong className="serif">{clue.title}</strong>
            <p className="card__sub" style={{ margin: '4px 0 0' }}>
              {clue.text}
            </p>
          </div>
        ) : null}

        {record.tutorial ? (
          <p className="tiny" style={{ marginTop: 14 }}>
            Your first find. Logged like any other.
          </p>
        ) : null}

        <div style={{ marginTop: 18 }}>
          <Btn
            variant="ghost"
            wide
            sound="back"
            onClick={() => {
              focusJournal(null);
              onClose();
            }}
          >
            Close
          </Btn>
        </div>
      </div>
    </div>
  );
}

function groupFinds(records: DiscoveryRecord[], mode: GroupMode): [string, DiscoveryRecord[]][] {
  const map = new Map<string, DiscoveryRecord[]>();
  for (const record of records) {
    const def = getTargetOrPlaceholder(record.targetId);
    let key: string;
    switch (mode) {
      case 'location':
        key = getLocation(record.locationId)?.name ?? 'Unknown ground';
        break;
      case 'category':
        key = CATEGORY_LABEL[def.category] ?? def.category;
        break;
      case 'rarity':
        key = RARITY_LABEL[def.rarity as Rarity];
        break;
      case 'era':
        key = def.significance === 'unknown' ? 'Unknown era' : def.era ?? 'Unknown era';
        break;
    }
    const list = map.get(key);
    if (list) list.push(record);
    else map.set(key, [record]);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
}
