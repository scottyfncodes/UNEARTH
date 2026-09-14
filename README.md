# UNEARTH

A mobile-first archaeological adventure. You sweep a metal detector over
ordinary ground, dig carefully, and find out what has been down there. Most
of it is rubbish. Occasionally it is the first piece of something much bigger
— a shard that turns out to be one of three, a symbol that keeps recurring on
finds made in different places, a clue that opens up ground you had no reason
to go looking at before.

**Play it: https://scottyfncodes.github.io/UNEARTH/** — best on a phone, with
sound on.

```
EXPLORE → SEARCH → DISCOVER → IDENTIFY → CONNECT → UNLOCK → FOLLOW THE CLUE → DISCOVER MORE
```

The detector is one tool inside that loop, not the whole game: take it away
and there is still an adventure underneath — fragments to piece together,
clues that cross-reference each other, two authored adventures (a sealed
mechanism chamber and an overgrown ruin) that only open once you have
actually put together what you found, and one place — The Silent Court — you
walk through in genuine first-person 3D rather than from above: two matching
wall carvings are the game's first "wait, I've seen this" moment that happens
by looking rather than digging, and there's exactly one buried find in the
whole site, on purpose.

Deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` on every push
to the active branch; the unit suite has to pass before the site goes out.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173 — open it on a phone on your network
npm run build      # typecheck + production build
npm run preview    # serve the build on :4173
npm test           # unit tests (systems, content, save)
npm run e2e        # end-to-end tests at a phone viewport
npm run measure    # prints excavation timing/damage balance figures
```

Everything is rendered at runtime — no image or audio assets. The whole game is
about 115 kB gzipped.

## How it plays

- **Move** by dragging anywhere on the world (the stick appears under your
  thumb, so it is genuinely one-handed). Arrow keys or WASD work on a desktop.
- **Listen.** The coil sweeps in front of you automatically. Beeps get faster
  and brighter as the coil passes closer to something. Pitch hints at the
  material — low and coarse for iron, bright for silver, wrong and doubled for
  things that should not be down there.
- **Hold PINPOINT** to stop the sweep and read the target. That also drops a
  mark on the ground, which is the spot DIG will dig — so you can release the
  button and still dig where you found it.
- **Dig.** Scoop out the bulk, and the moment you feel the tool touch
  something, switch to the brush. The scoop does not care what it hits.
- **Lift it out** once about 70% of it is uncovered. Condition is permanent.
- Some finds carry markings. Those go in the journal as clues, and clues
  connect — the same recurring symbol on two "unrelated" finds is a real
  in-game signal, not decoration, and the journal's Links tab surfaces it.
- Some finds are only *part* of something. The Journal's Assemble tab shows
  every fragment set you have made progress on; once you hold every piece,
  fitting them together produces the whole object — and changes what you know.

Digging in the wrong place gives you an empty hole. That is intended: the
target stays in the ground and you can go back and find it properly.

## Architecture

Content is data, systems are pure functions, engines own the frame loop, and
React only draws screens. No gameplay rule lives in a component.

```
src/
  content/        pure data — no logic, no imports from app/
    targets.ts          every findable object, including fragment pieces and
                         the composites they assemble into
    locations.ts        plots and their loot tables
    clues.ts            clues and the chains (and cross-chain connections) they form
    equipment.ts        detectors and excavation tools
    silhouettes.ts      object shapes as primitives (used for both hit-testing and drawing)
    adventure/          authored adventures — a registry keyed by id, so a
                         second (or third) adventure is a content file plus
                         one line in index.ts, not new gameplay code
    sites/              first-person 3D sites — same registry pattern; a
                         SiteDef is walls, props, interactables, hazards and
                         detector-findable spots, all still just data
  core/
    types.ts            shared content and state types
    gameState.ts        the store: persistent save + navigation + actions
    save.ts             versioned save, migrations, and a sanitiser that eats bad data
    store.ts            tiny framework-agnostic observable
    rng.ts              seeded RNG, value noise, maths helpers
    debug.ts            opt-in read-only introspection (?debug=1)
  systems/        pure game logic, all unit-tested without a browser
    detection.ts        the signal model: falloff, depth, masking, noise, readouts
    placement.ts        procedural target placement from seeds
    excavation.ts       dirt, debris, contact, damage, exposure, extraction
    mechanism.ts        the precision artifact extraction
    discovery.ts        extraction/assembly/observation → journal record, clue, unlocks, funds
    mystery.ts          clue chain evaluation + cross-chain symbol connections
    assembly.ts         fragment-piece progress tracking and composite assembly
    explore.ts          first-person collision, hazards and interaction targeting
  engine/         browser-facing, imperative
    loop.ts             rAF loop with clamped delta, pauses when hidden
    input.ts            touch stick, drag tracker, look controller, canvas fitting
    audio.ts            everything synthesised with Web Audio
    haptics.ts          throttled vibration
    render/             world, pit, mechanism, object and texture renderers (2D)
    scene3d/            builds a THREE.Scene from a SiteDef; artifact sprites
                         reuse render/object.ts so a carving looks the same in
                         the world as it does in the journal
  app/            React screens and a handful of components
```

Two rules hold the shape:

1. **Systems never touch the DOM.** The pit, the signal model and the mechanism
   are plain data transformations, which is why they can be tested exhaustively
   and tuned with `npm run measure`.
