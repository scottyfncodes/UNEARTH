# UNEARTH

A third-person archaeological adventure. You are CK — Curious Kitten — and
your human, an archaeologist, went out one morning and never came back. You
follow his trail: real ground to walk, a collar that hums when it senses
something buried, dirt to paw and claw and brush aside, and an escalating
archaeological mystery that was never actually about you going missing at
all. Most of what comes up out of the ground is rubbish. Occasionally it is
the first piece of something much bigger — a shard that turns out to be one
of three, a symbol that keeps recurring on finds made in different places, a
clue that opens up ground you had no reason to go looking at before.

**Play it: https://scottyfncodes.github.io/UNEARTH/** — best on a phone, with
sound on.

```
EXPLORE → SEARCH / OBSERVE → DISCOVER → IDENTIFY → CONNECT → UNLOCK → FOLLOW THE CLUE → DISCOVER MORE
```

Exploring is third person — you see CK, small against doorways and ruins
built at human scale, moving like an actual cat rather than a tiny human
avatar. Left thumb moves, right thumb looks (the camera trails behind CK
rather than sitting at his eye), one contextual button does whatever standing
in front of something makes possible. The collar is worn everywhere, not a
separate minigame you switch into — walking from open ground into an
authored ruin never changes how the game controls or feels. CK's own body —
paw, claw, tail, whiskers, nose — is the excavation kit; there is no shovel.

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

Everything is rendered at runtime — no image or audio assets. Three.js is
lazy-loaded, so a player who never walks past the map pays nothing for it; the
main bundle is about 110 kB gzipped.

## How it plays

- **Move** with a thumb stick that appears wherever your left thumb lands;
  **look** by dragging anywhere on the right side of the screen — the chase
  camera turns with CK rather than at him. WASD + mouse drag work on a
  desktop, with Q/E as a keyboard-only turn fallback.
- **SEARCH.** Hold the ground steady and walk — the collar reads in front of
  CK automatically, and CK reacts to it: ears rotate forward and the tail
  quickens as the signal gets stronger. Beeps get faster and brighter as CK
  passes closer to something. Pitch hints at the material — low and coarse
  for iron, bright for silver, wrong and doubled for things that should not
  be down there. There is no on-screen meter for this on purpose: the collar
  talks to you through sound and through CK, not a percentage.
- **Hold PINPOINT** to narrow the search and read the target. That also drops
  a mark on the ground, which is the spot DIG will dig — so you can release
  the button and still dig where you found it.
- **OBSERVE.** Some things are never buried — a carving on a wall, a plaque
  half-sunk in the grass, boot prints that are not yours. Walk up, look at it,
  and a single contextual prompt appears. No collar involved; you only find
  these by actually looking.
- **Dig.** Paw out the bulk, and the moment you feel something underneath,
  switch to a gentler tool — whiskers or tail — to clear the rest. The paw
  does not care what it hits.
- **Lift it out** once about 70% of it is uncovered. Condition is permanent.
- Some finds carry markings. Those go in the journal as clues, and clues
  connect — the same recurring symbol on two "unrelated" finds is a real
  in-game signal, not decoration, and the journal's Links tab surfaces it,
  whether the two finds came from digging, looking, or both.
- Some finds are only *part* of something. The Journal's Assemble tab shows
  every fragment set you have made progress on; once you hold every piece,
  fitting them together produces the whole object — and changes what you know.

Digging in the wrong place gives you an empty hole. That is intended: the
target stays in the ground and you can go back and find it properly. Likewise,
you can walk straight past something you never looked at — that is intended
too.

## Architecture

Content is data, systems are pure functions, engines own the frame loop, and
React only draws screens. No gameplay rule lives in a component.

