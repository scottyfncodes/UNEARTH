# UNEARTH

An 8-bit archaeological mystery starring **CK, the Curious Kitten**.

Dad pops out one morning — *"twenty minutes, back before you know it!"* —
and CK, batting a book off the shelf, finds a note: *"Back soon — followed a
lead out past the old ruins."* So CK follows the trail. Out through the
Meadow, into the Forgotten Temple, down the Old Well into the Sunken Crypt,
and through a crack no person could ever fit through, to the Hollow at the
bottom of it all.

It is a real adventure. It is also, on a second read of every clue, a very
funny one: the note was twenty years old, and Dad just went to the store.

**Play it: https://scottyfncodes.github.io/UNEARTH/** — best on a phone,
with sound on.

```
EXPLORE → LISTEN → DIG / PAW → FIND → ASSEMBLE → UNLOCK → GO DEEPER
```

## The journey

| | Where | What happens |
|---|---|---|
| Prologue | **Home** — *Twenty Minutes* | Dad leaves. A vase falls (a shiny rolls out). A book falls (the note falls out). |
| | **The Meadow** | Old Shellby the tortoise, who remembers everything slightly wrong. A magpie with opinions about shinies. Two roads. |
| Chapter I | **The Forgotten Temple** (3 rooms) | Dig up half a bronze key, squeeze behind a statue for the other half. Dodge dart plates. Push a block into a pit for a secret lever. Claim the **Sunstone**. |
| | **The Old Well** | The way down — pitch black until CK carries the Sunstone. |
| Chapter II | **The Sunken Crypt** (3 rooms + the Last Passage) | Dark rooms lit only by CK's glow. Falling-rock plates. Pip the bat. A weighted-plate door. Three pieces of the **Moon Seal**, one of them buried among decoys. Dad's hat, thick with dust. |
| Chapter III | **The Hollow** | Where Dad had to stop — and where CK doesn't. |

Along the way: **12 shinies** to hoard, **5 pages of Dad's field notes**,
**6 secret nooks**, and a Curiosity rating on the ending screen, from
*Mildly Interested* to *Keeper of the Hollow*.

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

- **Move** with the d-pad (or arrows / WASD). CK steps one tile at a time;
  the camera follows.
- **The collar** is always listening. It pings faster and higher as CK nears
  something buried, and the ring around CK pulses gold; near a trap's
  mechanism it warbles low and the ring turns red. The signal says
  *something's here*, not *dig exactly here* — most soft dirt is just dirt.
- **Dig** (X / Shift) turns up the soft patch CK is facing. Stone and grass
  are too hard, and CK will tell you so.
- **Paw** (Space / Enter) does whatever makes sense: talk, read a note, pull a
  lever, open a door, inspect a carving — or knock something off a shelf,
  because CK is a cat.
- **Finds** get held up overhead with a fanfare and a card. **Fragments
  assemble themselves** the instant CK carries the whole set.
- **Cat-only gaps**, **secret nooks** (a little riff plays when you find
  one), **fish treats** that restore a heart.
- **Traps are readable, never random**: dart holes in a wall and scorch
  marks on the floor; loose pebbles under a cracked ceiling stone; and the
  collar's red warning. A hit costs a heart and knocks CK back; losing every
  heart just sends CK to the room's entrance.
- **Puzzles** use pushable blocks: into a pit to make a bridge, or onto
  weighted plates to open a door. Loose blocks reset when CK leaves a room,
  so no puzzle can be softlocked; solved doors stay open.

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
    maps.ts               all eleven screens, as ASCII rows + entities
    items.ts               fragments, artifacts, relics, treats and the 12 shinies
    clues.ts                Dad's field-note pages and everything CK noticed
    recipes.ts              the bronze key and the Moon Seal
    progress.ts             shinies/pages/secrets/relics → a curiosity %
    initialState.ts         fresh save + engine context wiring
  render/           canvas 2D presentation — no game logic
    pixel.ts              a tiny pixel-art toolkit: 16×16 sprites baked once
    ck.ts                  CK's frames, Dad, the tortoise, the bat, the magpie
    sprites.ts             every item and prop
    tiles.ts               per-region terrain with auto-tiled walls, baked per room
    fx.ts                  particles, shake, flashes, darts, rocks, ambient life
    draw.ts                camera, depth sorting, darkness and the Sunstone's light
  app/              React shell: canvas, HUD, controls, dialogue, find/note
                    cards, chapter titles, journal, title and ending screens
  engine/audio.ts     synthesised SFX, the collar's pings, a chiptune loop per region
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

Flags, inventory, clues, per-room state, position and hearts are saved to
`localStorage` under `unearth.save.v2` after every action that produces an
event (v1 saves belong to the old vertical slice and are ignored). Play time
is tracked separately so the ending can compare it with Dad's twenty
minutes. A corrupt or missing save falls back to a fresh game; if storage is
unavailable the game just runs without persistence.

## Debug hook

Load any build with `?debug=1` to get `window.__unearth`, exposing live game
state and a `dispatch()` for driving actions directly — used by the
end-to-end tests.

## Testing

- `npm test` — the engine (movement, cat-gaps, digging, the detector,
  assembly, dialogue, doors, levers, blocks and pits, traps, knock-overs,
  secrets, treats, item-gated exits, weighted-plate doors and block resets,
  save/load), content validation (every exit, entity, item, clue and door
  resolves; every map is reachable), and **a full playthrough**: a
  pathfinder drives genuine move actions through the real maps from the
  prologue to the credits, collecting all 12 shinies and all 5 pages without
  ever stepping on a live trap plate. Break a wall or an exit and it fails.
- `npm run e2e` — at a phone viewport with the real on-screen buttons: the
  title screen and d-pad, the journal, the whole prologue (Dad's goodbye, the
  vase's find card, the old note, out the door into the Meadow), and the
  ending from a finished save.
