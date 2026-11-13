# Typing Boss modes

Pressing Start sets a shared server `countdownEndsAt` five seconds ahead for both modes. Host and player scenes show 5–4–3–2–1, and typing/actions are disabled until the deadline. Reconnecting resumes the remaining time. The server rejects early words and Old Mode challenges/actions, ignores early progress, and begins the typing-rate clock at the deadline. Old Mode's first timed boss attack occurs only after the countdown plus its attack interval. Repeated Start cannot reset the countdown; closing cancels its callback. `node scripts/verify-battle-countdown.cjs` checks both modes against an isolated backend on port 4003 (or `TYPING_BOSS_TEST_URL`).

Correct letters earn attack power. Mistakes no longer subtract base ATK, drain color banks, or create a debt against later words. Wrong letters earn nothing; imperfect words cannot activate perfect-word bonuses. Timing rewards are additive: standard Proportional rhythm bottoms out at 1x, and scheduled Balanced cadence starts at 1x. The portrait previews earned charge without deductions. Error counts remain available for observation, not damage penalties. Old mode retains its challenge scoring.

The creation screen defaults to **Proportional**. **Old mode** retains the original quiz challenges, class HP, moves, damage calculations, and timed automatic boss attacks. Requests from older clients that omit `mode` still create old-mode sessions.

## Proportional rules (Balanced off)

- The host chooses Ember Whelp, Cindermaw, or Ancient Red Dragon when creating the room. Ancient Red Dragon remains the default; proportional HP and combat rules are shared by all three. Up to 30 players choose a class; all start with 100 HP and have a unique gold-word ability.
- The roster locks at Start. Dragon HP is `100 × starting player count`. Each dragon attack rolls 30% Bite, 30% Fireball, 30% Tail Whip, or 10% Flamethrower. Bite and Fireball focus all power on one random living player. Tail Whip chooses a random living anchor and its nearest living neighbors in the host's formation, targeting 30% of survivors (rounded to the nearest whole player, minimum one). Flamethrower hits every survivor. Power is divided evenly among the selected targets before dodge and shields; a target's avoided damage is not redistributed.
- Before Start, the host can choose a 1×–1.5× HP multiplier in 0.05 steps (default 1×). It applies equally to every player's HP and dragon HP, with unchanged damage. The server validates and locks it when the battle starts.
- Both sides continuously type random words from the exact numeric word pools used by Home Row Run. The data lives in one shared JSON file. Each attack normally takes ten words on a single clipped line that moves left per accepted character; only the current and next unseen word are revealed. Words advance after a required trailing space, except the final word, which fires on its last letter. Correct characters (including required spaces) add damage. Input continues while requests and projectiles are in flight.
- Gold appears on 5% of words without changing the other color odds. A perfect gold word earns an ability at release. Cleric heals the lowest-HP wounded survivor; Necromancer revives a knocked-out ally; Paladin gives another survivor a one-hit shield, prioritizing an unshielded ally and stacking flat shield HP otherwise. Support replaces the attack, using its power; healing/revival cap at max HP. If no target qualifies, the regular attack goes through. Blue reduction applies before flat shield absorption; dodge preserves both.
- Barbarian and Ancient Red Dragon add two words to the current run per perfect gold, including gold found in added words. The added words can have any normal colors. They grant nothing until typed. A perfect gold extending the former final word requires its separating Space; an incorrect final gold does not extend the run. Both reset to ten words on release and have no gold damage multiplier or carryover. The dragon ability is selected independently from player classes so future bosses can have separate abilities.
- Monk starts the next attack at ten words, then halves it once per gold word (round up: 10 → 5 → 3 → 2 → 1). The shorter attack uses the same damage formula and may earn gold again. Rogue gains one extra independent dodge roll per gold word for the next incoming hit; the displayed chance is the chance any of those rolls succeeds, and the rolls are consumed together.
- Create/join requests opt in to gold words so older clients keep ten-word attacks with the original color set. The host receives progress for the server-known attack window; each typist sees their current progress immediately.
- Rhythm uses actual native key-event timestamp deltas, their mean, and standard deviation: `clamp(1.5 − max(0, SD − 200 ms) / max(mean, 200 ms), 1, 1.5)`. The small timing tolerance prevents tiny fast-key differences from dominating the bonus. Perfectly even fast or slow typing gives 1.5×; sufficiently irregular timing reaches 1×. Pauses within an attack count. The clock resets after release: the first letter of each new attack starts timing, so resting between attacks is free. Insufficient samples give 1×. After a reload, the unavailable first interval is omitted instead of invented. Required separating spaces are timed as their own keys.
- Each word independently has a 30% chance of being colored, with equal chance of each color. Only a completely correct word earns its bonus. Blue immediately adds 10 percentage points of shielding for the next incoming hit, capped at 100%. Orange adds 10% base attack damage. Red adds ten percentage points of crit chance, capped at 100%. Each green word adds 4% base attack damage for every subsequent fully correct word before release; multiple green words accumulate independently.
- Attack power is `correct characters × rhythm × (1 + orange + green growth) × critical`. Only characters matching the expected letter at the same position add damage, including within partially correct words. Critical is 2× on a successful red roll, otherwise 1×. Orange, red, and green reset on release. Blue persists until the next incoming hit and can be earned while that hit is traveling. The host earns the same bonuses and defenses.
- A player hits the dragon for their attack power. The host splits its power equally among the targets of its selected attack, with each target's defenses applied on impact. HP and totals keep fractional precision internally; displays show up to two decimals. Actual damage credit is capped by remaining HP.
- At least 2× base attack power selects the power attack art/animation; smaller attacks select the weak attack. The host's volley uses one shared 700 ms impact timer. The fight ends when the dragon or the entire party reaches zero HP; finished fights cancel remaining in-flight damage.

