/**
 * All sound is synthesised — no audio files on a static host. iOS requires
 * the AudioContext to be created/resumed inside a real user gesture, so
 * nothing is built until unlock() is called from a tap.
 *
 * Three layers: one-shot effects, the collar's detector pings (faster and
 * higher the closer CK gets — the game's hot/cold hook), and a small
 * chiptune score, one loop per region, sequenced a little ahead of time.
 */
import type { Region } from '@/game/types';
import type { DetectorReading } from '@/game/detector';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Song {
  bpm: number;
  root: number;
  scale: number[];
  /** Scale degrees (0-based) of each bar's chord root. */
  bars: number[];
  style: 'bouncy' | 'wander' | 'sparse' | 'drone' | 'dream';
  seed: number;
}

const SONGS: Record<Region, Song> = {
  home: { bpm: 104, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], bars: [0, 5, 3, 4], style: 'bouncy', seed: 3 },
  meadow: { bpm: 118, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], bars: [0, 3, 5, 4], style: 'wander', seed: 11 },
  well: { bpm: 84, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], bars: [0, 5, 3, 6], style: 'sparse', seed: 7 },
  temple: { bpm: 92, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], bars: [0, 6, 3, 4], style: 'sparse', seed: 19 },
  crypt: { bpm: 70, root: 52, scale: [0, 1, 3, 5, 7, 8, 10], bars: [0, 1, 0, 6], style: 'drone', seed: 23 },
  vault: { bpm: 76, root: 53, scale: [0, 2, 4, 6, 7, 9, 11], bars: [0, 1, 4, 0], style: 'dream', seed: 31 },
};

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Step {
  bass?: number;
  lead?: number;
  arp?: number;
}

