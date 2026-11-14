# Typing Boss performance and integrity findings

**Update:** The protections investigated below have now been implemented. See [current integrity behavior and limitations](INTEGRITY.md). The original implementation summary and investigation tables below describe the pre-fix state; their input gate, private-token, issued-window and arrival-credit recommendations are now implemented. Well-paced automation remains an explicit limitation.

## Changes implemented

- Pure progress and word completions without active ability changes share a 400 ms room flush. Combat releases, hits and activations preempt cosmetics and retain a 100 ms flush. Own typing feedback stays local and immediate; remote bars interpolate between updates. This reduces cosmetic broadcasts to at most 2.5 per second, independent of roster size. Combat-heavy periods can still reach ten broadcasts per second.
- Each flush builds one public snapshot rather than rebuilding the roster, projectiles and dragon profile for every subscriber. Only the subscriber's own typing state is attached afterward. Host tokens and other actors' private seeds/timings are excluded.
- Nested profile and timing values compare by content. Rebuilding an identical dragon profile no longer sends it or replaces it on every client.
- Formation coordinates depend on roster membership/order, not HP or charge. HP/charge patches reuse point objects and layout observers. Resize, scroll and actual formation changes still remeasure projectile endpoints.
- More than ten students disables continuous idle sprite loops in the shared scene. Attacks, reactions and personal portraits retain animation.
- Errors never subtract earned ATK or drain color banks. Incorrect letters earn nothing; perfect-word bonuses still require correctness. Rhythm never falls below 1x. No new punitive mash detector, cooldown or input gate has been installed.

These changes reduce scheduling, snapshot and layout work. They are not a claim of measured Chromebook FPS or a guaranteed percentage bandwidth reduction. Server unit checks cover scheduling/preemption and duplicate profile suppression. Rendering tests cover geometry reuse. The isolated 31-client verifier checks shared progress, omitted profiles, delivery, private typing state, retries and reconnects.

## Ways to exploit or mash the current system

| Route | What the code currently permits or prevents | Suggested response without damage deductions |
| --- | --- | --- |
| Repeating one key / sweeping the keyboard | Input advances by position even when wrong. An imperfect word can advance the word cursor. Accidental matches, and required spaces outside scheduled Balanced, can still earn power. | Prefer correct-to-advance input: a wrong key leaves the cursor in place; the matching letter earns its normal power once. Preserve already earned charge. This needs coordinated client/server input rules and explicit handling of typo recovery. |
| Skipping ordinary words to hunt a bonus | Perfect trigger checks protect the bonus itself, but wrong words can still advance the index. Scheduled triggers depend on correct letters, so misses do not advance that schedule. | Correct-to-advance prevents intentional word skipping. An alternative is re-presenting an unfinished word without charging a damage debt. |
| Holding a key / pasting / dropping text | Normal UI rejects auto-repeat, paste and drop, and cannot erase mistakes with Backspace. These are browser conveniences, not a security boundary. | Keep them, but validate completion on the server. Do not use browser event trust as proof of human typing. |
| Macros / developer tools / direct requests | Clients know their seed and expected words. They submit timing gaps; validating aggregates proves mathematical consistency, not that the events occurred. A script can manufacture valid-looking input. | Server-issued short word windows and server-observed arrival budgets raise the effort required. Neither proves a human is typing. Use teacher review and avoid speed-only accusations. |
| Saving up time, then sending a burst | The existing rate check averages character credit over time since battle start and allows a startup allowance. Long inactivity can accumulate enough credit for a burst. | Consider a small server-side token bucket with bounded saved credit and latency allowance. Delay or flag implausible arrivals rather than reducing the damage of valid attacks. Calibrate with real classroom traces before enforcement. |
| Replays / two tabs | Acknowledged indices are ignored; whole batches validate atomically. Re-sending a completed batch does not duplicate damage. Two tabs can still compete over the same actor cursor. | Retain idempotency. A per-player session lease can notify the student when another tab is active. |
| Playing as another student | Authentication currently accepts the player code, while the public roster includes those same codes as actor identifiers. A room participant can therefore obtain another actor's authentication value. | Highest-priority integrity change: issue a separate private participant token; expose only public actor IDs. Apply it to words, progress, snapshots and event streams, with a reconnect migration. This is not fixed by the performance changes. |
| Forged progress | The cursor endpoint can make cosmetic charge appear ahead, but it cannot award damage or mutate earned typing power. Bounds and rate checks already apply. | Keep cosmetic state separate from combat state. Reject invalid cursors without modifying earned power. |

## Detect patterns, not intent

A lightweight teacher-only signal can use the word records the server already receives; no per-key broadcast is required. A useful starting experiment is a rolling 20-word window combining at least two independent signals: very low positional accuracy, an unusually dominant repeated character or recurring keyboard sweep, and a long burst of near-zero timing intervals. Show a neutral **Needs check-in** indicator, not an accusation or automatic damage modifier.

Thresholds need classroom calibration. Low accuracy alone can mean a student is learning; steady timing can mean good typing; rapid input can come from an assistive input device. Current displayed accuracy credits an entire word only when perfect, so a future detector should calculate positional letter accuracy separately. Simulated or self-reported timings should never be the sole evidence.

The recommended order is private participant tokens, correct-to-advance input, then observational flags. Keep legitimate letter power, color-bank rates, cadence rewards and attack damage intact. Account for corrected-key timing and transition gaps in the server protocol before changing the UI gate.

## Epic presentation with less work

Games commonly separate authoritative state updates from the display frame rate, interpolate between snapshots, send changes rather than whole scenes, and give important actors a larger animation budget. See [snapshot interpolation](https://gafferongames.com/post/snapshot_interpolation/), [snapshot compression](https://gafferongames.com/post/snapshot_compression/), and Epic's [animation budgeting](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-budget-allocator-in-unreal-engine). For browser animation, prefer compositor-friendly [transform and opacity](https://web.dev/articles/animations-and-performance).

For this game, the next presentation improvements should be:

1. Reserve large effects for the student's attack, critical hits, the dragon's wind-up/breath, revivals and victory. Simplify distant routine hits during busy moments while retaining every actual combat result.
2. Introduce phase changes at boss-health thresholds: a different static color grade, a short boss cue, stronger music and an attack-pattern announcement. These are rare events with high dramatic impact.
3. Play effects locally from event IDs and authoritative timestamps. The existing projectile and sprite systems already do much of this; never stream animation frames.
4. Merge a dense burst of secondary damage labels into a short team-volley summary. Preserve personal numbers and the full combat log. Limit overlapping sound voices as well as visual effects.
5. Prefer anticipation and a clear impact over constant motion: a readable wind-up, one strong flash, a short sound and a health-bar change. Offer reduced motion and sound controls.

These are presentation recommendations, not additional implemented game mechanics. Merging visuals must never merge, delay or discard authoritative damage calculations.
