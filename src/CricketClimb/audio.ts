// All effects are synthesized locally. No audio files, accounts, or requests are needed.
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
export const CRICKET_CHIRP_DURATION = 840;

export class GardenAudio {
  private context: AudioContext | null = null;
  enabled = true;

  unlock() {
    try {
      const Constructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!this.context && Constructor) this.context = new Constructor();
      if (this.context?.state === "suspended") void this.context.resume().catch(() => {});
    } catch { /* The game remains playable when audio is unavailable. */ }
  }

  private tone(frequency: number, at: number, length: number, volume = .045, endFrequency?: number, type: OscillatorType = "sine") {
    if (!this.enabled || !this.context || this.context.state !== "running") return;
    const context = this.context, oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime + at;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + length);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + .009);
    gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + length + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  jump() { this.tone(340, 0, .23, .045, 760); }
  superJump() {
    this.tone(95, 0, .65, .055, 1500, "triangle");
    this.tone(180, .04, .8, .027, 2300);
    [880, 1175, 1568].forEach((note, i) => this.tone(note, .5 + i * .09, .19, .018));
  }
  suspense() { this.tone(235, 0, .08, .022, 190, "triangle"); }
  fall() { this.tone(660, 0, .55, .038, 140, "triangle"); }
  land() { this.tone(180, 0, .12, .045, 85); this.tone(400, .1, .18, .02); }
  correct() { [523, 659, 784].forEach((note, i) => this.tone(note, i * .09, .24, .035)); }
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((note, i) => this.tone(note, i * .15, .35, .045, undefined, "triangle")); }
  cricket() {
    for (let chirp = 0; chirp < 3; chirp++) {
      for (let pulse = 0; pulse < 4; pulse++) this.tone(3900, chirp * .28 + pulse * .037, .029, .018, 4400);
    }
  }
  close() { if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {}); }
}

const abortError = () => new DOMException("Cancelled", "AbortError");

export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const done = () => { signal.removeEventListener("abort", abort); resolve(); };
    const timer = window.setTimeout(done, ms);
    const abort = () => { window.clearTimeout(timer); reject(abortError()); };
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function speak(text: string, signal?: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window) || signal?.aborted) { resolve(false); return; }
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US"; utterance.rate = .82; utterance.pitch = 1.13; utterance.volume = .9;
    const voices = synthesis.getVoices();
    utterance.voice = voices.find(voice => voice.lang === "en-US" && voice.localService) || voices.find(voice => voice.lang.startsWith("en")) || null;
    let finished = false;
    const finish = (success: boolean) => {
      if (finished) return;
      finished = true; window.clearInterval(watchdog); signal?.removeEventListener("abort", abort); resolve(success);
    };
    const abort = () => { synthesis.cancel(); finish(false); };
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    // Some browsers omit onend. Never release answers while the voice is still speaking.
    const started = Date.now();
    const watchdog = window.setInterval(() => {
      if (Date.now() - started > Math.max(6000, text.length * 95) && !synthesis.speaking && !synthesis.pending) finish(false);
    }, 500);
    signal?.addEventListener("abort", abort, { once: true });
    try { synthesis.speak(utterance); } catch { finish(false); }
  });
}
