# Stillwater lake sounds

Original procedural Foley generated with `python scripts/generate-lake-audio.py`.
No recordings, outside samples, or licensing dependencies are used.

Nine distinct families each have three alternate takes: cast, nibble, bite,
thrash, escape, landing, release, lure, and lake. Two seamless rain-on-water beds
cover light and heavy rain. Three nasal, harmonic double calls accompany passing
Canada geese. All 32 files are mono 24 kHz, 16-bit PCM WAVs, about
1.38 MB combined. `output/lake-splash-sampler.wav` previews one of each family in
that order, with short silences between them.

Each impact combines filtered water noise, a low wet transient, tiny damped bubble
resonances and randomly scattered droplets. Alternate takes have different timing
and droplet patterns. Runtime playback selects a different take each time and adds
about +/- half a semitone of pitch variation. Fish weight lowers the body pitch
slightly. Lake depth attenuates volume; horizontal position controls stereo pan.

Audio is optional in Settings > Lake sounds, with a saved volume and a preview
selector. The preexisting mute preference is preserved. A user gesture unlocks
one AudioContext. WAVs load/decode only when needed, with at most ten decoded
buffers and six simultaneous effect voices plus the quiet rain bed. Ended voices
disconnect, hidden/offscreen scenes stop audio and release pending downloads and
decoded buffers, and muting or leaving the game closes the context. Visual render
intervals and reduced motion do not change the gameplay audio timing.

Goose calls use the same opt-in sound and volume settings. They pan with the
flock and fade with projected distance; near birds are louder than distant birds.
Calls stop and unload with the flock when hidden, offscreen, or after departure.
Ambient calls cannot displace gameplay splash cues at the voice limit.
