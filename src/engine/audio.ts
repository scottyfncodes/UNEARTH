/**
 * All sound is synthesised — no audio files to fetch on a GitHub Pages
 * static host. iOS requires the AudioContext to be created/resumed inside a
 * real user gesture, so nothing is built until unlock() is called from a tap.
 */
export type SignalKind = 'buried' | 'mechanism' | null;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private detectorOsc: OscillatorNode | null = null;
  private detectorGain: GainNode | null = null;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.85 : 0;
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
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private beep(freq: number, duration: number, type: OscillatorType = 'square', gainPeak = 0.22): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  bump(): void {
    this.beep(120, 0.07, 'square', 0.15);
  }

  push(): void {
    this.beep(160, 0.09, 'square', 0.16);
  }

  pickup(): void {
    this.beep(660, 0.09, 'square');
    setTimeout(() => this.beep(880, 0.12, 'square'), 70);
  }

  clue(): void {
    this.beep(520, 0.14, 'triangle', 0.18);
  }

  assemble(): void {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.16, 'triangle', 0.2), i * 80));
  }

  doorOpen(): void {
    this.beep(220, 0.2, 'sawtooth', 0.14);
  }

  doorLocked(): void {
    this.beep(140, 0.12, 'square', 0.16);
  }

  trapHit(): void {
    this.beep(90, 0.28, 'sawtooth', 0.26);
  }

  dig(): void {
    this.beep(200, 0.08, 'square', 0.14);
  }

  talk(): void {
    this.beep(440, 0.05, 'square', 0.12);
  }

  ui(): void {
    this.beep(300, 0.05, 'square', 0.1);
  }

  /** Continuous detector hum — 0 strength silences it. */
  setDetector(strength: number, kind: SignalKind): void {
    if (!this.ctx || !this.master) return;
    if (strength <= 0 || !kind) {
      if (this.detectorGain) {
        this.detectorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
      return;
    }
    if (!this.detectorOsc) {
      this.detectorOsc = this.ctx.createOscillator();
      this.detectorGain = this.ctx.createGain();
      this.detectorOsc.type = 'sine';
      this.detectorGain.gain.value = 0;
      this.detectorOsc.connect(this.detectorGain);
      this.detectorGain.connect(this.master);
      this.detectorOsc.start();
    }
    const baseFreq = kind === 'mechanism' ? 220 : 440;
    this.detectorOsc.frequency.setTargetAtTime(baseFreq + strength * 260, this.ctx.currentTime, 0.05);
    this.detectorGain!.gain.setTargetAtTime(0.05 + strength * 0.16, this.ctx.currentTime, 0.05);
  }
}

export const audio = new AudioEngine();