## Balanced rules

The host's Balanced switch defaults off and locks at Start. It applies only to
Proportional mode. Old Mode and the randomized Proportional rules are retained.

- Balanced actors share the same server-generated word sequence and filters; the seed stays private and clients receive short issued-word windows. The **Random colors** toggle appears only with Balanced enabled and defaults on. Every generated word uses the shared chance map: white 40%, orange 20%, blue 18%, green 15%, red crit 4%, gold special 3%. Color is seeded by word index so previews, server validation, retries and reconnects agree. Banking, perfect-word activations and class effects remain Balanced. This option locks at Start and is included in host/player snapshots.
- With **Random colors off**, every correct letter of every color adds 1 base ATK; mistakes earn nothing and preserve saved attack power. Separators add no power. Ordinary word colors cycle orange, blue, green, white, red in 20-correct-letter bands. Color changes happen at word boundaries.
- Colored letters also fund their own bank: orange adds 1.25 extra attack per correct letter (Prayer for Clerics); red adds 0.125 crit percentage points; blue adds 0.625 Block capacity, half its former steady rate. Wrong letters leave saved banks intact and earn no new bank power.
- Glowing triggers activate saved resources only when typed completely correctly. Extra attack triggers every 120 correct letters, crit every 134, Block every 140, special every 150, and Dodge every 160. When deadlines overlap, the earliest overdue trigger goes first. Each trigger gets one attempt, then advances to its next interval even on a miss. Banks survive missed triggers and attack releases. Extra attack and crit that are activated apply to the current attack and reset on release. Block and activated Dodge persist until spent. Gold retains the class ability.
- Scheduled words commit on the **last letter**, before Space. Space advances input to the next word without awarding or recomputing bonuses. A final word fires immediately; a perfect Barbarian/dragon gold extends the run by two words at letter completion. Scheduled submissions contain letters only. All completed scheduled words flush promptly through the existing serialized, retry-safe request queue.
- **Cadence** uses only character-to-character intervals within the current word. Its running mean and population standard deviation start fresh on each word; transition gaps and separators are excluded. Each correct character adds up to 0.0025 to this attack's multiplier (0.25 percentage points), weighted by `max(0, 1 - SD / max(1, mean))`. The first letters start earning immediately. The UI previews each character, commits on the final letter, applies the accumulated multiplier to base ATK at release, and resets to 1× for the next attack. Four decimal places keep early growth visible.
- **Dodge** separately compares Space-to-first-letter time with the mean letter gap in that new word. A perfect green word banks up to 0.5 pending points (half the old rate): full credit up to 1.25× its letter pace, zero at 2.5×, linear in between. Attack-opening words earn no transition points. A perfect glowing green trigger transfers pending points into active Dodge, with no storage cap. Success avoids the whole hit, spends 100 active points down to zero, and preserves Block; failed rolls retain points. Rogue extra rolls still apply.
- Scheduled Block and Dodge visuals use only **activated** resources; banked points never inflate the portrait shield or green ground effect. Defense numbers are hidden. ATK, extra attack and crit retain numeric displays. Blue activation caps usable Block at one health bar, preserving overflow in its bank. Both blue and Paladin Block scale by the incoming attack's target count.
- With **Random colors on**, the prior rules remain: only white words build base ATK at 1–1.25 per correct character according to the recent median gap; colored words fund their own banks and every perfect colored word activates its resource. Red applies its banked percentage to damage. Green earns active Dodge up to 1 point per smooth transition. Words usually require a trailing Space, including timed separators. Per-character bank previews do not activate partial words.
- Balanced Clerics bank Prayer on orange-category words. In scheduled mode these words also build ATK; only glowing orange triggers deposit Prayer into the shared pool. Random-color mode retains immediate perfect-word deposits and flat-yellow words. Gold attack release heals a random wounded living player, including self, limited by attack power, the shared pool, missing HP and the healing allowance. Only actual restored HP is spent. The allowance grows by half the actual HP damage dealt by the dragon after defense, limiting total team healing to half that damage.
- Gold Necromancer/Paladin effects retain their 20% support reserve; unused support returns as damage. Paladin shields persist until spent. Monk shortened attacks, Rogue extra rolls, and Barbarian/dragon extensions retain their class behavior.
- Boss patterns follow Bite, Fireball, Tail Whip three times, then Flamethrower. Target anchors rotate through survivors. Player count scales dragon HP, without multiplying either side's attacks. The 1×–1.5× setup slider scales both sides' HP only.
- Balanced submissions include actual key gaps alongside timing aggregates. Client and server share deterministic scoring, validate whole batches atomically and ignore acknowledged duplicates. Frontend and backend must be deployed together for the scheduled last-letter protocol.

