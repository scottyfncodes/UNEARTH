# UNEARTH

A third-person archaeological adventure. You are CK — Curious Kitten — and
your human, an archaeologist, went out one morning and never came back. You
follow his trail: real ground to walk, a collar that hums when it senses
something buried, dirt to paw and claw and brush aside, and an escalating
archaeological mystery that was never actually about you going missing at
all. Most of what comes up out of the ground is rubbish. Occasionally it is
the first piece of something much bigger — a shard that turns out to be one
of three, a symbol that keeps recurring on finds made in different places, a
clue that opens up ground you had no reason to go looking at before. Being a
cat matters here beyond how the world looks: some gaps are his and his
alone, some floor plates need weight he doesn't have, and some booby traps
built for a grown archaeologist are a lot less dangerous to something this
small — until he blunders into one anyway.

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

- **Move** with a thumb stick that appears wherever your left thumb lands —
  it's analog, so a light push creeps and a full push trots, which matters
  once there's something in the room worth creeping past; **look** by
  dragging anywhere on the right side of the screen — the chase camera turns
  with CK rather than at him. WASD + mouse drag work on a desktop, with Q/E
  as a keyboard-only turn fallback (the keyboard is all-or-nothing, unlike
  the stick — it's a fallback for testing and desktop play, not the tuned
  experience).
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

- **Cat routes.** Some gaps are narrower than anything a person could use —
  the site says so, out loud, the first time you find one — and CK just
  walks through. There's no special button: if his own small collision
  radius fits, he fits. `systems/traversal.ts` is what makes that claim
  honest rather than just a comment (see `isCatOnlyGap`).
- **Booby traps.** A hazard optionally carries a `kind` (pressure plate,
  tripwire, falling stone, dart, collapsing floor, swinging, unstable) that
  only changes the decal you see, so returning players start reading them at
  a glance — the underlying trigger is the same push-back-and-warn mechanic
  everywhere. Every hazard is also classified `readable`, `discoverable` or
  `sneaky` (see "Booby trap readability" below), which sets how big and
  obvious that decal reads on the ground. Firing one can itself set a flag —
  a trap sprung, deliberately or not, can be the thing that opens the next
  room, so recklessness has a real outcome rather than just a dead stop.
- CK reacts to more than the collar now: his ears and head turn toward
  whatever's actually relevant — a target, a strong signal, a hazard he's
  giving a wide berth — and he visibly creeps and flattens his ears through
  a tight squeeze rather than just clipping through it like a camera would.

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
                          hazards, collar-findable spots and (optionally)
                          catRoutes — cat-only passages — all still data.
                          site_home is both the opening (the archaeologist is
                          gone) and, once both adventures are complete, the
                          ending, gated with SiteInteractable's
                          requiresAdventuresComplete; site_silent_court's
                          inner vault is the cat-traversal/booby-trap slice
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
                          sweep position, thirdPersonCameraPose (the pure math
                          for where the chase camera sits, reusing the same
                          yaw/pitch a first-person eye camera would),
                          headTurnToward (the clamped local yaw offset behind
                          CK's curious/wary head turns), and resolveSitePose
                          (falls back to the site's spawn if a remembered
                          pose is missing, out of bounds, or corrupt)
    traversal.ts         cat-only gap classification (isCatOnlyGap and the
                          two width minimums it compares) and activeCatRoute,
                          the trigger-zone lookup a CatRouteZone uses (with a
                          small exit hysteresis so idling on a zone's edge
                          doesn't flicker the crouch pose) — not a physics
                          system, since there's no separate "human" collider
                          in this game to mechanically exclude; see its own
                          header comment
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
                            movement, collar signal strength, proximity to
                            hazards and interactables (ears, head turn, a
                            wary posture) and cat-route traversal (a lower,
                            flatter crouch through a squeeze or crawl);
                            artifact sprites reuse render/object.ts so a
                            carving looks the same in the world as it does
                            in the journal
  app/            React screens and a handful of components
    screens/ExploreScreen.tsx   the one third-person screen for every
                                 location — authored site or open field —
                                 the excavation pit is still its own screen,
                                 reached the same way from either. Digging
                                 inside a site detours through 'excavate' and
                                 'discovery', unmounting this screen; it
                                 remembers CK's last pose per site (session
                                 memory only, see siteExplorePoses) so coming
                                 back drops him where he was, not back at
                                 the entrance
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
two hazards, the spots the collar can actually find something, and optionally
`catRoutes`) plus one line in `content/sites/index.ts` and a `siteId` on the
`LocationDef` that hosts it — the 3D engine draws whatever the props and
interactables say, so a second site never touches `engine/scene3d/`. A new
booby trap is a `HazardZone` with a cosmetic `kind` for the decal, same
`radius`/`warning`/`disarmedByFlag` as any other hazard, plus an optional
`setsFlagOnTrigger` if springing it should itself unlock something. A new cat
route is a `CatRouteZone` (`kind`, `position`, `radius`, an authored
`clearWidthM`, `grantsFlag`, an optional one-time `note`) — the content test
suite checks that a `'squeeze'` route's `clearWidthM` actually satisfies
`isCatOnlyGap`, so a site can't quietly claim a normal-width doorway is
cat-only. None of that requires touching gameplay code — the content tests
will tell you if a reference is broken, a locked location is unreachable, a
composite's pieces are not actually findable, or a site's flags gate
something nothing else ever unlocks.

