# UNEARTH

An 8-bit archaeological adventure starring **CK, the Curious Kitten** — the pet
of a famous archaeologist who has mysteriously disappeared. CK follows the
trail across an increasingly strange ruin, digging up fragments, dodging
booby traps, and squeezing through gaps no person could fit through.

**Play it: https://scottyfncodes.github.io/UNEARTH/** — best on a phone.

```
EXPLORE → DETECT → INVESTIGATE → DISCOVER → ASSEMBLE → SOLVE → UNLOCK → EXPLORE DEEPER
```

Top-down, tile-based, chunky pixel art. CK moves one tile at a time; the
detector collar hums when something is near (buried, or a mechanism behind a
wall); paws dig, push, and open things. The eventual punchline: after an
enormous adventure, CK discovers the archaeologist just went to the store and
has been gone about twenty minutes.

Deployed to GitHub Pages by `.github/workflows/deploy-pages.yml` on every push
to the active branch; the unit suite has to pass before the site goes out.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173 — open it on a phone on your network
npm run build      # typecheck + production build
npm run preview    # serve the build on :4173
npm test           # unit tests (engine, content)
npm run e2e        # end-to-end smoke test at a phone viewport
```

Everything is rendered on a `<canvas>` at runtime — no image or audio assets,
no engine dependency. The whole game is React + a hand-rolled 2D tile
renderer; gzipped the bundle is well under 100 kB.

## How it plays

- **Move** with the on-screen d-pad (or arrow keys / WASD). CK steps one tile
  at a time and turns to face whatever it bumps into.
- **Detector collar** (🔁 to switch tools): glows and hums when something is
  near. A gold ring means something's buried; a red ring means a mechanism —
  often a trap. The signal tells you *something's* there, not always *dig
  here*.
- **Dig** (⛏): faces a soft patch of ground and turns it up in one action.
  Signal → investigate → discover, not sweeping.
- **Interact** (✋): talk, pull a lever, read a note, open a door, inspect
  something suspicious — whatever CK is facing.
- **Fragments assemble automatically** the instant CK is carrying every piece
  a recipe needs — no separate "combine" screen.
- **Cat-only gaps**: cracks in a wall too narrow for a person. CK just walks
  through them; that's the whole ability.
- **Pressure plates + traps**: readable, not random. A trap has a tell — an
  obvious plate, scorch marks, a detector "mechanism" reading — before it
  fires. Getting hit knocks a heart off and bounces CK back; running out of
  hearts resets CK to the room's entrance, no game-over screen.

## Architecture

```
src/
  game/            pure, framework-free engine logic — unit-testable without a browser
    types.ts             GameMap, Entity, GameState, Action, GameEvent
    mapBuilder.ts        turns an ASCII legend + rows into a GameMap
    world.ts              read-only queries: what's at a tile, is it blocked, is a door open
    movement.ts           one-tile-at-a-time stepping: walls, blocks/pits, plates/traps, exits
    dig.ts                 face a diggable tile, reveal what's buried (or just dirt)
    detector.ts            nearest-signal model (buried vs. mechanism), radius-limited
    interact.ts            the one contextual action: talk, unlock, pull, read, inspect
    artifacts.ts            fragment → artifact assembly recipes
    inventory.ts            small state helpers: add item, add clue, set flag
    engine.ts               reduce(state, action) -> { state, events } — the single dispatch point
    save.ts                  minimal localStorage save/load
  content/          pure data — maps, items, clues, recipes
    maps.ts               the vertical slice's world: home, outskirts, the Forgotten Temple
    items.ts                fragment/artifact/trinket display info
    clues.ts                 the archaeologist's trail, read in the journal
    recipes.ts               which fragments assemble into which artifact
    initialState.ts          fresh save + engine context wiring
  render/           canvas 2D presentation — no game logic
    tiles.ts, entities.ts, ck.ts, draw.ts, motion.ts, palette.ts
  app/              React shell: canvas mount, HUD, touch controls, journal, dialogue
  core/
    game.ts               the live Store<GameState> + dispatch()
    store.ts                tiny framework-agnostic observable
    debug.ts                 opt-in read-only introspection (?debug=1)
```

Two rules hold the shape:

1. **`src/game/*` never touches the DOM or React.** Every mechanic — movement,
   digging, the detector, puzzles, traps, assembly — is a pure function over
   plain data, which is why it's exhaustively unit-tested without a browser.
2. **Maps are terrain + entities, not one big blob.** Terrain (walls, floors,
   pits, cat gaps, diggable dirt) is an immutable grid; anything that changes
   at runtime — a dug patch, a pushed block, an opened door, a story flag —
   lives in per-map runtime state, layered on top by `world.ts`.

### Adding content

A new room is a `buildMap()` call in `content/maps.ts`: an ASCII grid for
terrain, plus a list of entities (npc/item/door/switch/block/trap/clueNote/
decoration) positioned by tile coordinate. `mapBuilder.ts` throws immediately
on a bad legend character or a mismatched row length. A new fragment set is
entries in `content/items.ts` plus a recipe in `content/recipes.ts`; assembly
happens automatically the instant the inventory satisfies it. A new clue is an
entry in `content/clues.ts`, referenced by a `clueNote` or `decoration`
entity's `clueId`. `tests/unit/content/maps.test.ts` checks that every
exit points somewhere real, every map is reachable from home, every entity is
in bounds, and every referenced item/clue id actually exists — so a typo in
content fails a test, not a player's game.

## Save data

Flags, inventory, clues, position and hearts are saved to `localStorage`
under `unearth.save.v1` after every action that produces an event. A corrupt
or missing save falls back to a fresh game rather than crashing; if storage
is unavailable, the game just keeps running without persistence for that
session.

## Debug hook

Load any build with `?debug=1` to get a read-only `window.__unearth` exposing
live game state and a `dispatch()` for driving actions directly — used by the
end-to-end smoke test.

## Testing

- `npm test` — movement/collision/cat-only gaps, digging, the detector signal
  model, artifact assembly, inventory, dialogue and completion flags,
  switches/doors/locked areas, movable-block-into-pit puzzles, pressure-plate
  traps and knockback, save/load round-tripping, and content validation
  (every map reachable, every reference resolves) — plus an integration test
  that walks the real vertical-slice content through its full progression
  loop, fragment collection through to the sanctum reward, and a second test
  covering the hidden-lever shortcut.
- `npm run e2e` — a phone-viewport smoke test: title screen → begin → the
  canvas and HUD render → the touch d-pad actually moves CK → the journal
  opens and closes.

## Current scope — the vertical slice

Built and playable: **CK's Home** (the archaeologist's departure and his
note), **the Outskirts** (a short connective screen with one optional buried
trinket and a decorative clue), and **the Forgotten Temple** — three rooms:
an entry hall (a buried fragment, a clue note, a cat-only gap hiding a second
fragment), a puzzle chamber (a pressure-plate dart trap on the obvious path,
a movable block that bridges a pit to a hidden lever-shortcut), and the inner
sanctum (locked by the assembled key or the shortcut lever; the reward and
the final field-notes clue).

Deliberately not built yet: the rest of the world map (Desert Ruins,
Overgrown Temple, Burial Grounds, and the rest), a second dungeon, more than
one artifact recipe, an ability tree beyond CK's innate cat traversal, combat,
and the comedic ending itself — that lands once there's a full journey to
undercut.
