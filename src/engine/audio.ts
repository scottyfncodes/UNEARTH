/**
 * All sound is synthesised: no audio files on a static host. iOS requires
 * the AudioContext to be created/resumed inside a real user gesture, so
 * nothing is built until unlock() is called from a tap.
 *
 * Four layers: one-shot effects, the collar's pings (faster and higher the
 * closer CK gets: the game's hot/cold hook), voices for everyone CK meets,
 * and a score that listens to the game (see score.ts). Effects and music
 * run through the region's room, so the crypt rings and the meadow doesn't.
 *
 *   effects ─┬────────────────────────────┐
 *            └─ send ─ room (convolver) ──┤
 *   score layers ─ filter ─ fade ─ duck ─ music volume ─┴─ master ─ out
 */
import type { Region } from '@/game/types';
import type { CollarReading } from '@/game/collar';
import { compose, ROOMS, SONGS, stepLength, type Step } from './score';
import { speaks, syllable, type Voice } from './voices';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const SETTINGS_KEY = 'unearth.audio.v1';
/** The score sits this far under the effects at full music volume. */
const MUSIC_LEVEL = 0.2;

export interface Mood {
  /** 0-1: how close the collar is to something buried. */
  curiosity: number;
  /** 0-1: something is chasing, falling or about to fire. */
  danger: number;
  /** Someone is talking: the score steps back. */
  talking: boolean;
  /** A card or the journal is up: the score sounds like it's in the next room. */
  muffled: boolean;
}

interface Layers {
  base: GainNode;
  perc: GainNode;
  shimmer: GainNode;
  drive: GainNode;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private send: GainNode | null = null;
  private room: ConvolverNode | null = null;
  private musicVol: GainNode | null = null;
  private duck: GainNode | null = null;
  private fade: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private layers: Layers | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private rooms = new Map<string, AudioBuffer>();
  private enabled = true;
  private musicVolume = 0.8;
  private sfxVolume = 1;

  private song: Region | null = null;
  private steps: Step[] = [];
  private stepIndex = 0;
  private nextStepAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Smoothed mood targets, and the levels last sent to the graph. */
  private mood: Mood = { curiosity: 0, danger: 0, talking: false, muffled: false };
  private journalOpen = false;
  private sent = { shimmer: -1, drive: -1, duck: -1, cutoff: -1 };
  private duckedUntil = 0;

  private nextPingAt = 0;