Run the multiplayer verifier with TYPING_BOSS_BALANCED=1 for Balanced, or omit
that variable for Randomized. Deploy both frontend and backend and create a new room.

## Internet traffic and animation

The existing HTTP/SSE transport is retained. Cosmetic progress and words that change no active ability share a 400 ms room flush (at most 2.5 updates per second). Combat releases, hits and active ability changes preempt that queue and retain the 100 ms flush. Public battle state is built once per flush. The host receives the full animated battle stream; students receive only projectiles they send or receive, their private typing state, and a quiet team overview refreshed on aligned one-second summary ticks. A shared trailing timer flushes the last team change even if no further combat occurs. Personal HP/defense/impacts, roster/status changes and ending results are delivered promptly. Rebuilt nested values are compared by content, so unchanged dragon profiles and timing arrays produce no patches. Formation maps remain stable through HP and charge changes, preventing layout observer teardown and repeated geometry reads. Remote charge bars interpolate locally; personal feedback remains immediate. Scenes with more than ten players stop continuous character idle sprite loops while retaining event animations and personal portrait animation. No key-by-key messages or animation frames are transmitted.

- New rooms use server-issued words with per-actor tickets. Only two unseen words are available at once; the sequence seed stays server-side. Each completion submits the exact word, ticket, mistake count and timing aggregates; Balanced also submits accepted-letter gaps. No per-key requests or absolute client timestamps are sent. See [integrity protection](INTEGRITY.md) for the server clock, bounded arrival credit and automation limitations.
- The scene is above the typing panel. In scheduled Balanced mode, active Dodge and Block are shown visually without numbers; other modes retain their defense chips. The dragon lunges and snaps its jaws for Bite, swings its tail for Tail Whip, and uses the existing fire projectile art for Fireball and Flamethrower. Target shields are applied on impact.
- Attack-charge bars sit immediately above health bars. Own charge updates locally on every character. A compact word/character cursor goes to the server at most once per 400 ms, with one request in flight. The host and every player see all player charges and the dragon's charge. Progress is cosmetic, validated, and cannot award damage or alter typing statistics.
- Protected rooms send each completed word immediately to replenish the issued window. Legacy scoring helpers retain attack batching; Requests serialize while typing continues; sequence numbers make retries idempotent. Batches are validated atomically and capped at 20 words.
- Dodge banks up to 1 point per proficient word transition with no storage cap; actual dodge chance is capped at 100%. Growth compares the Space-to-next-word gap with the remaining key gaps in that word: up to 1.25× pace earns full growth, 2.5× or more earns zero, with linear growth between them. Slow transitions never remove saved dodge. Opening words do not earn a transition bonus. Attack release and failed dodge rolls preserve the bank; a successful dodge spends 100 points, stopping at zero, and preserves Block. Rogue extra rolls still apply.
- The host and every player use the same formation and camera. The host receives all combat events. Students receive only their own incoming/outgoing events, with background HP, defeat/revival status and compact team damage/healing/revival totals summarized about once per second. Their overview contains no projectiles or combat animations; full action lives beside the typing words. Each player receives only their own private typing state; host credentials and other typing states are excluded. A persistent green pointer identifies the client's own character, including when knocked out or when the HUD is hidden. Full snapshots are sent on first connection/reconnect; subsequent events contain only changed fields, including small impact-result patches.
- The host's Battle log accordion is available in development and production beneath the game. It records resolved combat and game status from existing updates, names both participants, uses the combat colors, shows timestamps, and supports text filtering and clearing. History stays in that tab, keeps at most 200 entries, and resets on refresh or a new room. It adds no network requests or server-side history; reconnect can recover only events still present in the live snapshot.
- Cosmetic updates coalesce for 400 ms; combat events coalesce for 100 ms without waiting for cosmetics. Idle rooms only send a 25-second connection keepalive. A slow stream is disconnected before it can accumulate unbounded writes, and reconnect receives a fresh authoritative snapshot.
- Projectile movement uses browser-driven transform animations, with local impact expiry. React no longer rerenders the projectile layer on a frame timer. Character assets are reused, and host impacts appear beside the corresponding player to avoid a pile of labels on the dragon. At 1–10 players, names and both bars remain visible. At 11–20, names are hidden and bars are shorter and thinner. At 21–30, names and both bars are hidden. These thresholds apply to both host and player scenes; live damage-in/out totals are available through Stats instead of the scene.
- The volcanic valley has separate distance, battle-ground, haze, and transparent foreground layers. The party stands on the left and the dragon on the right, with the dragon name and bars at the upper right. Foreground basalt rises in front of the actors while leaving names, charge, and HP clear. The shared formation uses four players per rank and up to eight ranks, each lower rank staggered toward the bottom left. The server uses the same positions for Tail Whip neighbors, including knocked-out slots. Narrow screens can scroll the battle scene horizontally. Scenery and its generation prompts live under `public/assets/typing-boss`; the original arena assets are retained.
- The join menu automatically supplies a curated classroom-friendly alias of at most nine letters. Shuffle always picks a different alias. Display Code and Copy Code show only the final three characters (including leading zeroes); the join field accepts those characters and existing full `boss` codes. Full join links remain available from the host toolbar.
- Session and game state remain in memory, matching the existing backend. A backend restart ends rooms. A single room must stay on one backend process; this change does not add distributed room storage.
- Rooms with no connected clients and no authenticated activity expire after 10 minutes. Disconnecting the final client starts a fresh reconnect grace period; connected rooms retain the two-hour maximum from creation. Finished/closed rooms retain results for 15 minutes, capped by that maximum. Expiry allows one minute to deliver its final notice, then deletes the room and releases its timers, sockets, snapshots, and game state. The 15-second server sweep enforces idle and result deadlines independently of incoming requests.
- Old Mode keeps only the latest challenge per player and expires unfinished challenges after 10 minutes. Finished fights release challenges immediately. Combat events are pruned by the sweep even without viewers. Filtered word pools use a 32-entry least-recently-used cache on server and client; eviction preserves word generation order.
- Saved host/player credentials carry the room expiry plus the one-minute removal grace; finished snapshots shorten it. Typing Boss prunes expired entries on access and every minute while mounted. Existing raw credentials get a one-time 10-minute verification grace, then adopt the real room expiry. Confirmed missing/expired rooms or invalid credentials remove saved entries; temporary network failures preserve them. Unrelated browser storage is untouched. End screens close their live stream while keeping results visible and available for reconnect during retention.
- Ending results include a separate boss card followed by players ranked by total damage. Cards show only total damage, battle-average DPS, strongest landed attack power, and typing skills (positional character accuracy, accepted-character WPM, mean key gap and timing variation across submitted words). WPM uses five accepted characters per word. Both rates use battle duration from the end of the countdown to the frozen battle end. Typing totals survive attack resets. Boss group attacks count as one strongest-attack volley, and boss damage sums actual HP removed after defenses and overkill limits. Strongest attacks are selected by original power, with actual damage breaking ties; canceled attacks do not qualify. Combat modifier breakdowns are hidden. Boss summary fields travel only in the ending leaderboard, and results remain available after reconnect.

