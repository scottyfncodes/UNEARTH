import { useEffect } from 'react';
import { getLocation } from '@/content/locations';
import { dismissDiscovery, focusJournal, game } from '@/core/gameState';
import { conditionLabel } from '@/systems/discovery';
import { audio } from '@/engine/audio';
import { Btn, FindArt, RarityTag } from '../components/ui';

export function DiscoveryScreen() {
  const pending = game.get().pending;

  useEffect(() => {
    if (!pending) return;
    if (pending.clue) {
      const timer = setTimeout(() => audio.clue(), 750);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [pending]);

  if (!pending) {
    dismissDiscovery();
    return null;
  }

  const { record, def, clue, connections, chains, unlockedLocations } = pending;
  const location = getLocation(record.locationId);
  const unknown = def.significance === 'unknown';
  // Discovery shows what you can tell at a glance — the full identification
  // comes later, the first time you open this find in the journal.
  const shownName = def.unidentifiedName ?? def.name;
  // After an adventure there is no field to go back to — offer the map instead.
  const field = game.get().save.field;
  const canResumeField = !!field && field.targets.some((t) => !t.dug);
  // A find made inside a first-person site returns to that site, not the
  // (possibly unrelated, possibly nonexistent) 2D field.
  const activeSite = game.get().activeSite;

  return (
    <div className="discovery" data-testid="discovery-screen">
      <div className="discovery__kicker">
        {def.rarity === 'legendary' || def.rarity === 'veryRare' ? 'Extraordinary discovery' : 'Discovery'}
      </div>
      <div className="discovery__art reveal-in">
        <FindArt silhouette={def.silhouette} condition={record.condition} animate />
      </div>
      <h1 className="discovery__name" data-testid="discovery-name">
        {shownName}
      </h1>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
        <RarityTag rarity={def.rarity} />
      </div>

      <p className="discovery__flavour">“{def.discoveryText}”</p>

      <div style={{ padding: '22px 20px 0' }}>
        <div className="panel grid2">
          <div>
            <div className="stat__label">Material</div>
            <div className="stat__value">{def.materialName}</div>
          </div>
          <div>
            <div className="stat__label">Estimated era</div>
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
            <div className="stat__label">Found</div>
            <div className="stat__value">{location?.name ?? 'Unknown'}</div>
          </div>
          <div>
            <div className="stat__label">Field value</div>
            <div className="stat__value">{record.value > 0 ? `${record.value} funds` : '—'}</div>
          </div>
        </div>

        <div className="stagger">
          {pending.firstOfKind && def.rarity !== 'common' ? (
            <div className="banner">
              <div className="banner__kicker">New to your collection</div>
              <p style={{ margin: '6px 0 0', fontFamily: 'var(--serif)' }}>{def.description}</p>
            </div>
          ) : null}

          {clue ? (
            <div className="banner banner--mystery" data-testid="clue-banner">
              <div className="banner__kicker">New clue discovered</div>
              <p style={{ margin: '6px 0 4px', fontFamily: 'var(--serif)', fontSize: 17 }}>{clue.title}</p>
              <p className="card__sub" style={{ margin: 0 }}>
                {clue.text}
              </p>
            </div>
          ) : null}

          {connections.length > 0 ? (
            <div className="banner banner--mystery" data-testid="connection-banner">
              <div className="banner__kicker">Wait — that matches something</div>
              <p style={{ margin: '6px 0 4px', fontFamily: 'var(--serif)', fontSize: 17 }}>
                {clue?.symbol}
              </p>
              <p className="card__sub" style={{ margin: 0 }}>
                The same mark is on {connections.length === 1 ? '"' + connections[0]!.title + '"' : `${connections.length} other finds`} already in your journal. Check the Links tab.
              </p>
            </div>
          ) : null}

          {chains.map((chain) => (
            <div key={chain.id} className="banner banner--mystery" data-testid="chain-banner">
              <div className="banner__kicker">Clue chain complete</div>
              <p style={{ margin: '6px 0 4px', fontFamily: 'var(--serif)', fontSize: 18 }}>
                {chain.completeTitle}
              </p>
              <p className="card__sub" style={{ margin: 0 }}>
                {chain.completeText}
              </p>
            </div>
          ))}

          {unlockedLocations.map((loc) => (
            <div key={loc.id} className="banner" data-testid="unlock-banner">
              <div className="banner__kicker">New location discovered</div>
              <p style={{ margin: '6px 0 4px', fontFamily: 'var(--serif)', fontSize: 20 }}>
                {loc.name.toUpperCase()}
              </p>
              <p className="card__sub" style={{ margin: 0 }}>
                {loc.description}
              </p>
            </div>
          ))}
        </div>

        <p className="tiny" style={{ textAlign: 'center', margin: '20px 0 10px' }}>
          Added to your field journal.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 28 }}>
          <Btn
            variant="primary"
            wide
            data-testid="keep-searching"
            onClick={() => dismissDiscovery(activeSite || canResumeField ? 'explore3d' : 'map')}
          >
            {activeSite ? 'Keep exploring' : canResumeField ? 'Keep searching' : 'Back to the map'}
          </Btn>
          <Btn
            variant="ghost"
            wide
            onClick={() => {
              dismissDiscovery('journal');
              focusJournal(def.id);
            }}
          >
            View in journal
          </Btn>
        </div>
      </div>
    </div>
  );
}
