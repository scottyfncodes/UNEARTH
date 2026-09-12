# UNEARTH

A mobile-first metal detecting game. You sweep a coil over ordinary ground,
interpret what the detector tells you, dig carefully, and find out what has
been down there. Most of it is rubbish. Occasionally it is not.

```
SEARCH → DETECT → LOCATE → DIG → EXTRACT → IDENTIFY → COLLECT → DISCOVER
```

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
about 110 kB gzipped.

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
  connect.

Digging in the wrong place gives you an empty hole. That is intended: the
target stays in the ground and you can go back and find it properly.

## Architecture

Content is data, systems are pure functions, engines own the frame loop, and
React only draws screens. No gameplay rule lives in a component.

```
src/
  content/        pure data — no logic, no imports from app/
    targets.ts          every findable object
    locations.ts        plots and their loot tables
    clues.ts            clues and the chains they form
    equipment.ts        detectors and excavation tools
    silhouettes.ts      object shapes as primitives (used for both hit-testing and drawing)
    adventure/          authored adventure scripts
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
    discovery.ts        extraction → journal record, clue, unlocks, funds
    mystery.ts          clue chain evaluation
  engine/         browser-facing, imperative
    loop.ts             rAF loop with clamped delta, pauses when hidden
    input.ts            touch stick, drag tracker, canvas fitting
    audio.ts            everything synthesised with Web Audio
    haptics.ts          throttled vibration
    render/             world, pit, mechanism, object and texture renderers
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
chain in `clues.ts`. None of that requires touching gameplay code — the content
tests will tell you if a reference is broken or a locked location is
unreachable.

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

- `npm test` — 110 unit tests across the signal model, placement, excavation
  and damage, discovery and unlocks, the mechanism, save robustness, and content
  integrity.
- `npm run e2e` — plays the loop at a 390×844 viewport with touch: walks to a
  buried target using the real controls, pinpoints it, digs, excavates by
  dragging, extracts, checks the journal, and reloads to confirm persistence.
  Also plays the authored adventure end to end, and checks an empty hole stays
  honestly empty.

Only Chromium is available in this environment, so the phone is emulated
(iPhone-13 viewport, DPR 3, touch, mobile UA). That is not a substitute for a
pass on real iOS Safari and Android Chrome.

## Current scope

Built and playable: the full detecting → excavation → discovery → journal →
mystery loop across three detecting locations, equipment progression, and one
authored adventure (The Sealed Chamber) with a door puzzle, a precision
artifact extraction under rising tension, and an escape.

Deliberately not built: a second adventure, any economy beyond funds for kit,
and any progression system other than equipment, knowledge and unlocked
ground.