Implementation references: [Node writable-stream backpressure](https://nodejs.org/api/stream.html), [HTML EventSource reconnection](https://html.spec.whatwg.org/dev/server-sent-events.html).

## Character actions and reactions

The personal continuous-typing panel includes an animated player profile to
the left of the word row and a dragon profile to its right (both above the words
on small screens). Special counts and words-per-attack counters are hidden on
the client. Defense labels read Dodge and Block. The player's red ATK counter shows correctly typed characters
(including required spaces) charged in the current attack and pulses only when
that count rises. It resets on release. Both ATK counters sit at the top left;
their font grows by .12 px per charged player character and .24 px per dragon
character, with a 22 px growth cap. Dragon charge uses the existing validated,
cosmetic cursor and cannot award power. The green ground oval tracks dodge (or
Dodge chance in Balanced), and the blue bubble tracks Block capacity.
A perfect gold word lights a larger golden energy aura until attack release.
The portrait uses the same combat events and sprite animation as the scene.

Completed words produce a short notice at the word row with the actual earned
bonus. Errors never announce a bonus; capped defenses and Balanced word effects
are labeled accurately. Only the latest notice remains visible, and it expires
even with reduced motion enabled. These effects are local and add no requests.

On a player's device, that player's outgoing and incoming projectiles use the
profile as their endpoint, with damage traveling to the dragon profile and support going
to its real recipient. Other players' projectiles remain in the battlefield.
The overlay measures the actual profile and scene bounds on resize/scroll and
retains the original attack timestamps. The host scene and shared formation are
unchanged. The dragon profile to the right of the typing text shows the full
shared dragon: all attacks, all landed-hit feedback, authoritative hurt, Power,
ready crit, special, dodge and Block. Public combat fields are supplied in
`boss.profile`; the host's word seed, cursor and key timings stay private.
Incoming dragon attacks include a target warning, a fireball trail or continuous
flame stream, and distinct impact rings/sparks with blue feedback for blocks.
Reduced-motion preferences suppress the new travel/impact effects.

All six classes use six-frame sprite actions. The approved paladin, cleric and
barbarian idle strips remain in place. Rogue, necromancer and monk now also have
animated idle strips. All three dragons use generated six-frame attack sheets for Bite, Fireball, Tail
Whip, and Flamethrower. The jaw, neck, wings, and tail change pose in the artwork;
attack playback does not translate or rotate a static image. The ready cell is
also used for idle so scale and footing stay consistent. Dragon hurt reactions
use three basic frames (300 ms), six power frames (660 ms), or ten critical frames
(1200 ms), with progressively stronger facial/body reactions. Critical overrides
power or basic, and power overrides basic. Lower and equal hits never restart an
active higher/equal reaction. Dragon attacks override basic hurt; power and
critical hurt own the sprite until they finish. Shield effects can overlay it. Sheets
preload with the actor; a late load catches up to server time, and repeated
snapshots do not restart playback. The original sprite is the loading fallback.
Atlas PNG masters, lossless runtime WebPs, layout manifest, and generation
prompts are under `public/assets/typing-boss/dragons`. Current runtime files use
`*-attacks-v2.webp`, repaired from two 3×4 masters per dragon. Run
`node scripts/prepare-typing-boss-dragon-repair.cjs` to validate and pack them.
All 72 frames have 12px transparent guard bands and are checked for opaque
artwork cut by source boundaries. The viewport clips one cell at a time and
allows room around wings, tails and compact mouth flames. The original masters
and their legacy packing script remain available for reference. Repair prompts
and the per-frame validation manifest are in the same asset directory.
The development `/typing-boss/animations` screen previews all three dragons;
its dragon frame inspector can freeze every frame of each attack. Slow preview
and Replay dragons resume playback. Reduced-motion mode shows one drawn attack
pose without animation.

Dragon attack/idle footing uses a shared ground line and registered claw contacts.
`node scripts/register-typing-boss-dragon-feet.cjs` analyzes all 72 frames, generates
compact CSS geometry in `dragonRegistration.ts`, and records the pixel measurements
in `dragons/footing-manifest.json`. A single padded camera per dragon fits the full
set of registered poses, including wings, tail and fire. The supporting forefoot
stays registered when a tail sweep hides the rear contact. Idle no longer bobs the
whole actor off the ground; intentional dodge, death and revival movement remains.
Re-run registration after repacking dragon art. Playback is still native CSS, with
no per-frame React updates or additional combat messages.

`server/dragonCombat.js` queues whole dragon attacks during power/critical hurt,
including their projectile creation and damage timers. Waiting attacks drain once
in FIFO order, reevaluating the current pain deadline if a critical replaces a
power reaction. Targets are chosen when the queued attack actually launches.
Already-launched projectiles finish on their existing impact timers. Finished or
expired rooms discard queued attacks and release their timers/closures. Shared
frame counts, durations, and hit classification live in `dragonHurtRules.js`.
Snapshots carry the authoritative reaction and queue count so all devices use
the same timeline. Misses, full blocks, and support effects never inflict pain.

Hurt masters, lossless runtime sheets, prompts, and footing data are under
`public/assets/typing-boss/dragons`. `node scripts/prepare-typing-boss-dragon-hurt.cjs`
packs the 3/6/10 cells and registers feet against the existing attack camera.
The development animation viewer can scrub all ten critical frames.

With a local backend running, `node scripts/verify-dragon-hurt-queue.cjs` creates
and closes its own Balanced room, earns a real critical through the words API,
checks the shared hurt state, and verifies that a queued dragon attack creates
its projectile after recovery and resolves damage only after the new flight
timer. Set `TYPING_BOSS_TEST_URL` to use a backend other than localhost:4000.

| Combat event | Source action | Recipient reaction |
| --- | --- | --- |
| Damage | Weapon/cast, or power attack | Hit recoil and red flash |
| Healing | Support cast (including self-healing) | Yellow healing pulse |
| Shield grant | Shield cast | Blue shield pulse and brace |
| Shield absorption | Attacker's normal action | Blue block; partial damage also flashes red |
| Buff | Support cast | Blue pulse; evasion readiness uses green |
| Dodge/miss | Attacker's normal action | Dodge pose and green trail, without a hit reaction |
| Revival | Revival cast | Rise from the ground and yellow pulse |
| Knockout | Incoming action | Fall once, then hold the collapsed pose |

Source actions begin at the event's start; recipient reactions wait for the
server-confirmed impact. The actor clock uses the server timestamp. Reconnects
skip expired animation, and progress snapshots cannot restart it. Simultaneous
impacts coalesce; a cast interrupted by a reaction retains a visible action cue.
Revival completes before the body returns to normal action. These are visual
changes and do not change combat calculations or add network messages.

CSS plays the frames and effects; React schedules only pose changes, with no
per-frame updates. A shared preload cache holds at most one combat atlas per
class, keeps idle visible while loading, and can retry failed loads. Runtime
atlases total about 2.55 MB for all six classes (about 77% smaller than the PNG
masters). Reduced-motion preferences disable sprite motion and effects while
preserving the standing/down state.

The development preview is `/typing-boss/animations`; it lets you replay every
pose for all six classes and the dragon without opening a room. That preview
route is excluded from production; battle animations are enabled in production.
Assets and the exact built-in image-generation prompts are in
`public/assets/typing-boss/characters/generation-prompts.md`. PNG masters are
retained; rebuild the runtime WebP atlases with
`node scripts/prepare-typing-boss-animation.cjs` (requires Sharp locally).

The paladin, cleric, rogue and necromancer use `*-combat-v2.webp`. Their weapon
rows were repaired with the built-in image-generation tool and packed into wider
128×96 cells. `node scripts/prepare-typing-boss-weapon-repair.cjs` checks all 24
frames for empty gutters and preserves the other seven rows' pixels with added
horizontal padding. It also regenerates `weaponRepairAnchors.ts` to keep the
footing aligned. Exact prompts and sources are documented in
`public/assets/typing-boss/characters/weapon-repair-prompts.md`.

The full player audit covers all 288 source frames across six classes. Re-run
`node scripts/audit-typing-boss-sprites.cjs --check` after changing art; it checks
cell borders and generates the per-class registration data. Stable casts and
receiving-heal poses stay planted; dodging, hit recoil, falling and rising retain
their drawn motion with the source strip's drift removed. The three repaired
support strips use `*-combat-v3.webp`, packed by
`scripts/prepare-typing-boss-support-repair.cjs`; their exact generation prompts
are in `public/assets/typing-boss/characters/support-repair-prompts.md`. Weapon
repairs and the other seven source rows are preserved. The preview's Inspect
player frames checkbox and slider allow all six frames to be reviewed individually;
Replay resumes animation. Inspector controls are development-only.

## Verification

### Deploying the backend on Render

Proportional mode runs on the same classroom Node web service as Old Mode. It
does not require a separate Render service, database, or Typing Boss environment
variable on Render.

1. In the existing Render web service, use the `bmagee88/cougar-cash` repository
   and `main` at merge commit `bac96ed` or a newer revision that includes
   `server/proportionalBoss.js`. Use matching word-bank revisions on Netlify
   and Render because both generate words from the same shared list.
2. Set **Root Directory** to the repository root (leave it blank), **Build
   Command** to `npm ci`, **Start Command** to `node server/appServer.js`, and
   **Health Check Path** to `/api/health`. Use the Node runtime. Leave `PORT` to
   Render; remove old custom port overrides if they conflict. Keep a single
   instance because active rooms are stored in that instance's memory.
   If Render reports `Missing script: "start:backend"`, check the commit in
   the deploy log and the service's Root Directory. The merged `main` commit
   `bac96ed` has both the npm alias and `server/appServer.js` at the repository
   root. The direct Node command bypasses the alias, but still needs that file
   and its dependencies in the deployed checkout.
   If the startup banner says `cougar-classroom-backend@1.0.0 start` and
   startup fails with `Cannot find module 'pg'`, Render is running the
   `server/package.json` script. Install dependencies from the repository root
   instead: clear Root Directory, run `npm ci` there, and start
   `node server/appServer.js`. The root manifest and lockfile include `pg` and
   `google-auth-library`, and the backend also loads shared code from `src/`.
3. Choose **Manual Deploy → Deploy latest commit**. A service restart alone
   will not pick up code from the branch. Existing rooms end when the old
   process stops. With the updated diagnostics, `GET /api/health` includes
   `"typingBossModes":["old","proportional"]`. Commit `15b15b0` already supports
   the new mode but does not have this diagnostics field.
4. For a separate Typing Boss service, set `REACT_APP_TYPING_BOSS_API_URL` in
   Netlify's build environment to its public HTTPS base URL (for example,
   `https://cougar-cash-boss-battle.onrender.com`, without `/api` or
   `/typing-boss`). Redeploy Netlify with the updated frontend code. This
   variable takes precedence for Typing Boss only. Leave
   `REACT_APP_COUGAR_API_URL` unchanged for the other classroom apps. When the
   dedicated URL is unset, Typing Boss continues to use the shared URL.