### Booby trap readability

A vault built entirely of hidden triggers just teaches the player to distrust
open ground, not to read the environment — so every `HazardZone` requires a
`readability`, one of three categories (full detail in the `HazardReadability`
doc comment in `content/sites/types.ts`):

- **`'readable'`** — the danger is visible on sight: a plate you can see, a
  taut wire across a doorway. No supporting clue needed. Prefer this whenever
  the geometry allows it; it is the most forgiving category and costs the
  player nothing to respect.
- **`'discoverable'`** — not obvious at a glance, but a `notice` interactable
  placed nearby (holes in a wall, disturbed stone, an old scorch mark, a
  mechanism that visibly connects to something else) rewards a player who
  actually looks before walking in. The content test suite enforces the
  connection: a `'discoverable'` hazard with no `notice` within reach fails
  the build.
- **`'sneaky'`** — genuinely easy to trigger by accident, with no advance
  warning at all. Reserve this for a hazard whose own `warning` text explains
  what just happened clearly enough that the player recognises the *next*
  one — Silent Court's collapsed cistern is the model: no sign warns you, but
  "the ground gives here, hidden under old growth" teaches "watch overgrown
  ground" for every site after it. Never pair `'sneaky'` with a real setback;
  a push-back and a line of text is the ceiling for this category, matching
  the game's wider rule against punishing traps.

The category is more than a label: it scales how large and visible the
ground decal is (see `engine/scene3d/build.ts`), so a returning player starts
reading `'readable'` danger patches from across a room long before a
`'sneaky'` one gives anything away. Pick the loosest category the moment
actually calls for — a trap that could be `'readable'` but is authored
`'sneaky'` for drama is a bug, not a difficulty choice.

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
  by every space), cat-gap classification, cat-route lookup and its exit
  hysteresis, per-site pose persistence (a valid remembered pose is kept, an
  out-of-bounds or corrupt one falls back to spawn), save robustness, and
  content integrity (including that every composite's pieces are actually
  findable, every locked location — chain-gated or assembly-gated — is
  reachable, every site/scenery-clue reference and flag — including a
  hazard's `setsFlagOnTrigger` — actually resolves to something real, every
  authored `'squeeze'` cat route is honestly narrow enough to earn the name,
  and every `'discoverable'` hazard has a `notice` within reach).