```
src/
  content/        pure data — no logic, no imports from app/
    targets.ts          every findable object, including fragment pieces,
                         the composites they assemble into, and the fixed
                         scenery clues found by looking rather than digging
    locations.ts         plots, their loot tables, and any sceneryClues —
                          every non-adventure location is played in third
                          person, whether it hosts a procedural field or an
                          authored SiteDef (see siteId)
    clues.ts             clues and the chains (and cross-chain connections) they form
    equipment.ts         collars and excavation tools (CK's paw, claw, tail,
                          whiskers, nose — the signal model doesn't care what
                          holds it, it's the same DetectorDef/ToolDef shape)
    silhouettes.ts       object shapes as primitives (used for both hit-testing and drawing)
    adventure/           authored adventures (puzzle/mechanism/escape) — a
                          registry keyed by id, so a second adventure is a
                          content file plus one line in index.ts
    sites/                authored third-person spaces — same registry
                          pattern; a SiteDef is walls, props, interactables,
                          hazards and collar-findable spots, all still data.
                          site_home is both the opening (the archaeologist is
                          gone) and, once both adventures are complete, the
                          ending, gated with SiteInteractable's
                          requiresAdventuresComplete
  core/
    types.ts            shared content and state types
    gameState.ts        the store: persistent save + navigation + actions
    save.ts             versioned save, migrations, and a sanitiser that eats bad data
    store.ts            tiny framework-agnostic observable
    rng.ts               seeded RNG, value noise, maths helpers
    debug.ts             opt-in read-only introspection (?debug=1)
  systems/        pure game logic, all unit-tested without a browser
    detection.ts        the signal model: falloff, depth, masking, noise, readouts
    placement.ts        procedural target placement from seeds
    excavation.ts       dirt, debris, contact, damage, exposure, extraction
    mechanism.ts        the precision artifact extraction
    discovery.ts        extraction/assembly/observation → journal record, clue, unlocks, funds
    mystery.ts          clue chain evaluation + cross-chain symbol connections
    assembly.ts         fragment-piece progress tracking and composite assembly
    explore.ts           movement: collision, rectangular and circular
                          bounds, hazards, interaction targeting, the collar's
                          sweep position, and thirdPersonCameraPose — the pure
                          math for where the chase camera sits, reusing the
                          same yaw/pitch a first-person eye camera would
  engine/         browser-facing, imperative
    loop.ts             rAF loop with clamped delta, pauses when hidden
    input.ts             touch move stick, look drag controller, drag tracker,
                          canvas fitting
    audio.ts             everything synthesised with Web Audio
    haptics.ts            throttled vibration
    render/               the pit, mechanism, object and texture renderers (2D)
    scene3d/               builds a THREE.Scene from either a SiteDef or a
                            detecting LocationDef; ck.ts builds CK himself
                            (body/head/ears/tail/legs/collar, procedural
                            primitives, no model files) and animates him from
                            movement and collar signal strength; artifact
                            sprites reuse render/object.ts so a carving looks
                            the same in the world as it does in the journal
  app/            React screens and a handful of components
    screens/ExploreScreen.tsx   the one third-person screen for every
                                 location — authored site or open field —
                                 the excavation pit is still its own screen,
                                 reached the same way from either
```

Two rules hold the shape:

1. **Systems never touch the DOM.** The pit, the signal model, the mechanism
   and `systems/explore.ts` are plain data transformations, which is why they
   can be tested exhaustively (and the pit's balance tuned with `npm run
   measure`) without a browser.
2. **State lives in one store.** Per-frame values (player position, the dirt
   grid) stay in the engine and are flushed into the store at sensible moments,
   so React is never in the frame budget.

### Adding content

A new find is an entry in `targets.ts` plus a silhouette. A new detecting
location is an entry in `locations.ts` with its own loot table (and,
optionally, one or two `sceneryClues` — fixed, always-visible finds discovered
by looking). A new mystery is clues plus a chain in `clues.ts`. A new fragment
set is three or more `TargetDef`s with `pieceOf` pointing at a composite
`TargetDef` with `assemblyOf` — the composite must be `authored: true` and
never gets a `locations` list, since the only way to obtain it is
`systems/assembly.ts`, not a dig. A new adventure is a content file shaped
like `content/adventure/courtyard.ts` (a `mechanism`/`escape` are optional — a
puzzle-only adventure just omits them) plus one line in
`content/adventure/index.ts`. A new authored third-person site is a content
file shaped like `content/sites/silentCourt.ts` (props, interactables, one or
two hazards, and the spots the collar can actually find something) plus one
line in `content/sites/index.ts` and a `siteId` on the `LocationDef` that
hosts it — the 3D engine draws whatever the props and interactables say, so a
second site never touches `engine/scene3d/`. None of that requires touching
gameplay code — the content tests will tell you if a reference is broken, a
locked location is unreachable, a composite's pieces are not actually
findable, or a site's flags gate something nothing else ever unlocks.

## Save data

Saved to `localStorage` under `unearth.save.v1`, versioned, and run through
migrations and then a field-by-field sanitiser on every load. A corrupt,
truncated or newer-than-this-build save is set aside under
`unearth.save.rejected` and the game starts clean instead of crashing. If
storage is unavailable (private browsing), the game falls back to an in-memory
store and keeps working for that session.

## Debug hook

Load any build with `?debug=1` to get a read-only `window.__unearth` exposing
game state and the live collar/explore frames. It exists for debugging and
for the end-to-end tests, which use it as their "ears" while driving the game
through real input. It grants nothing a player could not work out by looking
and listening.

## Testing

- `npm test` — unit tests across the signal model, placement, excavation and
  damage, discovery and unlocks, the mechanism, fragment assembly and symbol
  connections, movement/collision/hazard/targeting/chase-camera math (shared
  by every space), save robustness, and content integrity (including that
  every composite's pieces are actually findable, every locked location —
  chain-gated or assembly-gated — is reachable, and every site/scenery-clue
  reference and flag actually resolves to something real).
- `npm run e2e` — plays the whole loop at a 390×844 viewport with touch and
  the real third-person controls: walks a detecting field, sweeps, pinpoints,
  digs, excavates by dragging, extracts, checks the journal, and reloads to
  confirm persistence; finds a fixed scenery clue by looking rather than
  digging; confirms a wrong-place dig stays honestly empty; walks into The
  Silent Court to confirm its 3D scene renders and its contextual prompt goes
  through the same journal pipeline as a dig; and plays both authored
  adventures end to end (the chamber's door puzzle, mechanism and escape; the
  courtyard's puzzle-only path), plus the tablet assembly flow.

Only Chromium is available in this environment, so the phone is emulated
(iPhone-13 viewport, DPR 3, touch, mobile UA) and rendered in software (no
GPU) — WebGL still runs, just slower than on a real device, and this
environment's synthetic keyboard/pointer input has enough of its own timing
jitter that the e2e helpers favour coarse, self-correcting navigation
(turn-then-forward, re-checking after every step) over precise single moves.
Neither of those stand in for a pass on real iOS Safari and Android Chrome.

## Current scope

Built and playable: the full explore → search/observe → discover → identify →
connect → unlock → follow-the-clue loop, entirely in third person, across:

- **CK's Home** — the opening and, once both adventures below are complete,
  the ending. Chapter one is entirely OBSERVE: an empty food bowl, a torn page
  from the archaeologist's own notebook, nothing to dig. Revisit it after
  finishing the mystery and a new beat unlocks: he's back, he was at the
  shop, and there's something sitting next to CK that nobody remembers
  burying.
- **Three detecting fields** — Old Park, the Old Railway, and the Abandoned
  Mine — each a walkable, seed-scattered plot with a full procedural loot
  table and one fixed scenery clue found by looking, not sweeping.
- **The Silent Court** — a small authored ruin. Two matching serpent carvings
  on opposite walls produce a "wait, that matches" symbol connection by
  looking rather than digging; a buried stone hand (the site's one
  collar-findable dig) fits an empty socket on a broken statue, whose payoff
  is a relic that was standing nearby the whole time; one hazard (a collapsed
  cistern) is never flagged by any UI, only discovered by getting too close
  to it; a dropped modern crate and boot prints that are not yours seed a
  future narrative thread without resolving it.
- **Two authored adventures**, reached through the map like anywhere else:
  **The Sealed Chamber** (a door puzzle, a precision artifact extraction under
  rising tension with an ordered clamp release, and a reactive escape) and
  **The Overgrown Courtyard** (a puzzle-only adventure — no mechanism, no
  escape — reached only by assembling a fragmented artifact first). Together
  these are CK's escalating archaeological odyssey — and completing both is
  what finally unlocks the ending back at Home.

Two independent mystery threads run through the detecting fields, each with
its own recurring symbol, and cross at the end: the three-pointed sun
(paperwork → the mine → the sealed chamber) and the woven knot (three
ordinary-looking shards, found in the two starting fields, that turn out to be
one object — assemble it and it points somewhere new). The Journal's Links tab
surfaces a connection the moment two held clues share a symbol, whether or not
they belong to the same formal chain and whether they were dug up or simply
noticed; its Assemble tab tracks progress on every fragment set and performs
the assembly.

Deliberately not built: a third authored site, a third adventure, any economy
beyond funds for kit, and any progression system other than equipment,
knowledge and unlocked ground. Booby traps and cat-specific traversal
puzzles (too light for a pressure plate, small enough for a gap a human
couldn't take) exist as systems — hazards and mechanisms are already data —
but no site has been authored around them yet; that's the next vertical
slice, not this one. The Silent Court drops one loose thread on purpose —
boot prints that are not yours, near a dropped modern crate — and does
nothing further with it. It is there for a future site to pick up, not for
this one to resolve.
