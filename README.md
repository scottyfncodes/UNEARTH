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
NOTICE → INVESTIGATE → INTERPRET → LOCATE → DIG → DISCOVER
```

## The journey

| | Where | What happens |
|---|---|---|
| Prologue | **Home** — *Twenty Minutes* | Dad leaves. A vase falls (a shiny rolls out). A book falls (the note falls out). |
| | **The Meadow** | Old Shellby the tortoise, who remembers everything slightly wrong. A magpie who buried her best bottlecap and forgot which side of the stump. Molehills (always moles). Three roads. |
| | **Dad's Old Dig Site** *(optional)* | Dad's abandoned camp: a neat grid of trenches, every one empty; a dig log pointing at the one find he never came back for; junk everywhere; Mortimer the Mole, who explains the collar with contempt; and a tarp that isn't holding anything up — down into **The Old Trench**. |
| Chapter I | **The Forgotten Temple** (3 rooms) | Follow the guardian's stare to half a bronze key; squeeze behind it for the other half. A strip of slightly-wrong bricks across a corridor, a frieze of a small figure leaping them, and a loose pebble to find out for sure. Grit from a loose ceiling. Push a block into a pit for a secret lever. Lift the **Sunstone** — and run from the boulder. |
| | **The Old Well** | The way down — pitch black until CK carries the Sunstone. |
| Chapter II | **The Sunken Crypt** (4 rooms + the Last Passage) | Dark rooms lit only by CK's glow. Ceilings that trickle before they drop. **The Crumbling Span**: a bridge that holds just long enough, with gaps to hop. Pip the bat. A weighted-plate door and a floor of spikes with a heartbeat. Three pieces of the **Moon Seal**, the last one buried among the keepers' decoy moons. Dad's hat, thick with dust. |
| Chapter III | **The Hollow** | Where Dad had to stop — and where CK doesn't. |

Along the way: **16 shinies** to hoard, **5 pages of Dad's field notes**,
**8 secret nooks**, nearly twenty things CK simply *notices*, and a
Curiosity rating on the ending screen, from *Mildly Interested* to *Keeper
of the Hollow*.

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
  holding a direction trots. **Tapping a new direction turns CK on the spot
  first** — keep holding and CK sets off. Turning in place is how you sweep
  the collar around.
- **Nothing on the ground says "dig here."** Outdoors every patch of grass
  is diggable; indoors, soft earth shows wherever the paving has gone — in
  big irregular patches, nearly all of it hiding nothing. Some of what looks
  suspicious (molehills, Dad's old empty holes, a chalk X) is exactly
  nothing. Some of what is buried is junk: a bent nail, a tent peg, a
  keepers' decoy moon.
- **The collar is a direction finder.** Pings come faster the *closer* CK
  is, whichever way CK faces; the ping gets *clearer and brighter* the more
  squarely CK faces the source, and dull and muffled facing away. Walls in
  between muffle it further. When the source is the tile right in front of
  CK, it chirps twice ("Here!"). Junk rings duller and buzzier than the real
  thing — a patient listener can tell. Near a trap's mechanism it warbles low
  and CK's fur stands up.
- **The room talks too.** A statue's stare, a floor inscription, Dad's dig
  log, a bat who saw something fall, a skull missing a tooth. And CK notices
  things on its own — a little "?", "!" or "…" bubble, sometimes a line —
  most of them pure curiosity (a frog, a beetle, a draught), a few of them
  the first hint of a find. Nothing important is findable *only* by
  squinting at pixels: every real dig also has the collar.
- **Dig** (X / Shift) the tile CK is facing. It takes a moment: scoops of
  dirt fly, a hole opens, and then the ground answers — a find, junk, or
  just dirt. Stone is too hard, and CK will say so.
- **Hop** (Z / J / C) two tiles forward, clearing whatever sits between: a
  one-tile gap, low rubble or a fallen column, a trigger strip. Never a
  wall, never anything tall, never two tiles of gap. No fall damage, no
  precision — it is a cat, being a cat.
- **Paw** (Space / Enter) does whatever makes sense: talk, read, pull a
  lever, open a door, inspect a carving, knock something off a shelf, bat a
  pebble — or, for the scenery, give it a sniff.
- **Traps have a language, and each one wants something different:**
  - *Dart strips* — a course of narrow bricks, a shade off, right across a
    corridor, with small holes in the wall. Step on one: *click* — and the
    darts come a moment later. Keep trotting and they hiss past behind you;
    stop to wonder what that was, and they don't. Or hop the strip and it
    never clicks at all. Or bat a pebble onto it first and watch.
  - *Loose ceilings* — pebbles on the floor under them. Stepping there
    starts a trickle of grit and a growing shadow. Move.
  - *The Crumbling Span* — every stone holds long enough to cross, none
    long enough to stand on.
  - *Spikes* — a floor with a heartbeat. Watch it, then go on the beat.
  - *The boulder* — you'll know.
  A hit costs a heart and sends CK back to the last safe tile; losing every
  heart just sends CK to the room's entrance. Falling from the bridge lets
  it settle back.
- **Finds** get held up overhead with a fanfare and a card. **Fragments
  assemble themselves** the instant CK carries the whole set.
- **Puzzles** use pushable blocks: into a pit to make a bridge, or onto
  weighted plates to open a door. Loose blocks reset when CK leaves a room,
  so no puzzle can be softlocked; solved doors stay open.

## Architecture

```
src/
  game/            pure, framework-free engine logic — unit-testable without a browser
    types.ts             GameMap, Entity, GameState, Action, GameEvent
    mapBuilder.ts        turns ASCII terrain rows + an optional ASCII props layer into a GameMap
    world.ts              read-only queries: what's at a tile, is it blocked, is a door open
    movement.ts           stepping, turning on the spot and hopping, sharing one arrival rule
                          (items, nooks, curios, trigger strips, crumbling stone, exits)
    dig.ts                 dig the soft tile ahead: a find, junk, dirt, or somebody's old hole
    detector.ts            the directional collar: proximity, aim, walls, lock-on, junk vs. treasure
    hazards.ts             time: delayed strikes, crumbling floors, spike rhythms, rolling boulders
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
    tiles.ts               per-region terrain with auto-tiled walls, frayed earth, trigger
                           bricks, floor scatter and flat dressing, baked per room
    dressing.ts            ~45 pieces of set dressing: pottery, rubble, roots, old tools…
    fx.ts                  particles, shake, flashes, darts, rocks, ambient life
    draw.ts                camera, depth sorting, darkness and the Sunstone's light
  app/controls.ts   turn-then-walk, the timed dig and the hop — shared by touch and keyboard
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
2. **Maps are terrain + dressing + entities, not one big blob.** Terrain
   (walls, floors, earth, pits, trigger bricks, crumbling stone) is an
   immutable grid; dressing is inert scenery; anything that changes at
   runtime — a dug patch, a pushed block, a kicked pebble, a crumbled stone,
   an opened door, a story flag — lives in per-map runtime state, layered on
   top by `world.ts`.