- `npm run e2e` — plays the whole loop at a 390×844 viewport with touch and
  the real third-person controls: walks a detecting field, sweeps, pinpoints,
  digs, excavates by dragging, extracts, checks the journal, and reloads to
  confirm persistence; finds a fixed scenery clue by looking rather than
  digging; confirms a wrong-place dig stays honestly empty; walks into The
  Silent Court to confirm its 3D scene renders and its contextual prompt goes
  through the same journal pipeline as a dig; drives real pointer drags (not
  just the keyboard fallback) to prove the move stick is analog and the dead
  zone holds; squeezes through the court's cat-only gap into its inner
  vault, digs up a find (confirming CK comes back where he was digging, not
  reset to the entrance), reads a trap warning, solves the weight/plate
  puzzle to disarm the trap and collects the vault's reward; separately
  confirms springing the same trap outright grants the same progress instead
  of a dead end; and plays both authored adventures end to end (the
  chamber's door puzzle, mechanism and escape; the courtyard's puzzle-only
  path), plus the tablet assembly flow.

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
  looking rather than digging; a buried stone hand fits an empty socket on a
  broken statue, whose payoff is a relic that was standing nearby the whole
  time; one hazard (a collapsed cistern) is never flagged by any UI, only
  discovered by getting too close to it; a dropped modern crate and boot
  prints hint that someone else has been through here. A glazed shard lying
  in the open near the west wall looks like ordinary debris until its match
  turns up much later, in the last place a human could reach.
  Tucked in its south-east corner, a contained cat-traversal/booby-trap
  vertical slice: a gap in an old partition wall the site itself calls too
  narrow for the archaeologist who built the place — CK fits anyway — opens
  onto a small vault. A buried tin (found before you ever risk the trap)
  finally resolves the boot-prints/crate thread the main court only gestures
  at; a `'discoverable'` dart trap tucked off the direct path is explained by
  a warning sign before it ever fires; and a plate that wants weight CK
  doesn't have is solved the same way as anywhere else in this game — find a
  loose stone and push it into place — which disarms the trap and opens the
  vault's own reward: the shard's other half. Assembling the two in the
  Journal doesn't just make a whole vessel — the break across it is a clean,
  deliberate cut, not an accident, and the vessel carries the same coiled
  serpent as both wall carvings, tying the statue, the carvings, and the
  vault together as one thing the archaeologist chose to hide rather than
  leave whole. The same trap-disarm flag springs whether you solve the plate
  carefully or just blunder into the trap outright; either way, something
  opens. Digging the tin still detours through the excavation screen, and CK
  comes back exactly where he left off rather than at the site's entrance.
- **The Undercroft** — unlocked only by assembling the Silent Court's vessel,
  a compact archaeological-deduction puzzle with no keypad, no color match,
  and no arbitrary sequence: a raised waystone ringed by four stone posts,
  each carved with a different mark. Only one — the coiled serpent, the same
  mark from the court's own walls — actually turns it; the tell is entirely
  physical (that post is worn pale and smooth from years of the same grip;
  the other three are rough with disuse) and echoed by a half-legible note
  the archaeologist left wedged nearby. A wrong post grinds a stiff quarter
  turn and locks — a real, recognisable dead end, not a soft no-op — but
  every post stays available afterward; nothing resets. Turning the correct
  one only gets the waystone itself moving: the actual catch is behind a
  cat-only gap, in a gap too tight for the hand that clearly reached for it
  (a bent iron tool, wedged and abandoned, is proof enough) and gave up. CK
  finishes it with a single push no person could have made. The payoff is a
  sealed bronze marker, not a treasure — the kind you leave when you intend
  to come back — naming a place the archaeologist went looking next, one
  this game doesn't visit.
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

Deliberately not built: a third authored adventure, any economy beyond funds
for kit, and any progression system other than equipment, knowledge and
unlocked ground. The Silent Court's boot prints and dropped crate are only
partly resolved — the vault's buried tin confirms someone has been quietly
working this court, and the reassembled vessel confirms the archaeologist
knew exactly what he was hiding it from, but not who that is. The Undercroft
answers that with a direction, not a name: a marker naming somewhere he went
looking next, that this game doesn't follow him to. Both stay loose threads
on purpose, for whatever picks them up next.
