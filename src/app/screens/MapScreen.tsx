import { LOCATIONS } from '@/content/locations';
import { getChain } from '@/content/clues';
import { chainProgress } from '@/systems/mystery';
import { enterLocation, game, go } from '@/core/gameState';
import { useGameState } from '../useGame';
import { Btn, TopBar } from '../components/ui';
import { Nav } from '../components/Nav';

export function MapScreen() {
  const { save } = useGameState();
  const progress = chainProgress(save.clues);

  return (
    <div className="screen">
      <TopBar
        title="Field Map"
        subtitle={`${save.discoveries.length} ${save.discoveries.length === 1 ? 'find' : 'finds'} · ${save.money} funds`}
      />

      <div className="scroll">
        {LOCATIONS.map((loc) => {
          const unlocked = !loc.lockedBy || save.unlockedLocations.includes(loc.id);
          const chain = loc.lockedBy ? getChain(loc.lockedBy) : undefined;
          const chainState = progress.find((p) => p.chain.id === loc.lockedBy);
          const findsHere = save.discoveries.filter((d) => d.locationId === loc.id).length;
          const isAdventure = !!loc.adventureId;
          const adventureDone = isAdventure && save.adventures[loc.adventureId!] === 'complete';

          if (!unlocked) {
            return (
              <div key={loc.id} className="card card--locked">
                <h2 className="card__title" style={{ letterSpacing: '0.2em' }}>
                  ???
                </h2>
                <p className="card__sub">
                  {chainState && chainState.held.length > 0
                    ? `${chainState.held.length} of ${chain?.clueIds.length} clues · ${chain?.hint}`
                    : (loc.lockedHint ?? 'Somewhere out there. You have no reason to go looking yet.')}
                </p>
              </div>
            );
          }

          return (
            <button
              key={loc.id}
              className="card"
              data-ui="true"
              data-testid={`location-${loc.id}`}
              onClick={() => {
                if (isAdventure) {
                  go('adventure');
                } else {
                  enterLocation(loc.id);
                }
              }}
            >
              <div className="row row--between">
                <div style={{ minWidth: 0 }}>
                  <h2 className="card__title">{loc.name}</h2>
                  <p className="card__sub">{loc.subtitle}</p>
                </div>
                <span className="label">
                  {isAdventure ? (adventureDone ? 'Complete' : 'Unsealed') : `${findsHere} found`}
                </span>
              </div>
              <p className="card__sub" style={{ marginTop: 10 }}>
                {loc.description}
              </p>
              {isAdventure ? (
                <p className="banner__kicker" style={{ marginTop: 10 }}>
                  {adventureDone ? 'Revisit' : 'Enter'}
                </p>
              ) : null}
            </button>
          );
        })}

        <div className="group-heading">Open questions</div>
        {progress.filter((p) => p.held.length > 0).length === 0 ? (
          <p className="empty" style={{ padding: '16px 0' }}>
            Nothing yet. Some finds carry more than they appear to.
          </p>
        ) : (
          progress
            .filter((p) => p.held.length > 0)
            .map((p) => (
              <div key={p.chain.id} className="panel" style={{ marginBottom: 10 }}>
                <div className="row row--between">
                  <strong className="serif">{p.chain.name}</strong>
                  <span className="label">
                    {p.held.length}/{p.chain.clueIds.length}
                  </span>
                </div>
                <p className="card__sub" style={{ marginTop: 6 }}>
                  {p.complete ? p.chain.completeText : p.chain.hint}
                </p>
              </div>
            ))
        )}

        <div style={{ marginTop: 18 }}>
          <Btn variant="ghost" wide onClick={() => go('journal')}>
            Open Field Journal
          </Btn>
        </div>
        {game.get().loadOutcome === 'recovered' ? (
          <p className="tiny" style={{ marginTop: 14 }}>
            A previous save could not be read and was set aside. This one started clean.
          </p>
        ) : null}
      </div>

      <Nav active="map" />
    </div>
  );
}