3. **Time is an action.** The canvas sends a `tick` with the game clock,
   which only runs while nothing modal is on screen. A tick with nothing in
   flight returns the very same state, so idle rooms cost nothing.

### Adding content

A new room is a `buildMap()` call in `content/maps.ts`: an ASCII grid for
terrain, an optional ASCII `props` grid for set dressing (legend in
`game/mapBuilder.ts`), buried finds and junk, plus a list of entities
(npc/item/door/switch/block/trap/roller/curio/clueNote/decoration)
positioned by tile coordinate. `mapBuilder.ts` throws immediately
on a bad legend character or a mismatched row length. A new fragment set is
entries in `content/items.ts` plus a recipe in `content/recipes.ts`; assembly
happens automatically the instant the inventory satisfies it. A new clue is an
entry in `content/clues.ts`, referenced by a `clueNote` or `decoration`
entity's `clueId`. `tests/unit/content/maps.test.ts` checks that every
exit points somewhere real, every map is reachable from home, every entity is
in bounds, every referenced item/clue id actually exists, every buried find
sits on soft ground with decoys and plenty of empty earth around it, every
trigger brick belongs to a trap, and every boulder rolls a connected path —
so a typo in content fails a test, not a player's game.

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

- `npm test` — the engine (movement, turning, hopping, cat-gaps, digging
  and junk, the directional collar, delayed dart strips, pebbles, falling
  stones, crumbling floors, spike rhythms, the boulder, curios,
  assembly, dialogue, doors, levers, blocks and pits, traps, knock-overs,
  secrets, treats, item-gated exits, weighted-plate doors and block resets,
  save/load), content validation (every exit, entity, item, clue and door
  resolves; every map is reachable), and **a full playthrough**: a
  pathfinder drives genuine move actions through the real maps from the
  prologue to the credits, collecting all 16 shinies and all 5 pages without
  ever being hit: it hops the dart strips, steps on and straight off one
  to reach a nook, ducks into an alcove while the boulder passes, trots
  across the Crumbling Span, and waits for the spikes to drop. Break a wall,
  an exit or a trap's timing and it fails.
- `npm run e2e` — at a phone viewport with the real on-screen buttons: the
  title screen, d-pad (including turn-before-walk), Dig and Hop, the journal, the whole prologue (Dad's goodbye, the
  vase's find card, the old note, out the door into the Meadow), and the
  ending from a finished save.
