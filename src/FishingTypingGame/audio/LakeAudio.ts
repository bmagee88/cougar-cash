import { ASSET_BASE } from '../engine/artwork';
import { clampUnit, readSoundVolume, soundVariation, WaterSound, WaterSoundOptions, WATER_SOUNDS } from './sounds';

type Voice = { kind: WaterSound | 'rain'; source: AudioBufferSourceNode; gain: GainNode; pan?: StereoPannerNode };
type Request = { controller: AbortController; promise: Promise<AudioBuffer | undefined> };
export const MAX_SPLASH_VOICES = 6, MAX_SOUND_BUFFERS = 10;

/** One user-unlocked context, bounded decoded assets, and short-lived voices.
 * Nothing is loaded while muted; hiding the lake drops pending sounds and buffers. */
export class LakeAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private compressor?: DynamicsCompressorNode;
  private enabled = false;
  private volume = .55;
  private sceneVisible = true;
  private gesture = false;
  private disposed = false;
  private generation = 0;
  private cache = new Map<string, AudioBuffer>();
  private pending = new Map<string, Request>();
  private voices = new Set<Voice>();
  private lastPlayed = new Map<WaterSound, number>();
  private lastVariant = new Map<WaterSound, number>();
  private rainLevel = 0;
  private rainVoice?: Voice;
  private rainVariant?: number;
  private rainPending?: number;

  constructor(private random = Math.random) {}
  private audible() { return this.enabled && this.volume > 0 && this.sceneVisible && !document.hidden && !this.disposed; }

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled; this.volume = readSoundVolume(volume);
    if (!enabled || this.volume === 0) { this.releaseContext(); return; }
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume * .7, this.context.currentTime, .025);
    if (this.gesture && this.audible()) this.unlock();
  }

  /** Call directly from pointer/key input, including enabling the sound setting. */
  unlock() {
    this.gesture = true;
    if (this.disposed || !this.sceneVisible || document.hidden) return;
    try {
      if (!this.context || this.context.state === 'closed') {
        const Constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Constructor) return;
        const context = new Constructor();
        this.context = context; this.master = context.createGain(); this.compressor = context.createDynamicsCompressor();
        this.master.gain.value = this.enabled ? this.volume * .7 : 0;
        this.compressor.threshold.value = -10; this.compressor.knee.value = 18; this.compressor.ratio.value = 3;
        this.compressor.attack.value = .005; this.compressor.release.value = .15;
        this.master.connect(this.compressor); this.compressor.connect(context.destination);
      }
      const context = this.context;
      if (context.state !== 'running') void context.resume().then(() => this.startRain()).catch(() => {});
      else this.startRain();
    } catch { /* Sound never prevents casting on an unsupported audio device. */ }
  }

  setVisible(visible: boolean) { this.sceneVisible = visible; this.visibilityChanged(); }
  visibilityChanged() {
    if (!this.audible()) {
      this.stopAll(); this.clearAssets();
      if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
    } else if (this.gesture) this.unlock();
  }

  private async load(key: string): Promise<AudioBuffer | undefined> {
    const context = this.context, generation = this.generation;
    if (!context || !this.audible()) return;
    const cached = this.cache.get(key);
    if (cached) { this.cache.delete(key); this.cache.set(key, cached); return cached; }
    const existing = this.pending.get(key);
    if (existing) return existing.promise;
    const controller = new AbortController();
    const request: Request = { controller, promise: Promise.resolve(undefined) };
    request.promise = (async () => {
      try {
        const response = await fetch(`${ASSET_BASE}/audio/${key}.wav`, { signal: controller.signal });
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        if (controller.signal.aborted || generation !== this.generation) return;
        const buffer = await context.decodeAudioData(bytes);
        if (controller.signal.aborted || context !== this.context || generation !== this.generation || !this.audible()) return;
        this.cache.set(key, buffer);
        while (this.cache.size > MAX_SOUND_BUFFERS) this.cache.delete(this.cache.keys().next().value!);
        return buffer;
      } catch { return undefined; }
      finally { if (this.pending.get(key) === request) this.pending.delete(key); }
    })();
    this.pending.set(key, request);
    return request.promise;
  }

  private finish(voice: Voice, stop = false) {
    voice.source.onended = null;
    if (stop) { try { voice.source.stop(); } catch { /* Already ended. */ } }
    voice.source.disconnect(); voice.gain.disconnect(); voice.pan?.disconnect(); voice.source.buffer = null;
    this.voices.delete(voice);
    if (this.rainVoice === voice) { this.rainVoice = undefined; this.rainVariant = undefined; }
  }

  private voice(kind: Voice['kind'], buffer: AudioBuffer, gain: number, pitch: number, pan = 0) {
    const context = this.context;
    if (!context || !this.master || !this.audible() || context.state !== 'running') return;
    const source = context.createBufferSource(), level = context.createGain();
    const stereo = context.createStereoPanner?.();
    source.buffer = buffer; source.playbackRate.value = pitch; level.gain.value = gain;
    source.connect(level);
    if (stereo) { stereo.pan.value = Math.max(-1, Math.min(1, pan)); level.connect(stereo); stereo.connect(this.master); }
    else level.connect(this.master);
    const voice = { kind, source, gain: level, pan: stereo };
    this.voices.add(voice); source.onended = () => this.finish(voice);
    return voice;
  }

  async play(kind: WaterSound, options: WaterSoundOptions = {}, preview = false) {
    if (!this.gesture || !this.audible() || !this.context) return;
    const now = Date.now(), last = this.lastPlayed.get(kind);
    if (!preview && last !== undefined && now - last < WATER_SOUNDS[kind].cooldown) return;
    this.lastPlayed.set(kind, now);
    const variation = soundVariation(this.random, this.lastVariant.get(kind), options.weightKg);
    this.lastVariant.set(kind, variation.variant);
    const generation = this.generation;
    const buffer = await this.load(`${kind}-${variation.variant}`);
    // A late decode must never replay an old bite or splash after a tab resumes.
    if (!buffer || generation !== this.generation || Date.now() - now > (preview ? 3000 : 650) || !this.audible()) return;
    const sfx = Array.from(this.voices).filter(voice => voice.kind !== 'rain');
    if (sfx.length >= MAX_SPLASH_VOICES) {
      if (kind === 'lake' || kind === 'lure' || kind === 'geese') return;
      this.finish(sfx.find(voice => voice.kind === 'lake' || voice.kind === 'lure' || voice.kind === 'geese') || sfx[0], true);
    }
    const distance = .12 + .88 * (1 - clampUnit(options.depth ?? 0)) ** 1.5;
    const gain = WATER_SOUNDS[kind].gain * distance * clampUnit(options.volume ?? 1);
    const voice = this.voice(kind, buffer, gain, variation.pitch, options.pan);
    if (voice) { voice.source.start(); return true; }
    return false;
  }

  async preview(kind: WaterSound) {
    if (!this.audible()) return false;
    this.unlock(); return (await this.play(kind, { volume: .85 }, true)) === true;
  }
  setRain(level: number) {
    this.rainLevel = clampUnit(level);
    if (this.rainLevel <= .02) { this.stopRain(); return; }
    const variant = this.rainLevel > .65 ? 1 : 0;
    if (this.rainVoice && this.rainVariant === variant && this.context) this.rainVoice.gain.gain.setTargetAtTime(.28 * this.rainLevel, this.context.currentTime, .4);
    else this.startRain();
  }

  private startRain() {
    if (!this.gesture || !this.audible() || !this.context || this.context.state !== 'running' || this.rainLevel <= .02) return;
    const variant = this.rainLevel > .65 ? 1 : 0;
    if (this.rainVariant === variant || this.rainPending === variant) return;
    this.rainPending = variant;
    const generation = this.generation;
    void this.load(`rain-${variant}`).then(buffer => {
      if (this.rainPending === variant) this.rainPending = undefined;
      if (!buffer || generation !== this.generation || !this.audible() || this.rainLevel <= .02 || (this.rainLevel > .65 ? 1 : 0) !== variant) return;
      this.stopRain();
      const voice = this.voice('rain', buffer, 0, .985 + this.random() * .03);
      if (!voice || !this.context) return;
      voice.source.loop = true; this.rainVoice = voice; this.rainVariant = variant;
      voice.gain.gain.setTargetAtTime(.28 * this.rainLevel, this.context.currentTime, .4); voice.source.start();
    });
  }

  private stopRain() {
    this.rainPending = undefined;
    const voice = this.rainVoice;
    this.rainVoice = undefined; this.rainVariant = undefined;
    if (!voice || !this.context) return;
    voice.gain.gain.setTargetAtTime(0, this.context.currentTime, .06);
    try { voice.source.stop(this.context.currentTime + .25); } catch { this.finish(voice); }
  }
  private stopAll() { Array.from(this.voices).forEach(voice => this.finish(voice, true)); this.rainVoice = undefined; this.rainVariant = undefined; this.rainPending = undefined; }
  private clearAssets() { this.generation++; this.pending.forEach(request => request.controller.abort()); this.pending.clear(); this.cache.clear(); this.lastPlayed.clear(); }
  private releaseContext() {
    this.stopAll(); this.clearAssets(); this.master?.disconnect(); this.compressor?.disconnect();
    const context = this.context; this.context = undefined; this.master = undefined; this.compressor = undefined;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
  dispose() { this.disposed = true; this.releaseContext(); }
}
