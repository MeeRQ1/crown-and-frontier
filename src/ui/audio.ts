// Procedural sound effects (Web Audio). Nothing plays until the player has
// interacted with the page; all sounds are synthesised, so no audio assets are
// downloaded.

type Cue = 'click' | 'battle' | 'victory' | 'defeat' | 'event' | 'build' | 'war' | 'peace' | 'alert';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume = 0.6;

  /** Call from a user gesture. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + start;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(start: number, dur: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + start;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  play(cue: Cue): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    switch (cue) {
      case 'click':
        this.tone(660, 0, 0.05, 'triangle', 0.08);
        break;
      case 'build':
        this.tone(520, 0, 0.08, 'triangle', 0.1);
        this.tone(780, 0.06, 0.1, 'triangle', 0.08);
        break;
      case 'battle':
        this.noise(0, 0.25, 0.5);
        this.tone(90, 0, 0.3, 'sine', 0.25);
        this.noise(0.18, 0.2, 0.35);
        break;
      case 'war':
        this.tone(110, 0, 0.5, 'sawtooth', 0.08);
        this.tone(82, 0.25, 0.6, 'sawtooth', 0.08);
        this.noise(0, 0.3, 0.3);
        break;
      case 'peace':
        this.tone(523, 0, 0.3, 'sine', 0.12);
        this.tone(659, 0.12, 0.3, 'sine', 0.1);
        this.tone(784, 0.24, 0.5, 'sine', 0.1);
        break;
      case 'event':
        this.tone(880, 0, 0.4, 'sine', 0.1);
        this.tone(1320, 0.02, 0.5, 'sine', 0.05);
        break;
      case 'alert':
        this.tone(440, 0, 0.12, 'square', 0.05);
        this.tone(330, 0.13, 0.18, 'square', 0.05);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.16, 0.5, 'triangle', 0.12));
        break;
      case 'defeat':
        [392, 330, 262].forEach((f, i) => this.tone(f, i * 0.25, 0.6, 'sine', 0.12));
        break;
    }
  }
}