2. **State lives in one store.** Per-frame values (player position, the dirt
   grid) stay in the engine and are flushed into the store at sensible moments,
   so React is never in the frame budget.

### Adding content

A new find is an entry in `targets.ts` plus a silhouette. A new location is an
entry in `locations.ts` with its own loot table. A new mystery is clues plus a
chain in `clues.ts`. A new fragment set is three or more `TargetDef`s with
`pieceOf` pointing at a composite `TargetDef` with `assemblyOf` — the composite
must be `authored: true` and never gets a `locations` list, since the only way
to obtain it is `systems/assembly.ts`, not a dig. A new adventure is a content
file shaped like `content/adventure/courtyard.ts` (a `mechanism`/`escape` are
optional — a puzzle-only adventure just omits them) plus one line in
`content/adventure/index.ts`. A new first-person site is a content file
shaped like `content/sites/silentCourt.ts` (props, interactables, one or two
hazards, and the spots a detector can actually find something) plus one line
in `content/sites/index.ts` — the 3D engine draws whatever the props and
interactables say, so a second site never touches `engine/scene3d/`. None of
that requires touching gameplay code — the content tests will tell you if a
reference is broken, a locked location is unreachable, a composite's pieces
are not actually findable, or a site's flags gate something nothing else ever
unlocks.

## Save data

Saved to `localStorage` under `unearth.save.v1`, versioned, and run through
migrations and then a field-by-field sanitiser on every load. A corrupt,
truncated or newer-than-this-build save is set aside under
`unearth.save.rejected` and the game starts clean instead of crashing. If
storage is unavailable (private browsing), the game falls back to an in-memory
store and keeps working for that session.

## Debug hook

Load any build with `?debug=1` to get a read-only `window.__unearth` exposing
game state and the live detector frame. It exists for debugging and for the
end-to-end tests, which use it as their "ears" while driving the game through
real input. It grants nothing a player could not work out by listening.

## Testing

- `npm test` — unit tests across the signal model, placement, excavation and
  damage, discovery and unlocks, the mechanism, fragment assembly and symbol
  connections, save robustness, and content integrity (including that every
  composite's pieces are actually findable, and every locked location —
  chain-gated or assembly-gated — is reachable).
- `npm run e2e` — plays the loop at a 390×844 viewport with touch: walks to a
  buried target using the real controls, pinpoints it, digs, excavates by
  dragging, extracts, checks the journal, and reloads to confirm persistence.
  Also plays both authored adventures end to end (the chamber's door puzzle,
  mechanism and escape; the courtyard's puzzle-only path), the tablet
  assembly flow, checks an empty hole stays honestly empty, and walks into
  The Silent Court on the real first-person controls (WASD/arrows plus a
  keyboard turn fallback for a mouse-less run) to confirm the 3D scene
  actually renders and a contextual prompt fires the same journal pipeline a
  dig does.

Only Chromium is available in this environment, so the phone is emulated
(iPhone-13 viewport, DPR 3, touch, mobile UA). That is not a substitute for a
pass on real iOS Safari and Android Chrome.

## Current scope

Built and playable: the full explore → search → discover → identify → connect
→ unlock → follow-the-clue loop across three detecting locations, equipment
progression, and two authored adventures:

- **The Sealed Chamber** — a door puzzle, a precision artifact extraction
  under rising tension with an ordered clamp release, and a reactive escape.
- **The Overgrown Courtyard** — a puzzle-only adventure (no mechanism, no
  escape) reached only by assembling a fragmented artifact first, proving the
  adventure format works without the chamber's extraction stakes.

Also built, and open from the very start of the game: **The Silent Court**, a
small walled ruin played in genuine first-person 3D (WebGL via Three.js,
lazy-loaded so nobody pays for it who never walks in) rather than from above.
Move with a thumb stick, look by dragging anywhere else on the screen, and a
single contextual button does whatever standing in front of something makes
possible — look closer, take it, or fit it. The detector still works here,
but it finds exactly one thing in the whole site: everything else is found by
looking, which is the point. Two matching serpent carvings on opposite walls
produce the same "wait, that matches" connection the detecting locations
build out of dug-up clues, except here it happens by walking up and looking;
a buried stone hand fits an empty socket on the court's broken statue, which
is the site's one puzzle and its payoff — a relic that was standing twelve
metres away the whole time. One hazard (an old collapsed cistern) is never
flagged by any UI; you only learn where it is by getting close enough to be
pushed back from it. `content/sites/` and `systems/explore.ts` are built to
take a second, larger site without changing engine code.

Two independent mystery threads run through the detecting locations, each with its own
recurring symbol, and cross at the end: the three-pointed sun (paperwork →
the mine → the sealed chamber) and the woven knot (three ordinary-looking
shards, found in the two starting locations, that turn out to be one object —
assemble it and it points somewhere new). The Journal's Links tab surfaces a
connection the moment two held clues share a symbol, whether or not they
belong to the same formal chain; its Assemble tab tracks progress on every
fragment set and performs the assembly.

Deliberately not built: a third adventure, a second first-person site, any
economy beyond funds for kit, and any progression system other than
equipment, knowledge and unlocked ground. The Silent Court drops one loose
thread on purpose — boot prints that are not yours, near a dropped modern
crate — and does nothing further with it. It is there for a future site to
pick up, not for this one to resolve.
