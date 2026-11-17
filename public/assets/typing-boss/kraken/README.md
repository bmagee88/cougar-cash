# Kraken attack artwork

Generated with the built-in `image_gen` tool using the cleaned Kraken as the identity/style reference. The complete prompt set is in [prompts.json](prompts.json). Each PNG master contains separate drawn poses, in row-major order, with genuine alpha transparency.

| Attack | Frames | Runtime atlas | Playback | Hit |
| --- | ---: | --- | ---: | ---: |
| Tentacle Slam | 6 | `slam.webp` | 1.05 s | 0.60 s |
| Multi-tentacle Assault | 12 | `multi-tentacle.webp` | 1.50 s | 0.90 s |
| Tidal Wave | 20 | `wave.webp` | 2.20 s | 1.30 s |
| Ink Hex | 20 | `special.webp` | 1.60 s | Cast, followed by the regular attack |

The assault replaces the old Sweep presentation. Several tentacles uncoil and lash at different heights. Wave and Hex include anticipation, build-up, peak and recovery poses. Hex lights up the suckers and forehead rune and raises a spiral symbol.

Run `node scripts/prepare-typing-boss-kraken.cjs` from the repository root to mechanically slice the four `*-source.png` masters, register the resting tentacles, and pack lossless WebP atlases. Artwork is not painted or synthesized by the packing script. Runtime cells are 384 × 216, with shared padding/scale across actions. `manifest.json` records frame geometry, hashes and source measurements.

Shared frame counts, durations and impact timings live in `src/TypingBoss/krakenAnimationRules.js`. Runtime playback uses CSS discrete frame steps and a server timestamp; health updates do not restart it. Late image loads catch up to the existing event. Quiet player overviews show the resting pose. Host/classroom views and relevant personal opponent profiles play the attacks. Reduced-motion mode holds the impact pose.

Ink Hex plays before the attack it accompanies. The server queues overlapping Kraken attacks, and a Tidal Wave finishes all twenty frames before queued strong reactions. Damage and defense amounts are unchanged.

Development preview: `/typing-boss/kraken-preview`. Choose any attack, replay it, or inspect every individual frame.