  constructor() {
    try {
      this.enabled = localStorage.getItem('unearth.sound') !== 'off';
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as { music?: number; sfx?: number } | null;
      if (saved && typeof saved.music === 'number') this.musicVolume = clamp01(saved.music);
      if (saved && typeof saved.sfx === 'number') this.sfxVolume = clamp01(saved.sfx);
    } catch {
      // storage unavailable: keep the defaults
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

  getVolumes(): { music: number; sfx: number } {
    return { music: this.musicVolume, sfx: this.sfxVolume };
  }

  setVolumes(v: { music?: number; sfx?: number }): void {
    if (v.music !== undefined) this.musicVolume = clamp01(v.music);
    if (v.sfx !== undefined) this.sfxVolume = clamp01(v.sfx);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ music: this.musicVolume, sfx: this.sfxVolume }));
    } catch {
      // ignore
    }
    if (!this.ctx) return;
    this.musicVol?.gain.setTargetAtTime(MUSIC_LEVEL * this.musicVolume, this.ctx.currentTime, 0.05);
    this.sfx?.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
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
      this.build(this.ctx);
      if (this.song) this.startSequencer();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private build(ctx: AudioContext): void {
    const gain = (value: number, to: AudioNode) => {
      const g = ctx.createGain();
      g.gain.value = value;
      g.connect(to);
      return g;
    };
    this.master = gain(this.enabled ? 0.85 : 0, ctx.destination);
    this.room = ctx.createConvolver();
    this.room.connect(this.master);
    this.send = gain(ROOMS.none[0], this.room);
    this.sfx = gain(this.sfxVolume, this.master);
    this.sfx.connect(this.send);
    this.musicVol = gain(MUSIC_LEVEL * this.musicVolume, this.master);
    this.duck = gain(1, this.musicVol);
    this.fade = gain(1, this.duck);
    // A little of the score goes into the room too, so it sits in the same space.
    const musicSend = gain(0.5, this.send);
    this.fade.connect(musicSend);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.filter.connect(this.fade);
    this.layers = {
      base: gain(1, this.filter),
      perc: gain(0.55, this.filter),
      shimmer: gain(0, this.filter),
      drive: gain(0, this.filter),
    };
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.setRoom(this.song);
  }

  /** A room is a decaying burst of noise: longer and darker the bigger the space. */
  private setRoom(region: Region | null): void {
    if (!this.ctx || !this.room || !this.send) return;
    const key = region ?? 'none';
    const [wet, tail] = ROOMS[key];
    let ir = this.rooms.get(key);
    if (!ir) {
      const rate = this.ctx.sampleRate;
      const n = Math.ceil(rate * tail);
      ir = this.ctx.createBuffer(2, n, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < n; i++) {
          // Smoothed noise rolls the highs off, the way stone swallows them.
          lp += ((Math.random() * 2 - 1) - lp) * 0.35;
          d[i] = lp * Math.pow(1 - i / n, 3);
        }
      }
      this.rooms.set(key, ir);
    }
    this.room.buffer = ir;
    this.send.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.2);
  }

  // ── primitives ──────────────────────────────────────────────────────────

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    gainPeak = 0.22,
    at = 0,
    dest: AudioNode | null = this.sfx,
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

  private noise(
    duration: number,
    gainPeak: number,
    cutoff = 1200,
    at = 0,
    dest: AudioNode | null = this.sfx,
    type: BiquadFilterType = 'lowpass',
  ): void {
    if (!this.ctx || !dest || !this.noiseBuf) return;
    const t0 = Math.max(this.ctx.currentTime, at || this.ctx.currentTime);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, t0);
    gain.gain.linearRampToValueAtTime(0, t0 + duration);
    src.connect(filter).connect(gain).connect(dest);
    // Start somewhere random in the buffer so no two hits are the same grain.
    src.start(t0, Math.random() * 0.5, duration + 0.02);
  }

  private arpeggio(notes: number[], gap: number, type: OscillatorType = 'square', gainPeak = 0.16, len = 0.14): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    notes.forEach((n, i) => this.tone(midi(n), len, type, gainPeak, t + i * gap));
  }

  /** Pull the score down under a big moment, then let it back up. */
  private duckFor(seconds: number): void {
    if (!this.ctx) return;
    this.duckedUntil = Math.max(this.duckedUntil, this.ctx.currentTime + seconds);
    this.applyMood();
    setTimeout(() => this.applyMood(), seconds * 1000 + 30);
  }

  // ── voices ──────────────────────────────────────────────────────────────

  /** One syllable of someone talking. */
  syllable(voice: Voice, ch: string, progress: number, question: boolean): void {
    const { freq, len } = syllable(voice, ch, progress, question);
    this.tone(freq, len, voice.wave, voice.gain, 0, this.sfx, voice.slide === 1 ? undefined : freq * voice.slide);
  }

  /** A line said all at once (reduced motion): a short signature instead of every syllable. */
  murmur(voice: Voice, line: string): void {
    if (!this.ctx) return;
    const letters = line.replace(/[^a-z0-9]/gi, '').slice(0, 6);
    const t = this.ctx.currentTime;
    [...letters].forEach((ch, i) => {
      if (!speaks(ch, i)) return;
      const { freq, len } = syllable(voice, ch, i / 6, line.trim().endsWith('?'));
      this.tone(freq, len, voice.wave, voice.gain, t + i / voice.cps);
    });
  }

  // ── effects ─────────────────────────────────────────────────────────────

  bump(): void {
    this.tone(110, 0.06, 'square', 0.1);
  }
  /** A footfall that sounds like the ground it lands on. */
  step(region: Region | null = null): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const v = 0.85 + Math.random() * 0.3;
    switch (region) {
      case 'meadow':
        // Grass: a soft brush, no knock at all.
        this.noise(0.05, 0.05 * v, 1400);
        break;
      case 'home':
        // Floorboards: a tiny hollow tock.
        this.noise(0.03, 0.04 * v, 900);
        this.tone(170 * v, 0.04, 'triangle', 0.035, t);
        break;
      case 'temple':
      case 'crypt':
      case 'vault':
        // Stone: a light, dry tick that the room gives back.
        this.noise(0.025, 0.05 * v, 2600);
        this.tone(1100 * v, 0.018, 'square', 0.012, t);
        this.noise(0.04, 0.012, 1800);
        break;
      default:
        this.noise(0.03, 0.05 * v, 900);
    }
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
    this.duckFor(big ? 2.2 : 1.2);
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
    this.tone(110, 0.4, 'sawtooth', 0.08, 0, this.sfx, 70);
  }
  doorLocked(): void {
    this.tone(140, 0.1, 'square', 0.14);
    this.tone(120, 0.12, 'square', 0.12, (this.ctx?.currentTime ?? 0) + 0.1);
  }
  dart(): void {
    this.tone(1800, 0.12, 'sawtooth', 0.08, 0, this.sfx, 300);
  }
  rock(): void {
    this.noise(0.35, 0.3, 300);
  }
  hurt(): void {
    this.tone(220, 0.25, 'square', 0.18, 0, this.sfx, 90);
  }
  talk(): void {
    this.tone(520 + Math.random() * 80, 0.04, 'square', 0.08);
  }
  ui(): void {
    this.tone(300, 0.05, 'square', 0.08);
  }
  meow(): void {
    this.tone(700, 0.35, 'triangle', 0.14, 0, this.sfx, 480);
  }
  /** The questioning little trill a cat makes when you touch it. */
  mrrp(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(520, 0.09, 'triangle', 0.1, t, this.sfx, 700);
    this.tone(700, 0.14, 'triangle', 0.11, t + 0.08, this.sfx, 940);
  }
  /**
   * A mew into the dark, and the room giving it back: a few fainter, lower
   * copies, further off each time, through the room's own reverb.
   */
  mew(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(760, 0.32, 'triangle', 0.13, t, this.sfx, 520);
    [0.3, 0.58, 0.9].forEach((d, i) => {
      const g = 0.05 / (i + 1);
      this.tone(740 - i * 30, 0.3, 'sine', g, t + d, this.sfx, 500 - i * 20);
    });
    // The loose stones answer with a rattle, a beat after the walls.
    this.noise(0.08, 0.05, 3200, t + 0.42, this.sfx, 'highpass');
  }
  /** Loose stones grinding back up into place. */
  settle(): void {
    this.noise(0.5, 0.14, 380);
    this.tone(70, 0.45, 'triangle', 0.08, 0, this.sfx, 95);
  }
  /** Settling down for a nap: a long yawn sliding down. */
  yawn(): void {
    this.tone(640, 0.55, 'triangle', 0.07, 0, this.sfx, 280);
  }
  /** A purr: a low, soft rumble with no edges. */
  purr(seconds = 1.2): void {
    this.tone(46, seconds, 'sawtooth', 0.035);
    this.tone(92, seconds, 'triangle', 0.025);
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
  collar(reading: CollarReading): void {
    if (!this.ctx || !this.master || !reading.kind || reading.strength <= 0) return;
    const now = this.ctx.currentTime;
    if (now < this.nextPingAt) return;
    const interval = 1.15 - reading.proximity * 0.95;
    this.nextPingAt = now + interval;
    const { aim, proximity } = reading;
    if (reading.kind === 'mechanism') {
      this.tone(260 - proximity * 60, 0.09, 'triangle', 0.05 + proximity * 0.08, 0, this.sfx, 180);
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
    this.tone(420, 0.12, 'square', 0.08, 0, this.sfx, 820);
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
    this.tone(1200, 0.2, 'sawtooth', 0.04, 0, this.sfx, 400);
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
    this.tone(70, 0.6, 'sawtooth', 0.14, 0, this.sfx, 35);
  }
  splat(): void {
    this.tone(300, 0.2, 'square', 0.16, 0, this.sfx, 80);
    this.noise(0.15, 0.2, 800);
  }
  crumble(): void {
    this.noise(0.3, 0.22, 700);
  }
  creak(): void {
    this.tone(180, 0.12, 'sawtooth', 0.05, 0, this.sfx, 140);
  }
  fall(): void {
    this.tone(700, 0.45, 'square', 0.12, 0, this.sfx, 120);
  }
  spikes(): void {
    this.tone(2200, 0.05, 'sawtooth', 0.08, 0, this.sfx, 900);
    this.noise(0.08, 0.12, 4000);
  }

  // ── music ───────────────────────────────────────────────────────────────

  music(region: Region | null): void {
    if (region === this.song) return;
    this.song = region;
    this.stepIndex = 0;
    this.steps = region ? compose(SONGS[region]) : [];
    if (this.ctx) {
      this.setRoom(region);
      if (this.fade) {
        // A short dip so region changes cross rather than cut.
        this.fade.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        this.fade.gain.setTargetAtTime(1, this.ctx.currentTime + 0.35, 0.3);
      }
      this.nextStepAt = this.ctx.currentTime + 0.4;
      this.startSequencer();
    }
  }

  /** Called every frame with what's happening; the score follows it smoothly. */
  setMood(mood: Mood): void {
    this.mood = mood;
    this.applyMood();
  }

  setJournalOpen(open: boolean): void {
    this.journalOpen = open;
    this.applyMood();
  }

  private applyMood(): void {
    if (!this.ctx || !this.layers || !this.duck || !this.filter) return;
    const now = this.ctx.currentTime;
    const m = this.mood;
    // Quantised, so a per-frame call only touches the graph when something moved.
    const q = (v: number) => Math.round(v * 20) / 20;
    const danger = q(m.danger);
    const shimmer = q(Math.max(0, m.curiosity - 0.15) * (1 - danger)) * 0.9;
    const duck = now < this.duckedUntil ? 0.25 : m.talking ? 0.5 : 1;
    const cutoff = m.muffled || this.journalOpen ? 900 : 18000;
    const set = (key: 'shimmer' | 'drive' | 'duck' | 'cutoff', param: AudioParam, value: number, tc: number) => {
      if (this.sent[key] === value) return;
      this.sent[key] = value;
      param.setTargetAtTime(value, now, tc);
    };
    set('shimmer', this.layers.shimmer.gain, shimmer, 0.4);
    set('drive', this.layers.drive.gain, danger, danger > this.sent.drive ? 0.08 : 0.8);
    set('duck', this.duck.gain, duck, 0.12);
    set('cutoff', this.filter.frequency, cutoff, 0.15);
  }

  private startSequencer(): void {
    if (this.timer || !this.ctx) return;
    this.nextStepAt = Math.max(this.nextStepAt, this.ctx.currentTime + 0.1);
    this.timer = setInterval(() => this.schedule(), 60);
  }

  private schedule(): void {
    if (!this.ctx || !this.song || this.steps.length === 0 || !this.layers) return;
    const song = SONGS[this.song];
    const stepLen = stepLength(song);
    const { base, perc, shimmer, drive } = this.layers;
    const style = song.style;
    const soft = style === 'drone' || style === 'dream';
    // Layers that are silent and staying silent cost nothing.
    const shimmerOn = this.sent.shimmer > 0.02;
    const driveOn = this.sent.drive > 0.02;
    while (this.nextStepAt < this.ctx.currentTime + 0.25) {
      const step = this.steps[this.stepIndex % this.steps.length]!;
      const t = this.nextStepAt;
      if (step.bass !== undefined) {
        this.tone(midi(step.bass), style === 'drone' ? stepLen * 14 : stepLen * 3.2, 'triangle', 0.5, t, base);
      }
      if (step.lead !== undefined) {
        this.tone(midi(step.lead), soft ? stepLen * 6 : stepLen * 1.8, soft ? 'sine' : 'square', soft ? 0.3 : 0.16, t, base);
      }
      if (step.arp !== undefined) this.tone(midi(step.arp), stepLen * 0.9, 'square', 0.06, t, base);
      if (step.counter !== undefined) this.tone(midi(step.counter), stepLen * 14, 'sine', 0.14, t, base);
      if (step.kick) {
        const low = style === 'drone' ? 70 : 140;
        this.tone(low, 0.14, 'sine', style === 'drone' ? 0.45 : 0.6, t, perc, 42);
      }
      if (step.hat) this.noise(0.03, style === 'dream' ? 0.08 : 0.12, 7000, t, perc, 'highpass');
      if (step.snare) this.noise(0.09, 0.22, 2400, t, perc, 'bandpass');
      if (shimmerOn && step.shimmer !== undefined) this.tone(midi(step.shimmer), stepLen * 2.5, 'sine', 0.12, t, shimmer);
      if (driveOn) {
        if (step.driveBass !== undefined) this.tone(midi(step.driveBass), stepLen * 0.8, 'square', 0.16, t, drive);
        if (step.driveSnare) this.noise(0.08, 0.3, 2000, t, drive, 'bandpass');
        if (this.stepIndex % 4 === 0) this.tone(130, 0.12, 'sine', 0.6, t, drive, 40);
      }
      this.nextStepAt += stepLen;
      this.stepIndex++;
    }
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export const audio = new AudioEngine();