5. Open `/typing-boss` on your Netlify site, create a fresh **Proportional · Host
   vs players** room, and join from a second browser. The Ancient Red Dragon and
   the host's grade and sentiment filters confirm the new setup. The frontend
   reports an error if the backend returns a different mode than requested.

Render references: [Web Services](https://render.com/docs/web-services),
[Manual deploys](https://render.com/docs/deploys#manual-deploys),
[Health Checks](https://render.com/docs/health-checks).

### Local checks

```text
node --test server/proportionalBoss.test.js
npm run test:typing-boss-ui
npx tsc --noEmit
npm run build
```

With the classroom backend running, `node scripts/verify-typing-boss.cjs` opens 31 SSE clients, checks 30-player scaling, shared scene delivery, private typing-state isolation, simultaneous attacks, sequence retries, reconnect snapshots, and the original mode's challenge/action routes. It closes its rooms afterward.

One local run produced 60 projectiles (30 player shots plus 30 host targets), including one progress update per actor, using 32,813 host payload bytes and an average 1,442 payload bytes per player, with four host updates. These are measured SSE event payloads for that one attack burst, excluding initial snapshots, uploads, HTTP/TLS overhead, and real-world latency. Word lengths and scheduling change the exact totals. This is a local concurrency test, not an internet latency or classroom hardware benchmark.

Outside scheduled Balanced, every word must end with a typed space, except word ten, which fires on its last letter. Spaces count as correct damage characters and their key intervals are included in rhythm. Rhythm is clamp(1.5 - max(0, SD - 200ms) / max(mean, 200ms), 1, 1.5); there is no WPM bypass for long pauses.

Before starting proportional mode, the host can select one or more grade chips. Everyone uses the union of those grades; unreviewed entries with null grades are excluded. Grades without words are disabled. Selection locks at Start. A compact grade bitmask in each typing state lets clients and the server derive the same filtered pool without sending word lists or changing color odds. Legacy API callers omitting grades retain the full original pool.

Host setup includes shared grade and sentiment checkbox chips. Each group has All, which disables individual chips until toggled off. Selected grades and sentiments intersect; empty combinations cannot start. Both masks are locked at Start and distributed in actor typing states. Color-bonus probabilities remain independent of sentiment.

## Flame breath animation and scheduling

Each dragon has a transparent 20-frame flame-breath master (`dragons/*-flame-20.png`) and a lossless 5×4 runtime atlas (`*-flame-20.webp`). `scripts/prepare-typing-boss-dragon-flame.cjs` packs cells and registers feet to the existing attack camera. `flame-20-generation-prompts.md` records the built-in imagegen prompts. The animation inspector supports all twenty frames and slow playback.

The shared `DRAGON_FLAME` timeline runs for 2000ms: 600ms inhale, then 1100ms fire flight, impact at 1700ms, followed by recovery. `animationStartedAt` starts the body before the projectile's `startedAt`. The full body animation cannot be interrupted by attacks, hurt, dodge or block. Lethal damage still ends combat normally.

While breath is active, incoming hits apply damage immediately on impact. Basic hurt is skipped; power and critical hurt enter the strong-reaction queue, with one pending reaction per tier to bound classroom bursts. Critical reactions play before power reactions after breath ends. Other outgoing dragon attacks wait behind breath and the stronger hurt queue, including their projectile launch and damage timer. Room cleanup and victory/defeat discard both queues and invalidate their timer callbacks. The host dragon uses authoritative shared hurt/queue state. Student dragon portraits reconstruct only their own landed hits and boss attacks targeting them; unrelated global hurt, flame and queue fields are omitted. Personal flame events still preserve their full protected animation timeline.

## Room creation access

Room creation requires the password on both the unlock endpoint and the session creation POST. The server defaults to the configured classroom password and supports a `TYPING_BOSS_CREATION_PASSWORD` environment override. The browser keeps the entered password only in component memory and sends it with creation requests; refreshing locks the creation page again. Joining remains public. The password field displays two masking dots for each real character. Joining existing rooms requires no creation password.


See [Performance and integrity findings](PERFORMANCE-AND-INTEGRITY.md) for the current exploit boundaries, non-damage alternatives and presentation recommendations.


New private credentials replace public-code authentication in both modes. Deploy both sides together and use fresh rooms; legacy public codes cannot recover private tokens. Wrong keys now stay at the same cursor position, preserve earned power and record a mistake. A corrected word cannot activate a perfect-word bonus. See [INTEGRITY.md](INTEGRITY.md) for details.


## Student overview and personal combat

Student proportional screens keep the volcanic scenery, formation and resting/defeated character poses as a static overview. Health changes have no transition animation, charge bars are hidden, and crowded student overviews use small HP bars below resting characters. Defeated/revived status switches on summary updates. The student's portrait and opponent portrait retain complete attack, critical, block, dodge, healing, revival and flame effects. Personal projectiles are confined to the typing-profile area; ally support uses a named notice in that area. Unrelated players never animate the student dragon profile.

A short local team-activity cue beside the typing profiles reports new actual team damage, healing or revivals from compact cumulative summaries. Initial snapshots do not replay historical team cues. No animation frames are broadcast. The host classroom display continues to animate the whole encounter. Interest filtering and summary throttling change presentation/delivery only: simulation, damage accounting and final leaderboards remain authoritative and complete.

`server/typingBossAudience.test.js` checks personal event selection, summary throttling/trailing delivery, own-hit immediacy, revivals, terminal refreshes and nonmutation of host/simulation data. UI tests check frozen overviews, personal-only dragon reactions, support endpoints and team cue expiry. The 31-client verifier checks both audiences and reports host and average student SSE patch bytes; these are workload-specific measurements, not a device FPS benchmark.