/** Builds a four-bar, 16-steps-per-bar loop: an A-A' melody over chord roots. */
function compose(song: Song): Step[] {
  const r = rng(song.seed);
  const note = (degree: number, octave = 0) => {
    const len = song.scale.length;
    const oct = Math.floor(degree / len) + octave;
    return song.root + song.scale[((degree % len) + len) % len]! + oct * 12;
  };
  // One two-bar motif, repeated with a tweak — memorable beats random.
  const motif: (number | null)[] = [];
  const density = song.style === 'bouncy' ? 0.62 : song.style === 'wander' ? 0.55 : song.style === 'dream' ? 0.35 : 0.22;
  let deg = 2;
  for (let i = 0; i < 32; i++) {
    const strong = i % 4 === 0;
    if (r() < (strong ? density + 0.25 : density * 0.6)) {
      deg += Math.round((r() - 0.5) * 4);
      deg = Math.max(0, Math.min(9, deg));
      motif.push(deg);
    } else motif.push(null);
  }
  const steps: Step[] = [];
  for (let bar = 0; bar < 4; bar++) {
    const chord = song.bars[bar]!;
    for (let s = 0; s < 16; s++) {
      const i = (bar % 2) * 16 + s;
      const step: Step = {};
      if (song.style === 'drone') {
        if (s === 0) step.bass = note(chord, -1);
        if (s === 8 && r() < 0.5) step.lead = note(chord + 4, 1);
      } else {
        if (s % (song.style === 'bouncy' ? 4 : 8) === 0) step.bass = note(chord + (s === 8 ? 4 : 0), -1);
        const m = motif[i];
        if (m !== null && m !== undefined) step.lead = note(m + (bar === 3 && s > 8 ? 1 : 0), song.style === 'dream' ? 1 : 0);
        if (song.style === 'wander' || song.style === 'dream') {
          if (s % 2 === 0) step.arp = note(chord + [0, 2, 4, 7][(s / 2) % 4]!, 1);
        }
      }
      steps.push(step);
    }
  }
  return steps;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private enabled = true;

  private song: Region | null = null;
  private steps: Step[] = [];
  private stepIndex = 0;
  private nextStepAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  private nextPingAt = 0;

  constructor() {
    try {
      this.enabled = localStorage.getItem('unearth.sound') !== 'off';
    } catch {
      // storage unavailable — keep sound on
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem('unearth.sound', on ? 'on' : 'off');
    } catch {
      // ignore
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.05);
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.85 : 0;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.2;
      this.musicBus.connect(this.master);
      if (this.song) this.startSequencer();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  // ── primitives ──────────────────────────────────────────────────────────

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    gainPeak = 0.22,
    at = 0,
    dest: AudioNode | null = this.master,
    slideTo?: number,
  ): void {
    if (!this.ctx || !dest) return;
    const t0 = Math.max(this.ctx.currentTime, at || this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  private noise(duration: number, gainPeak: number, lowpass = 1200): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.value = gainPeak;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  private arpeggio(notes: number[], gap: number, type: OscillatorType = 'square', gainPeak = 0.16, len = 0.14): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    notes.forEach((n, i) => this.tone(midi(n), len, type, gainPeak, t + i * gap));
  }

  // ── effects ─────────────────────────────────────────────────────────────

  bump(): void {
    this.tone(110, 0.06, 'square', 0.1);
  }
  step(): void {
    this.noise(0.03, 0.05, 900);
  }
  push(): void {
    this.noise(0.18, 0.18, 400);
    this.tone(90, 0.16, 'triangle', 0.14);
  }
  dig(): void {
    this.noise(0.12, 0.22, 700);
  }
  digHard(): void {
    this.tone(180, 0.05, 'square', 0.1);
    this.tone(150, 0.07, 'square', 0.08, (this.ctx?.currentTime ?? 0) + 0.06);
  }
  pickup(): void {
    this.arpeggio([76, 83], 0.07, 'square', 0.16);
  }
  shiny(): void {
    this.arpeggio([84, 88, 91, 96], 0.05, 'triangle', 0.16, 0.18);
  }
  /** The big one: a found fragment, a relic, an assembled artifact. */
  fanfare(big = false): void {
    const notes = big ? [67, 71, 74, 79, 83, 86, 91] : [72, 76, 79, 84];
    this.arpeggio(notes, big ? 0.09 : 0.08, 'square', 0.16, 0.22);
    if (big) this.arpeggio([55, 62, 67], 0.3, 'triangle', 0.2, 0.6);
  }
  clue(): void {
    this.arpeggio([69, 72, 76], 0.09, 'triangle', 0.14, 0.25);
  }
  secret(): void {
    // A little ascending "you weren't supposed to find this" riff.
    this.arpeggio([79, 78, 75, 69, 68, 76, 80, 84], 0.07, 'square', 0.12, 0.12);
  }
  heal(): void {
    this.arpeggio([72, 79], 0.08, 'triangle', 0.16);
  }
  doorOpen(): void {
    this.noise(0.4, 0.14, 500);
    this.tone(110, 0.4, 'sawtooth', 0.08, 0, this.master, 70);
  }
  doorLocked(): void {
    this.tone(140, 0.1, 'square', 0.14);
    this.tone(120, 0.12, 'square', 0.12, (this.ctx?.currentTime ?? 0) + 0.1);
  }
  dart(): void {
    this.tone(1800, 0.12, 'sawtooth', 0.08, 0, this.master, 300);
  }
  rock(): void {
    this.noise(0.35, 0.3, 300);
  }
  hurt(): void {
    this.tone(220, 0.25, 'square', 0.18, 0, this.master, 90);
  }
  talk(): void {
    this.tone(520 + Math.random() * 80, 0.04, 'square', 0.08);
  }
  ui(): void {
    this.tone(300, 0.05, 'square', 0.08);
  }
  meow(): void {
    this.tone(700, 0.35, 'triangle', 0.14, 0, this.master, 480);
  }

  // ── the collar ──────────────────────────────────────────────────────────

  /**
   * Called every frame with the current reading. Distance sets the tempo —
   * pings come faster the closer CK is, whichever way CK faces. Facing sets
   * the voice — turned away it is a low, muffled blip; turned toward the
   * source it brightens and rises. Locked on (the source is the very tile in
   * front of CK) it chirps twice. Junk rings duller and buzzier than the
   * real thing; a mechanism warbles low.
   */
  detector(reading: DetectorReading): void {
    if (!this.ctx || !this.master || !reading.kind || reading.strength <= 0) return;
    const now = this.ctx.currentTime;
    if (now < this.nextPingAt) return;
    const interval = 1.15 - reading.proximity * 0.95;
    this.nextPingAt = now + interval;
    const { aim, proximity } = reading;
    if (reading.kind === 'mechanism') {
      this.tone(260 - proximity * 60, 0.09, 'triangle', 0.05 + proximity * 0.08, 0, this.master, 180);
      return;
    }
    const gain = 0.025 + proximity * (0.03 + aim * 0.08);
    if (reading.junk) {
      const f = 330 + aim * 260 + proximity * 80;
      this.tone(f, 0.06, 'square', gain * 0.8);
      this.tone(f * 1.06, 0.05, 'square', gain * 0.4);
    } else {
      const f = 520 + aim * 820 + proximity * 180;
      this.tone(f, aim > 0.7 ? 0.07 : 0.05, aim > 0.5 ? 'triangle' : 'sine', gain);
    }
    if (reading.locked) {
      const f = reading.junk ? 700 : 1760;
      this.tone(f, 0.04, 'triangle', 0.08, now + 0.07);
      this.tone(f * 1.25, 0.05, 'triangle', 0.08, now + 0.13);
    }
  }

  // ── the hunt ────────────────────────────────────────────────────────────

  scrape(i: number): void {
    this.noise(0.1, 0.16 + (i % 2) * 0.05, 600 + i * 120);
  }
  clunk(): void {
    this.tone(160, 0.12, 'square', 0.12);
    this.tone(120, 0.14, 'square', 0.1, (this.ctx?.currentTime ?? 0) + 0.08);
  }
  hop(): void {
    this.tone(420, 0.12, 'square', 0.08, 0, this.master, 820);
  }
  land(): void {
    this.noise(0.05, 0.12, 600);
  }
  sniff(): void {
    this.noise(0.05, 0.08, 2400);
    this.noise(0.05, 0.08, 2400);
  }
  curio(bubble: string): void {
    if (bubble === '!') this.arpeggio([76, 83], 0.06, 'square', 0.1, 0.1);
    else if (bubble === '♥') this.arpeggio([72, 76, 79], 0.08, 'triangle', 0.1, 0.18);
    else if (bubble === '♪') this.arpeggio([79, 84], 0.09, 'triangle', 0.1, 0.16);
    else this.arpeggio([69, 74], 0.1, 'triangle', 0.08, 0.15);
  }
  /** The click under a paw that means "you have about half a second". */
  click(): void {
    this.tone(1400, 0.025, 'square', 0.16);
    this.tone(900, 0.03, 'square', 0.12, (this.ctx?.currentTime ?? 0) + 0.03);
  }
  whoosh(): void {
    this.noise(0.25, 0.2, 3000);
    this.tone(1200, 0.2, 'sawtooth', 0.04, 0, this.master, 400);
  }
  trickle(): void {
    this.noise(0.4, 0.08, 1800);
  }
  rumble(): void {
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) this.tone(48 + i * 3, 0.5, 'sawtooth', 0.12, this.ctx.currentTime + i * 0.25);
    this.noise(1.2, 0.2, 180);
  }
  roll(): void {
    this.noise(0.18, 0.14, 220);
    this.tone(55, 0.18, 'triangle', 0.12);
  }
  crash(): void {
    this.noise(0.8, 0.45, 500);
    this.tone(70, 0.6, 'sawtooth', 0.14, 0, this.master, 35);
  }
  splat(): void {
    this.tone(300, 0.2, 'square', 0.16, 0, this.master, 80);
    this.noise(0.15, 0.2, 800);
  }
  crumble(): void {
    this.noise(0.3, 0.22, 700);
  }
  creak(): void {
    this.tone(180, 0.12, 'sawtooth', 0.05, 0, this.master, 140);
  }
  fall(): void {
    this.tone(700, 0.45, 'square', 0.12, 0, this.master, 120);
  }
  spikes(): void {
    this.tone(2200, 0.05, 'sawtooth', 0.08, 0, this.master, 900);
    this.noise(0.08, 0.12, 4000);
  }

  // ── music ───────────────────────────────────────────────────────────────

  music(region: Region | null): void {
    if (region === this.song) return;
    this.song = region;
    this.stepIndex = 0;
    this.steps = region ? compose(SONGS[region]) : [];
    if (this.ctx) {
      if (this.musicBus) {
        // A short dip so region changes cross rather than cut.
        this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        this.musicBus.gain.setTargetAtTime(0.2, this.ctx.currentTime + 0.35, 0.3);
      }
      this.nextStepAt = this.ctx.currentTime + 0.4;
      this.startSequencer();
    }
  }

  private startSequencer(): void {
    if (this.timer || !this.ctx) return;
    this.nextStepAt = Math.max(this.nextStepAt, this.ctx.currentTime + 0.1);
    this.timer = setInterval(() => this.schedule(), 60);
  }

  private schedule(): void {
    if (!this.ctx || !this.song || this.steps.length === 0) return;
    const song = SONGS[this.song];
    const stepLen = 60 / song.bpm / 4;
    while (this.nextStepAt < this.ctx.currentTime + 0.25) {
      const step = this.steps[this.stepIndex % this.steps.length]!;
      const t = this.nextStepAt;
      const bus = this.musicBus;
      if (step.bass !== undefined) {
        this.tone(midi(step.bass), song.style === 'drone' ? stepLen * 14 : stepLen * 3.2, 'triangle', 0.5, t, bus);
      }
      if (step.lead !== undefined) {
        const soft = song.style === 'drone' || song.style === 'dream';
        this.tone(midi(step.lead), soft ? stepLen * 6 : stepLen * 1.8, soft ? 'sine' : 'square', soft ? 0.3 : 0.16, t, bus);
      }
      if (step.arp !== undefined) this.tone(midi(step.arp), stepLen * 0.9, 'square', 0.06, t, bus);
      this.nextStepAt += stepLen;
      this.stepIndex++;
    }
  }
}

export const audio = new AudioEngine();
