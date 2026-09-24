/**
 * Generates the home-screen / app icons from CK's own pixel grid in
 * src/render/ck.ts — the same art the game draws — so the icon can never
 * drift from the character. Writes plain PNGs with a tiny built-in encoder
 * (no image tooling needed):
 *
 *   public/icons/apple-touch-icon.png   180×180  iOS "Add to Home Screen"
 *   public/icons/icon-192.png           192×192  Android / manifest
 *   public/icons/icon-512.png           512×512  manifest, splash
 *   public/icons/icon-maskable-512.png  512×512  Android adaptive (safe zone)
 *
 * Run with `npm run icons` after changing CK's front-facing sprite.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const src = readFileSync(new URL('../src/render/ck.ts', import.meta.url), 'utf8');

function parseRows(name) {
  const m = src.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!m) throw new Error(`Could not find ${name} in ck.ts`);
  return [...m[1].matchAll(/'([^']*)'/g)].map((r) => r[1]);
}
function parsePalette() {
  const m = src.match(/const CK: Record<string, string> = \{([\s\S]*?)\};/);
  if (!m) throw new Error('Could not find the CK palette in ck.ts');
  return Object.fromEntries([...m[1].matchAll(/(\w):\s*'(#[0-9a-fA-F]{6})'/g)].map((r) => [r[1], r[2]]));
}

const DOWN = parseRows('DOWN');
const PAL = parsePalette();
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ── PNG encoding ───────────────────────────────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── drawing ────────────────────────────────────────────────────────────────
/** CK on the game's dark ground, lit by a warm gold glow — the title screen, in a square. */
function icon(size, spriteFraction) {
  const px = Buffer.alloc(size * size * 4);
  const bgDark = hex('#0b0f0c');
  const bgWarm = hex('#3a2f14');
  const cx = size / 2;
  const cy = size * 0.47;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x - cx, y - cy) / (size * 0.62));
      const t = (1 - d) ** 1.6;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(bgDark[c] + (bgWarm[c] - bgDark[c]) * t);
      px[i + 3] = 255;
    }
  }
  // Whole art pixels only, so the sprite stays perfectly crisp.
  const cell = Math.floor((size * spriteFraction) / 16);
  const ox = Math.round((size - cell * 16) / 2);
  const oy = Math.round((size - cell * 16) / 2 + size * 0.02);
  const paint = (gx, gy, color, dx = 0, dy = 0, alpha = 1) => {
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const X = ox + gx * cell + x + dx;
        const Y = oy + gy * cell + y + dy;
        if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
        const i = (Y * size + X) * 4;
        for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * (1 - alpha) + color[c] * alpha);
      }
    }
  };
  // A soft drop shadow, then CK.
  const shadow = Math.max(2, Math.round(cell * 0.6));
  DOWN.forEach((row, gy) =>
    [...row].forEach((ch, gx) => {
      if (ch !== '.') paint(gx, gy, [0, 0, 0], 0, shadow, 0.45);
    }),
  );
  DOWN.forEach((row, gy) =>
    [...row].forEach((ch, gx) => {
      if (ch !== '.' && PAL[ch]) paint(gx, gy, hex(PAL[ch]));
    }),
  );
  return png(size, px);
}

const out = (name, buf) => {
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), buf);
  console.log(`wrote public/icons/${name} (${buf.length} bytes)`);
};
out('apple-touch-icon.png', icon(180, 0.72));
out('icon-192.png', icon(192, 0.72));
out('icon-512.png', icon(512, 0.72));
// Android crops maskable icons to a circle; keep CK inside the central safe zone.
out('icon-maskable-512.png', icon(512, 0.56));
