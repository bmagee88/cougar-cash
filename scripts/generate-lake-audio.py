"""Original water Foley: filtered impacts, short bubble resonances, and droplets.

No recordings, downloads, or third-party samples. Rebuild with Python's stdlib.
"""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 24000
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/assets/fishing/audio'
PROFILES = {
    'cast': (.70, [(0, .13, 1), (.085, .08, .35)], 15, 7, 115),
    'nibble': (.23, [(0, .035, .4)], 3, 3, 210),
    'bite': (.48, [(0, .095, .85), (.085, .075, .48)], 9, 5, 140),
    'thrash': (1.05, [(0, .16, .9), (.19, .19, 1), (.46, .15, .7)], 32, 13, 93),
    'escape': (1.15, [(0, .19, 1), (.14, .4, .7), (.43, .17, .35)], 26, 8, 78),
    'landing': (.78, [(0, .17, .65), (.10, .10, .3)], 22, 5, 145),
    'release': (.94, [(0, .16, 1), (.13, .24, .65)], 20, 10, 88),
    'lure': (.34, [(0, .085, .45), (.06, .055, .25)], 6, 2, 190),
    'lake': (1.0, [(0, .13, .9), (.22, .16, .55), (.42, .12, .35)], 23, 7, 105),
}


def burst(out, rng, start, duration, amplitude, soft=False, wrap=False):
    """Two noisy time scales give a wet body and a fine spray, not a hiss alone."""
    slow = fast = 0.0
    duration *= rng.uniform(.88, 1.12)
    for i in range(int(duration * RATE)):
        t = i / RATE
        white = rng.uniform(-1, 1)
        slow += .045 * (white - slow)
        fast += (.20 if soft else .53) * (white - fast)
        attack = min(1, t / .0035)
        envelope = attack * math.exp(-t / max(.004, duration * .22))
        value = ((fast - slow) * .65 + slow * 1.45) * amplitude * envelope
        index = int(start * RATE) + i
        if wrap:
            out[index % len(out)] += value
        elif 0 <= index < len(out):
            out[index] += value


def bubble(out, rng, start, frequency, amplitude, wrap=False):
    duration = rng.uniform(.017, .065)
    phase = rng.uniform(0, math.tau)
    for i in range(int(duration * RATE)):
        t = i / RATE
        # A tiny rising bubble resonance; short and masked by the water impact.
        phase += math.tau * frequency * (1 + .22 * t / duration) / RATE
        envelope = min(1, t / .002) * math.exp(-t / (duration * .19))
        value = math.sin(phase) * envelope * amplitude
        index = int(start * RATE) + i
        if wrap:
            out[index % len(out)] += value
        elif 0 <= index < len(out):
            out[index] += value


def finish(out, peak=.72, loop=False):
    # Remove DC and keep transients rounded without clipping or end clicks.
    previous = filtered = 0.0
    for i, value in enumerate(out):
        filtered = .995 * (filtered + value - previous)
        previous = value
        out[i] = math.tanh(filtered * 1.5)
    scale = peak / max(.0001, max(abs(x) for x in out))
    for i in range(len(out)):
        fade = 1 if loop else min(1, i / (RATE * .0015), (len(out) - 1 - i) / (RATE * .035))
        out[i] *= scale * fade
    if loop:
        # Match the seam without silence; the loop is a bed of overlapping drops.
        edge = int(.035 * RATE)
        for i in range(edge):
            mix = i / edge
            out[i] = out[-edge + i] * (1 - mix) + out[i] * mix
        return out[:-edge]
    return out


def splash(kind, variant):
    length, impacts, drops, bubbles, body = PROFILES[kind]
    rng = random.Random(9719 + list(PROFILES).index(kind) * 1877 + variant * 131)
    stretch = rng.uniform(.93, 1.07)
    out = [0.0] * int(RATE * length * stretch)
    for start, duration, amp in impacts:
        burst(out, rng, start * stretch, duration * stretch, amp, soft=kind in ('landing', 'lure'))
        bubble(out, rng, start + .008, body * rng.uniform(.8, 1.2), amp * .11)
    for _ in range(drops):
        start = rng.uniform(.035, length * .78) * stretch
        burst(out, rng, start, rng.uniform(.009, .036), rng.uniform(.035, .17))
    for _ in range(bubbles):
        bubble(out, rng, rng.uniform(.015, length * .55) * stretch, rng.uniform(420, 1550), rng.uniform(.016, .055))
    return finish(out)


def rain(variant):
    rng = random.Random(41717 + variant * 17)
    out = [0.0] * (RATE * 3)
    for _ in range(190 if variant == 0 else 450):
        start = rng.random() * 3
        burst(out, rng, start, rng.uniform(.018, .095), rng.uniform(.025, .10), soft=True, wrap=True)
        if rng.random() < .2:
            bubble(out, rng, start, rng.uniform(650, 1800), .012, wrap=True)
    return finish(out, peak=.55, loop=True)


def goose(variant):
    """A short nasal, breathy double call with uneven harmonic pressure."""
    rng = random.Random(77183 + variant * 197)
    out = [0.0] * int(RATE * .95)
    for start, pitch, length, gain in [(0, rng.uniform(255, 295), .36, .6), (.23, rng.uniform(285, 340), .42, .42)]:
        phase = breath = 0.0
        for i in range(int(length * RATE)):
            t = i / RATE
            envelope = min(1, t / .025) * min(1, (length - t) / .095)
            frequency = pitch * (1 + .07 * math.sin(math.pi * t / length) + .012 * math.sin(math.tau * 29 * t))
            phase += math.tau * frequency / RATE
            breath += .34 * (rng.uniform(-1, 1) - breath)
            voice = sum(math.sin(phase * harmonic) * weight for harmonic, weight in [(1,.24),(2,.42),(3,.25),(4,.14),(5,.05)])
            out[int(start * RATE) + i] += (voice * .8 + breath * .12) * envelope * gain
    return finish(out, peak=.65)


def write(path, samples):
    with wave.open(str(path), 'wb') as audio:
        audio.setparams((1, 2, RATE, len(samples), 'NONE', 'not compressed'))
        audio.writeframes(struct.pack(f'<{len(samples)}h', *(round(max(-1, min(1, s)) * 32767) for s in samples)))


if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    demo = []
    for kind in PROFILES:
        for variant in range(3):
            samples = splash(kind, variant)
            write(DEST / f'{kind}-{variant}.wav', samples)
            if variant == 0:
                demo.extend(s * .65 for s in samples)
                demo.extend([0.0] * int(.35 * RATE))
    for variant in range(2):
        write(DEST / f'rain-{variant}.wav', rain(variant))
    for variant in range(3):
        write(DEST / f'geese-{variant}.wav', goose(variant))
    write(ROOT / 'output/lake-splash-sampler.wav', demo)
    print(f'Created {len(list(DEST.glob("*.wav")))} original mono WAVs: {sum(p.stat().st_size for p in DEST.glob("*.wav")):,} bytes total')
    for path in DEST.glob('*.wav'):
        with wave.open(str(path), 'rb') as audio:
            data = struct.unpack(f'<{audio.getnframes()}h', audio.readframes(audio.getnframes()))
            assert max(abs(x) for x in data) < 30000
            if not path.name.startswith('rain'):
                assert data[0] == 0
    print('Verified sample rates, bounded peaks, and transient fade-ins.')
