/**
 * A tiny 5×7 bitmap font, so the words on the title screen are made of the
 * same chunky pixels as CK. Glyphs are text rows ('#' is ink); narrow
 * punctuation is simply a narrower row. Capitals only — the game shouts its
 * name and whispers nothing.
 */
export const GLYPH_HEIGHT = 7;
const GAP = 1;

export const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '#.'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
};

/** Whether every character of `text` has a glyph (case-insensitive). */
export function canSpell(text: string): boolean {
  return [...text.toUpperCase()].every((ch) => ch === '\n' || ch in GLYPHS);
}

function glyph(ch: string): string[] {
  return GLYPHS[ch.toUpperCase()] ?? GLYPHS['?']!;
}

/** Width of one line of text, in font pixels. */
export function lineWidth(line: string): number {
  if (!line) return 0;
  return [...line].reduce((w, ch) => w + glyph(ch)[0]!.length + GAP, -GAP);
}

/** Size of a block of (newline-separated) text, in font pixels. */
export function measure(text: string, lineGap = 3): { width: number; height: number; lines: string[] } {
  const lines = text.split('\n');
  return {
    width: Math.max(...lines.map(lineWidth)),
    height: lines.length * GLYPH_HEIGHT + (lines.length - 1) * lineGap,
    lines,
  };
}

/** Calls `ink(x, y, row)` for every lit pixel of `text`, each line centred in `width`. */
export function eachPixel(text: string, width: number, lineGap: number, ink: (x: number, y: number, row: number) => void): void {
  measure(text, lineGap).lines.forEach((line, li) => {
    let x = Math.floor((width - lineWidth(line)) / 2);
    const top = li * (GLYPH_HEIGHT + lineGap);
    for (const ch of line) {
      const rows = glyph(ch);
      rows.forEach((row, y) => {
        for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') ink(x + gx, top + y, y);
      });
      x += rows[0]!.length + GAP;
    }
  });
}

/**
 * How many device pixels each canvas pixel gets: a whole number, so every
 * pixel lands on the same number of screen pixels and nothing smears. Aims
 * for `target` CSS pixels per canvas pixel and never exceeds `maxWidth`.
 */
export function integerScale(canvasWidth: number, target: number, maxWidth: number, dpr: number): number {
  const wanted = Math.max(1, Math.round(target * dpr));
  const fits = Math.max(1, Math.floor((maxWidth * dpr) / canvasWidth));
  return Math.min(wanted, fits);
}
